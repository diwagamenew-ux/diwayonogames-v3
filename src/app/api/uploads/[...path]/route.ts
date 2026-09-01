import { readFile, stat } from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * Live pass-through for runtime-uploaded files (POST /api/upload and
 * POST /api/upload/from-url both save into public/uploads and return a URL
 * pointing HERE, not at the static /uploads/... path).
 *
 * WHY THIS ROUTE EXISTS (the actual fix for "my uploaded image doesn't
 * show up"): Next.js's production server snapshots the `public/` directory
 * when the process starts and serves *only* those files directly — a file
 * written to `public/uploads/` by a running server is invisible to that
 * same server's static-file handler until the whole process restarts. The
 * exact same thing happens for real on Vercel: `public/` is deployed as a
 * fixed, immutable asset set at build time, so anything an API route
 * writes into it at runtime is never reachable via its static URL.
 *
 * A Next.js Route Handler, in contrast, is live code — it runs and reads
 * the filesystem fresh on every single request, so a file created one
 * second ago is served exactly the same as a file that's existed for a
 * year. Routing all newly-uploaded assets through this handler (instead of
 * their static `/uploads/...` path) is what guarantees an uploaded image
 * is visible on the very next page load, with no restart/redeploy needed.
 */

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".apk": "application/vnd.android.package-archive",
  ".zip": "application/zip",
  ".pdf": "application/pdf",
};

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;

  // Path-traversal guard: resolve against the uploads root and verify the
  // resolved path is still inside it before touching the filesystem.
  const requested = path.normalize(path.join(UPLOAD_ROOT, ...segments));
  if (!requested.startsWith(UPLOAD_ROOT + path.sep) && requested !== UPLOAD_ROOT) {
    return new Response("Not found", { status: 404 });
  }

  let stats;
  try {
    stats = await stat(requested);
    if (!stats.isFile()) return new Response("Not found", { status: 404 });
  } catch {
    return new Response("Not found", { status: 404 });
  }

  // Conditional GET support (If-None-Match) so repeat visits cost nothing.
  const etag = `"${crypto.createHash("sha1").update(`${requested}:${stats.size}:${stats.mtimeMs}`).digest("hex")}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const buffer = await readFile(requested);
  const ext = path.extname(requested).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stats.size),
      // Filenames are `${timestamp}-${randomHex}${ext}` — never reused or
      // overwritten — so an aggressive immutable cache is always safe.
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
      "Last-Modified": stats.mtime.toUTCString(),
    },
  });
}
