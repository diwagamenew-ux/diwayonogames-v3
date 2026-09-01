import { json, requireAuth, checkOrigin } from "@/lib/api";
import { writeFile, mkdir, access, constants } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { optimizeImage, fetchRemoteImage, type ImageProfile } from "@/lib/image-optim";
import { rateLimit, getClientIp } from "@/lib/util";

const IMAGE_PROFILES: ImageProfile[] = ["icon", "banner", "logo", "favicon", "content", "generic"];

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

/**
 * "Optimize this pasted URL" — downloads a remote image (with SSRF
 * protection + a browser User-Agent so hotlink-protected hosts don't block
 * the fetch), compresses/converts it with sharp, and saves it under
 * /uploads so the site serves it locally forever after. This is what fixes
 * "I pasted an image URL and it doesn't show up" for good: the page never
 * depends on the original external host again.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);

  const ip = getClientIp(req);
  if (!rateLimit("optimize-url:" + ip, 20, 5 * 60_000)) {
    return json({ error: "Too many requests. Try again in a few minutes." }, 429);
  }

  const writable = await uploadsWritable();

  const body = await req.json().catch(() => ({}));
  const rawUrl = String(body?.url || "").trim();
  if (!rawUrl) return json({ error: "url is required" }, 400);

  const profileRaw = String(body?.profile || "generic");
  const profile: ImageProfile = IMAGE_PROFILES.includes(profileRaw as ImageProfile)
    ? (profileRaw as ImageProfile)
    : "generic";

  // If it's already a same-site local URL, there's nothing to fetch/mirror.
  if (rawUrl.startsWith("/")) {
    return json({ error: "That's already a local URL — nothing to optimize." }, 400);
  }

  try {
    const { buffer, mime } = await fetchRemoteImage(rawUrl);
    const result = await optimizeImage(buffer, mime, profile);

    if (!writable) {
      const dataUrl = `data:${result.contentType};base64,${result.buffer.toString("base64")}`;
      return json({
        ok: true,
        url: dataUrl,
        width: result.width,
        height: result.height,
        originalBytes: result.originalBytes,
        optimizedBytes: result.optimizedBytes,
        savedPct: result.originalBytes > 0 ? Math.round((1 - result.optimizedBytes / result.originalBytes) * 100) : 0,
        storage: "settings-data-url",
      }, 201);
    }

    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${result.ext}`;
    await writeFile(path.join(dir, filename), result.buffer);

    return json(
      {
        ok: true,
        url: `/api/uploads/${filename}`,
        width: result.width,
        height: result.height,
        originalBytes: result.originalBytes,
        optimizedBytes: result.optimizedBytes,
        savedPct:
          result.originalBytes > 0 ? Math.round((1 - result.optimizedBytes / result.originalBytes) * 100) : 0,
      },
      201
    );
  } catch (err) {
    return json({ error: (err as Error).message || "Could not fetch/optimize that URL" }, 400);
  }
}
