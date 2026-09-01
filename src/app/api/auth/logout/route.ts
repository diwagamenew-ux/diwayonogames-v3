import { destroySession, getSession } from "@/lib/auth";
import { json } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function POST() {
  // getSession() is read-only (verifies the JWT, no DB call) and
  // destroySession() only deletes a cookie — neither touches Postgres, so
  // this route was never actually at risk from the pool issue that broke
  // login. It's wrapped anyway so a logout attempt can never leave the
  // client without a valid JSON response, and so any future change to
  // this route inherits the same safety by default.
  try {
    const session = await getSession();
    await destroySession();
    if (session) {
      await logAudit({
        action: "logout",
        entity: "user",
        entityId: session.id,
        summary: `${session.email} signed out`,
        session,
      });
    }
    return json({ ok: true });
  } catch (err) {
    console.error("[api/auth/logout] unexpected error during sign-out:", err);
    // Best-effort: the cookie deletion above (or a retry) is what actually
    // matters for the user; report success either way since there is no
    // partial/corrupt state a failed logout could leave behind (there's no
    // server-side session record — only the cookie, which is deleted by a
    // plain Set-Cookie, an operation that cannot partially fail).
    return json({ ok: true });
  }
}
