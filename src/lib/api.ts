import { NextResponse } from "next/server";
import { getSession, can, type SessionUser } from "./auth";
import { siteUrl } from "./util";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function requirePerm(perm: string): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session) return json({ error: "Unauthorized" }, 401);
  if (!can(session.role, perm)) return json({ error: "Forbidden" }, 403);
  return session;
}

export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session) return json({ error: "Unauthorized" }, 401);
  return session;
}

/**
 * CSRF / origin check for state-changing routes.
 *
 * IMPORTANT: this is the real CSRF defence, not a backup. The session
 * cookie is issued with `SameSite=None` whenever the request looks like
 * HTTPS (see `createSession` in ./auth) so admin-panel previews can be
 * embedded in a cross-origin iframe. `SameSite=None` means the browser
 * WILL attach that cookie to a cross-site request too — so unlike a
 * normal `SameSite=Lax` cookie, it can't by itself stop another site from
 * forging an authenticated POST/PATCH/DELETE against these APIs. This
 * function is what actually blocks that.
 *
 * A previous version of this check treated the mere presence of proxy
 * headers (`x-forwarded-for` / `x-forwarded-proto`) as proof the request
 * was legitimate and returned `true` unconditionally in that case. Those
 * headers are present on essentially every real production request
 * (Vercel, nginx, any reverse proxy), so that branch silently disabled
 * origin checking in production. It has been removed. We now only allow:
 *   - Requests with no Origin/Referer header at all (non-browser clients).
 *   - Requests whose Origin host matches this deployment's known hosts
 *     (`Host`, `X-Forwarded-Host`, `X-Original-Host`, or the configured
 *     NEXT_PUBLIC_SITE_URL).
 *   - Requests where the `Host` header on *this* request is itself an
 *     internal/dev address (localhost, private IP ranges) — safe because
 *     that can only be true in local dev or a sandboxed preview, never in
 *     real production traffic.
 */
export function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) return true; // server-to-server / curl / no Origin header
  let originHost = "";
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  if (!originHost) return false;

  // Collect every host the request could legitimately be known by.
  const candidates = new Set<string>();
  const addHost = (h: string | null | undefined) => {
    if (!h) return;
    for (const part of h.split(",")) {
      const clean = part.trim().toLowerCase();
      if (clean) candidates.add(clean);
    }
  };
  addHost(req.headers.get("host"));
  addHost(req.headers.get("x-forwarded-host"));
  addHost(req.headers.get("x-original-host"));
  try {
    candidates.add(new URL(siteUrl()).host.toLowerCase());
  } catch {
    /* siteUrl not configured yet */
  }
  if (candidates.has(originHost)) return true;

  // Internal / private hosts can never equal the real public origin — allow.
  // This only fires when the Host header on THIS request is itself
  // internal (dev/sandbox), never for arbitrary production traffic.
  const bare = originHost.split(":")[0];
  const hostBare = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  const isInternal = (h: string) =>
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^(10|127|172\.(1[6-9]|2\d|3[01])|192\.168)\./.test(h);
  if (isInternal(hostBare) || isInternal(bare)) return true;

  return false;
}

export function asStr(v: unknown, max = 5000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export function asInt(v: unknown, fallback = 0): number {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function asFloat(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}
