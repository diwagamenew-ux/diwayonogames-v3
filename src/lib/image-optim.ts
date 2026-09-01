import sharp from "sharp";
import dns from "node:dns/promises";
import net from "node:net";

/**
 * Central image optimization pipeline used by BOTH ingestion paths:
 *   1. Direct file uploads (POST /api/upload)
 *   2. Pasted external image URLs (POST /api/upload/from-url)
 *
 * Every image that ends up referenced anywhere on the site (logo, favicon,
 * game icon/banner, post featured image, inline content images) passes
 * through here exactly once at save-time, so the site never depends on an
 * external host being fast/reachable/hotlink-friendly at render time —
 * that dependency is the #1 cause of "my image doesn't show" bugs, because
 * free image hosts (i.ibb.co, imgur, random CDNs) frequently block
 * server-side fetches (hotlink protection keyed on User-Agent/Referer),
 * rate-limit, redirect in ways the image optimizer doesn't follow, or
 * serve formats (SVG) that Next's built-in optimizer refuses by default.
 */

export type ImageProfile = "icon" | "banner" | "logo" | "favicon" | "content" | "generic";

/** Sharp's `resize({ fit })` accepts these string literals. */
type FitMode = "cover" | "contain" | "fill" | "inside" | "outside";

type ProfileSpec = {
  maxWidth: number;
  maxHeight: number;
  targetBytes: number; // soft cap we iteratively quality-reduce toward
  fit: FitMode;
  format: "webp" | "png"; // favicon stays PNG for maximum <link> compatibility
};

const PROFILES: Record<ImageProfile, ProfileSpec> = {
  icon: { maxWidth: 512, maxHeight: 512, targetBytes: 100_000, fit: "cover", format: "webp" },
  banner: { maxWidth: 1600, maxHeight: 900, targetBytes: 180_000, fit: "cover", format: "webp" },
  logo: { maxWidth: 512, maxHeight: 512, targetBytes: 100_000, fit: "inside", format: "webp" },
  favicon: { maxWidth: 256, maxHeight: 256, targetBytes: 60_000, fit: "inside", format: "png" },
  content: { maxWidth: 1600, maxHeight: 1600, targetBytes: 200_000, fit: "inside", format: "webp" },
  generic: { maxWidth: 1600, maxHeight: 1200, targetBytes: 180_000, fit: "inside", format: "webp" },
};

export type OptimizedImage = {
  buffer: Buffer;
  ext: string; // includes leading dot
  contentType: string;
  width: number;
  height: number;
  originalBytes: number;
  optimizedBytes: number;
};

/** True for image mime types we recognize (raster or vector or animated). */
export function isImageMime(mime: string): boolean {
  return /^image\//.test(mime);
}

/**
 * Very small, dependency-free SVG sanitizer: strips <script>, event-handler
 * attributes (onload, onclick, …) and javascript: URIs before we ever save
 * an SVG to disk. SVGs are vector, so we do NOT rasterize them through
 * sharp (that would blur logos) — sanitizing text is the right transform.
 */
