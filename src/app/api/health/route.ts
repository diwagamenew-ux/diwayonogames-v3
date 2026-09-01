import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Health checks must be read-only. This endpoint is polled repeatedly by
  // the hosting platform / uptime monitors — it previously triggered a
  // "heal" path that could run DROP SCHEMA public CASCADE on nothing more
  // than a transient connection blip, which was the root cause of data
  // silently disappearing. It now only reports status and never mutates
  // the database.
  try {
    const res = await db.execute(
      sql`SELECT to_regclass('public.users') AS u, to_regclass('public.games') AS g`
    );
    const row = (res.rows?.[0] ?? {}) as { u: string | null; g: string | null };
    if (!row.u || !row.g) {
      return Response.json({ ok: false, reason: "core tables not found" }, { status: 503 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, reason: "db unreachable" }, { status: 503 });
  }
}
