import { json, requireAuth, checkOrigin } from "@/lib/api";
import { writeFile, mkdir, access, constants } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { optimizeImage, isImageMime, type ImageProfile } from "@/lib/image-optim";

const ALLOWED: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
  "application/pdf": ".pdf",
  "application/vnd.android.package-archive": ".apk",
  "application/octet-stream": ".bin",
};

const IMAGE_PROFILES: ImageProfile[] = ["icon", "banner", "logo", "favicon", "content", "generic"];

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

function resultContentType(ext: string): string {
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "image/jpeg";
}

/** True if the public/uploads directory is writable on this runtime.
 *  On Vercel / other read-only-filesystem hosts small image uploads fall back
 *  to an optimized data URL that is persisted in the settings JSON. APK/ZIP/PDF
 *  uploads still require persistent writable storage. */
async function uploadsWritable(): Promise<boolean> {
  try {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const probe = path.join(dir, `.probe-${Date.now()}`);
    await writeFile(probe, "");
    await import("fs/promises").then((m) => m.unlink(probe)).catch(() => {});
    await access(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);

  const writable = await uploadsWritable();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "No file provided" }, 400);
  if (file.size > MAX_SIZE) return json({ error: "File too large (max 100MB)" }, 400);

  const profileRaw = String(form?.get("profile") || "generic");
  const profile: ImageProfile = IMAGE_PROFILES.includes(profileRaw as ImageProfile)
    ? (profileRaw as ImageProfile)
    : "generic";

  let ext = ALLOWED[file.type];
  if (!ext) {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".apk")) ext = ".apk";
    else if (name.endsWith(".zip")) ext = ".zip";
    else if (name.endsWith(".pdf")) ext = ".pdf";
    else if (name.endsWith(".webp")) ext = ".webp";
    else return json({ error: "Unsupported file type" }, 400);
  }

  try {
    // Explicit `Buffer` annotation (rather than letting TS narrow to the
    // specific `Buffer<ArrayBuffer>` inferred from `Buffer.from`) is needed
    // because we reassign this variable below to sharp's `Buffer` output,
    // whose backing-store generic is the wider `ArrayBufferLike`.
    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let outExt = ext;
    let width = 0;
    let height = 0;
    let originalBytes = buffer.length;
    let optimizedBytes = buffer.length;

    // Auto-compress every image (upload path). APK/ZIP/PDF pass through
    // untouched — compressing an already-zipped APK gains nothing and
    // would risk corrupting it.
    if (isImageMime(file.type)) {
      const result = await optimizeImage(buffer, file.type, profile);
      buffer = result.buffer;
      outExt = result.ext;
      width = result.width;
      height = result.height;
      originalBytes = result.originalBytes;
      optimizedBytes = result.optimizedBytes;
    }

    if (!writable && !isImageMime(file.type)) {
      return json({ error: "APK/archive uploads require persistent writable storage on this host." }, 501);
    }

    if (!writable) {
      // Vercel/serverless filesystems are read-only between invocations.
      // Small admin images (logos, icons, favicons) are therefore returned
      // as an optimized data URL so the existing settings DB can persist the
      // upload without requiring another storage service. This path is
      // intentionally limited to images by the caller/profile pipeline.
      const dataUrl = `data:${resultContentType(outExt)};base64,${buffer.toString("base64")}`;
      return json({
        ok: true,
        url: dataUrl,
        width,
        height,
        originalBytes,
        optimizedBytes,
        savedPct: originalBytes > 0 ? Math.round((1 - optimizedBytes / originalBytes) * 100) : 0,
        storage: "settings-data-url",
      }, 201);
    }

    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${outExt}`;
    await writeFile(path.join(dir, filename), buffer);

    return json(
      {
        ok: true,
        url: `/api/uploads/${filename}`,
        width,
        height,
        originalBytes,
        optimizedBytes,
        savedPct: originalBytes > 0 ? Math.round((1 - optimizedBytes / originalBytes) * 100) : 0,
      },
      201
    );
  } catch {
    return json(
      { error: "Could not process this file. On serverless hosts, paste an external URL instead." },
      500
    );
  }
}