function sanitizeSvg(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/xlink:href\s*=\s*("|')\s*javascript:[\s\S]*?\1/gi, "")
    .replace(/href\s*=\s*("|')\s*javascript:[\s\S]*?\1/gi, "");
}

/** Reads metadata without letting an unparsable buffer throw upstream. */
async function safeMetadata(input: Buffer) {
  try {
    return await sharp(input).metadata();
  } catch {
    return null;
  }
}

function guessExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
  };
  return map[mime] || ".bin";
}

/**
 * Runs the compress/convert/resize/strip-metadata pipeline. Handles:
 *  - SVG: sanitized and passed through untouched (vector, already tiny).
 *  - Animated GIF/WebP: re-encoded as animated WebP when possible (keeps
 *    the animation but usually shrinks the file substantially); falls
 *    back to the original bytes untouched if sharp can't process it or
 *    the re-encode doesn't actually save space.
 *  - Everything else (PNG/JPEG/WebP/AVIF/BMP/TIFF/HEIC): resized to the
 *    profile's box, metadata stripped (sharp strips by default — we never
 *    call withMetadata()), converted to the profile's target format, and
 *    quality is iteratively reduced until under the target byte budget or
 *    quality bottoms out.
 */
export async function optimizeImage(
  input: Buffer,
  mime: string,
  profile: ImageProfile
): Promise<OptimizedImage> {
  const spec = PROFILES[profile];
  const originalBytes = input.length;

  if (mime === "image/svg+xml") {
    const clean = sanitizeSvg(input.toString("utf8"));
    const buf = Buffer.from(clean, "utf8");
    return {
      buffer: buf,
      ext: ".svg",
      contentType: "image/svg+xml",
      width: 0,
      height: 0,
      originalBytes,
      optimizedBytes: buf.length,
    };
  }

  const meta = await safeMetadata(input);
  if (!meta) {
    // Not a format sharp can parse — return untouched so the caller can
    // decide (upload route rejects unknown types; from-url route rejects
    // non-images before ever calling this function).
    return {
      buffer: input,
      ext: guessExtFromMime(mime),
      contentType: mime,
      width: 0,
      height: 0,
      originalBytes,
      optimizedBytes: originalBytes,
    };
  }

  const isAnimated = Boolean(meta.pages && meta.pages > 1);

  if (isAnimated) {
    try {
      const animated = sharp(input, { animated: true }).resize({
        width: spec.maxWidth,
        height: spec.maxHeight,
        fit: spec.fit,
        withoutEnlargement: true,
      });
      const buf = await animated.webp({ quality: 70, effort: 4 }).toBuffer();
      // Only use the re-encode if it's actually smaller; animated re-encodes
      // occasionally balloon for short/simple GIFs.
      if (buf.length < originalBytes) {
        const outMeta = await safeMetadata(buf);
        return {
          buffer: buf,
          ext: ".webp",
          contentType: "image/webp",
          width: outMeta?.width || 0,
          height: outMeta?.height || 0,
          originalBytes,
          optimizedBytes: buf.length,
        };
      }
    } catch {
      /* fall through to returning the original below */
    }
    return {
      buffer: input,
      ext: guessExtFromMime(mime),
      contentType: mime,
      width: meta.width || 0,
      height: meta.height || 0,
      originalBytes,
      optimizedBytes: originalBytes,
    };
  }

  // Static raster image: resize + strip metadata + convert + iteratively
  // reduce quality until under the target byte budget.
  const resized = sharp(input)
    .rotate() // auto-orient from EXIF, then metadata (including that EXIF) is dropped
    .resize({
      width: spec.maxWidth,
      height: spec.maxHeight,
      fit: spec.fit,
      withoutEnlargement: true,
    });

  let buf: Buffer;
  if (spec.format === "png") {
    buf = await resized.clone().png({ compressionLevel: 9, effort: 10, palette: true, quality: 90 }).toBuffer();
    // PNG has no quality knob that reliably shrinks further without visible
    // banding; if it's still oversized, fall back to a slightly lossier
    // palette to bring it down.
    if (buf.length > spec.targetBytes) {
      buf = await resized.clone().png({ compressionLevel: 9, effort: 10, palette: true, quality: 70, colors: 128 }).toBuffer();
    }
  } else {
    let quality = 82;
    buf = await resized.clone().webp({ quality, effort: 4 }).toBuffer();
    while (buf.length > spec.targetBytes && quality > 35) {
      quality -= 12;
      buf = await resized.clone().webp({ quality, effort: 4 }).toBuffer();
    }
  }

  const outMeta = await safeMetadata(buf);
  return {
    buffer: buf,
    ext: spec.format === "png" ? ".png" : ".webp",
    contentType: spec.format === "png" ? "image/png" : "image/webp",
    width: outMeta?.width || 0,
    height: outMeta?.height || 0,
    originalBytes,
    optimizedBytes: buf.length,
  };
}

/* ---------------------------- SSRF-safe fetch ---------------------------- */

function ip4(s: string): number {
  const [a, b, c, d] = s.split(".").map(Number);
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

const PRIVATE_V4_RANGES: [number, number][] = [
  [ip4("0.0.0.0"), ip4("0.255.255.255")],
  [ip4("10.0.0.0"), ip4("10.255.255.255")],
  [ip4("100.64.0.0"), ip4("100.127.255.255")], // CGNAT
  [ip4("127.0.0.0"), ip4("127.255.255.255")],
  [ip4("169.254.0.0"), ip4("169.254.255.255")], // link-local
  [ip4("172.16.0.0"), ip4("172.31.255.255")],
  [ip4("192.0.0.0"), ip4("192.0.0.255")],
  [ip4("192.168.0.0"), ip4("192.168.255.255")],
  [ip4("198.18.0.0"), ip4("198.19.255.255")],
  [ip4("224.0.0.0"), ip4("255.255.255.255")], // multicast/reserved
];

function isPrivateIpv4(ip: string): boolean {
  const n = ip4(ip);
  return PRIVATE_V4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower.startsWith("fe80:") || // link-local
    lower.startsWith("fc") ||
    lower.startsWith("fd") || // unique local
    lower.startsWith("::ffff:127.") ||
    lower.startsWith("::ffff:10.") ||
    lower.startsWith("::ffff:192.168.")
  );
}

/**
 * Resolves the hostname and rejects it if it points at a private / loopback
 * / link-local / cloud-metadata address — the standard SSRF defence for
 * "fetch a URL the user gave us" endpoints. Also rejects non-http(s)
 * protocols and obviously-internal hostnames outright without a DNS call.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "169.254.169.254" // cloud metadata endpoint (AWS/GCP/Azure)
  ) {
    throw new Error("This URL points to a restricted address");
  }
  const ipKind = net.isIP(host);
  if (ipKind) {
    if (ipKind === 4 && isPrivateIpv4(host)) throw new Error("This URL points to a private address");
    if (ipKind === 6 && isPrivateIpv6(host)) throw new Error("This URL points to a private address");
    return url;
  }
  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new Error("Could not resolve host");
  }
  for (const r of records) {
    if (r.family === 4 && isPrivateIpv4(r.address)) throw new Error("This URL resolves to a private address");
    if (r.family === 6 && isPrivateIpv6(r.address)) throw new Error("This URL resolves to a private address");
  }
  return url;
}

const MAX_REMOTE_BYTES = 20 * 1024 * 1024; // 20MB ceiling on what we'll download
const FETCH_TIMEOUT_MS = 15_000;

function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 5).trim().startsWith("<?xml") || buf.toString("ascii", 0, 4) === "<svg") return "image/svg+xml";
  return null;
}

/**
 * Downloads a remote image with SSRF protection, a realistic browser
 * User-Agent (many free image hosts block generic/bot user agents via
 * hotlink protection — this is a leading cause of images "not showing"
 * when a pasted URL is hotlinked directly), a hard timeout, and a byte
 * ceiling to avoid abuse.
 */
const MAX_REDIRECTS = 5;

export async function fetchRemoteImage(rawUrl: string): Promise<{ buffer: Buffer; mime: string }> {
  let url = await assertPublicHttpUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    // `redirect: "manual"` + a loop that re-validates every hop through
    // assertPublicHttpUrl. With `redirect: "follow"`, fetch() only checks
    // the URL we pass in — a URL that first resolves to a public host but
    // then issues a 302 to http://169.254.169.254/... (cloud metadata) or
    // http://127.0.0.1/... would be followed straight through, completely
    // bypassing the SSRF check below. Validating each Location header
    // closes that gap.
    let hops = 0;
    for (;;) {
      res = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });
      const isRedirect = res.status >= 300 && res.status < 400;
      const location = res.headers.get("location");
      if (!isRedirect || !location) break;
      if (++hops > MAX_REDIRECTS) throw new Error("Too many redirects fetching that URL");
      const next = new URL(location, url);
      url = await assertPublicHttpUrl(next.toString());
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error("Timed out fetching the image");
    if (err instanceof Error && /restricted|private|resolve|redirects|Invalid URL|http\/https/i.test(err.message)) {
      throw err;
    }
    throw new Error("Could not reach that URL");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Image host returned ${res.status}`);

  const lenHeader = res.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_REMOTE_BYTES) {
    throw new Error("Image is too large (max 20MB)");
  }

  const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();

  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_REMOTE_BYTES) throw new Error("Image is too large (max 20MB)");
  const buffer = Buffer.from(arrayBuf);

  // Some hosts omit/lie about content-type; sniff the magic bytes as a
  // fallback so a mislabeled JPEG etc. still gets processed correctly.
  const mime = isImageMime(contentType) ? contentType : sniffImageMime(buffer) || contentType;
  if (!isImageMime(mime)) throw new Error("That URL did not return an image");

  return { buffer, mime };
}
