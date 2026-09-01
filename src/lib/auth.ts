import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { type SessionUser } from "./roles";

export { can, ROLE_PERMS, type SessionUser } from "./roles";

const COOKIE = "av_session";

// AUTH_SECRET signs the admin session JWT. The fallback below exists only
// so `npm run dev` works with zero setup — but it is committed in this
// public repo, so anyone can read it and forge a valid admin session for
// any deployment that ends up using it. Refusing to boot in production
// without a real secret turns "forgotten env var" into a loud startup
// crash instead of a silent, exploitable auth bypass.
const FALLBACK_DEV_SECRET = "yonodiwagames-dev-secret-change-in-production";
if (process.env.NODE_ENV === "production") {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET === FALLBACK_DEV_SECRET) {
    throw new Error(
      "AUTH_SECRET is not set (or still the placeholder value). Set a long random " +
        "string (e.g. `openssl rand -base64 48`) in your production environment " +
        "variables before deploying — admin sessions cannot be signed securely without it."
    );
  }
  if (process.env.AUTH_SECRET.length < 32) {
    throw new Error("AUTH_SECRET is too short — use at least 32 random characters.");
  }
}
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || FALLBACK_DEV_SECRET);

export async function signIn(email: string, password: string): Promise<SessionUser | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function createSession(user: SessionUser, req?: Request) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  const jar = await cookies();

  // Decide cookie flags so the session works in every topology the app
  // runs in — localhost dev, Vercel, DreamHost with TLS, and sandboxed
  // previews that embed the admin panel in a cross-origin iframe (which
  // browsers silently drop `SameSite=Lax` cookies from, unless paired
  // with `Secure` + `SameSite=None`).
  //
  // Next.js's internal server almost always speaks plain HTTP even in
  // production (a reverse proxy — Vercel's edge, nginx, this sandbox's
  // ingress — terminates TLS in front of it), so `req.url`'s own scheme
  // is NOT a reliable signal here; it will read "http" even when the
  // public-facing request was HTTPS. We trust `x-forwarded-proto`
  // instead, which every proxy in our supported deployment targets sets.
  //
  // Priority:
  //   1. x-forwarded-proto header (set by Vercel / nginx / sandbox ingress)
  //   2. Known localhost host without that header → plain local dev, insecure
  //   3. Anything else → default to secure=true. This is the safer bias:
  //      almost every real deployment target is HTTPS, and guessing
  //      "secure" wrongly only fails on the rare plain-HTTP-with-a-real-
  //      domain case, whereas guessing "insecure" wrongly silently drops
  //      the cookie in *every* iframe-embedded preview — a far more
  //      common and much harder to diagnose failure.
  const hdrs = await headers();
  const hostHdr = (hdrs.get("host") || "").toLowerCase();
  const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(hostHdr);
  const xfp = (hdrs.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();

  let secure: boolean;
  if (xfp === "http" || xfp === "https") {
    secure = xfp === "https";
  } else if (isLocalHost) {
    secure = false;
  } else {
    secure = true;
  }
  void req; // kept in the signature for future use (e.g. explicit URL override); not needed for the proto decision.

  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: Number(payload.id),
      name: String(payload.name || ""),
      email: String(payload.email || ""),
      role: String(payload.role || ""),
    };
  } catch {
    return null;
  }
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
