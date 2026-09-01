export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function formatNumber(n: number | null | undefined): string {
  // Defensive: a missing stat must never render the literal string
  // "undefined" / "NaN" / "null" — that looks like a broken page.
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(v);
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function excerptFromHtml(html: string, len = 160) {
  const t = stripHtml(html);
  return t.length > len ? t.slice(0, len).trimEnd() + "…" : t;
}

export function readingTime(html: string) {
  const words = stripHtml(html).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/* ---------------------- Simple in-memory rate limiter ---------------------- */
// Note: this state is per Node process. On serverless (Vercel) each
// instance recycles often so this never grows large. On a long-running
// host (DreamHost/PM2/Docker) the process stays up indefinitely, and every
// distinct key (one per client IP, per limited action) used to stay in
// this Map forever — a slow, unbounded memory leak. We now sweep expired
// entries periodically and hard-cap the map as a backstop.
const buckets = new Map<string, { count: number; reset: number }>();
const MAX_BUCKETS = 50_000;
const SWEEP_INTERVAL_MS = 10 * 60_000;
let lastSweep = Date.now();

function sweepExpiredBuckets(now: number) {
  for (const [key, b] of buckets) {
    if (b.reset < now) buckets.delete(key);
  }
  // Backstop: if something still pushes the map past the cap (e.g. a
  // distributed-IP flood), drop the oldest entries rather than grow
  // unbounded. Map preserves insertion order, so the first keys are the
  // oldest.
  if (buckets.size > MAX_BUCKETS) {
    const excess = buckets.size - MAX_BUCKETS;
    let i = 0;
    for (const key of buckets.keys()) {
      if (i++ >= excess) break;
      buckets.delete(key);
    }
  }
  lastSweep = now;
}

export function rateLimit(key: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  if (now - lastSweep > SWEEP_INTERVAL_MS) sweepExpiredBuckets(now);

  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

export function getClientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

export function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000"
  );
}

/** Canonical site URL from the database-backed Site Settings, with the
 * deployment environment as a safe fallback. */
export function configuredSiteUrl(settings?: { siteUrl?: string } | null) {
  const raw = settings?.siteUrl?.trim() || siteUrl();
  try {
    const u = new URL(raw);
    return u.toString().replace(/\/$/, "");
  } catch {
    return siteUrl();
  }
}

export function absoluteUrl(pathOrUrl: string, base?: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${(base || siteUrl()).replace(/\/$/, "")}/${pathOrUrl.replace(/^\//, "")}`;
}

/** very light math captcha check: token is "a:b", answer must equal a+b */
export function verifyCaptcha(token: string, answer: string) {
  const [a, b] = (token || "").split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return String(a + b) === String(answer).trim();
}

export function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Clamp an editorial rating to a sane 0–5 range with one decimal place. */
export function clampRating(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(5, n)) * 10) / 10;
}

/**
 * Which rating to show for a game card/page, and whether it's a real
 * user-review average or the site's own editorial score. Real user ratings
 * (derived from approved reviews — see recomputeGameRating) always take
 * priority; the editorial rating only shows when there isn't a real one yet,
 * and is always reported as `editorial: true` so callers can label it
 * "Editorial Rating" rather than presenting it as user feedback.
 */
export function displayRating(g: { rating: number; ratingCount: number; editorialRating?: number | null }): {
  value: number; editorial: boolean;
} {
  if (g.ratingCount > 0) return { value: g.rating, editorial: false };
  if ((g.editorialRating ?? 0) > 0) return { value: g.editorialRating as number, editorial: true };
  return { value: 0, editorial: false };
}
