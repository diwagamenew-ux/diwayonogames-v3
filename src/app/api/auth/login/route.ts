import { signIn, createSession } from "@/lib/auth";
import { json, checkOrigin } from "@/lib/api";
import { rateLimit, getClientIp } from "@/lib/util";
import { logAudit } from "@/lib/audit";
import { loginSchema } from "@/lib/validation";

export async function POST(req: Request) {
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const ip = getClientIp(req);
  if (!rateLimit("login:" + ip, 10, 5 * 60_000)) {
    return json({ error: "Too many attempts. Try again later." }, 429);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Email and a password are required" }, 400);
  }
  const { email, password } = parsed.data;

  // Everything below touches the database (signIn reads `users`, logAudit
  // writes `audit_logs`) and previously had no try/catch. A transient
  // connection error here — including the class of pool "idle client"
  // error now handled in src/db/index.ts — would otherwise propagate as
  // an UNCAUGHT exception out of this Route Handler. Next.js's default
  // handling for that does not guarantee a JSON body, so the frontend's
  // `await res.json()` would throw, which is exactly what surfaced to
  // users as a generic, unhelpful "Network error". This try/catch
  // guarantees three things instead: (1) the real error always reaches
  // the server logs with full detail, (2) the client always gets back
  // parseable JSON, (3) a transient DB hiccup on ONE login attempt never
  // corrupts anything for the next attempt.
  try {
    const user = await signIn(email, password);
    if (!user) return json({ error: "Invalid credentials" }, 401);
    await createSession(user, req);
    await logAudit({
      action: "login",
      entity: "user",
      entityId: user.id,
      summary: `${user.email} signed in`,
      req,
      session: user,
    });
    return json({ ok: true, user });
  } catch (err) {
    // Never swallow this — log the real exception (message + stack) so
    // it's visible in `vercel logs` / the Vercel dashboard's Runtime Logs,
    // not just "500". Include enough context to correlate with a specific
    // attempt without logging the password.
    console.error("[api/auth/login] unexpected error during sign-in:", {
      email,
      ip,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return json({ error: "Something went wrong signing you in. Please try again." }, 500);
  }
}
