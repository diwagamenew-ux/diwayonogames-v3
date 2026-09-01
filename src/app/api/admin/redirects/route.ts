import { db } from "@/db";
import { redirects, notFoundLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { json, requirePerm, checkOrigin, asStr, asInt } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requirePerm("redirects");
  if (auth instanceof Response) return auth;
  const rows = await db.select().from(redirects).orderBy(desc(redirects.id)).limit(500);
  const logs = await db.select().from(notFoundLogs).orderBy(desc(notFoundLogs.lastSeen)).limit(200);
  return json({ redirects: rows, notFound: logs });
}

export async function POST(req: Request) {
  const auth = await requirePerm("redirects");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => ({}));
  let fromPath = asStr(body.fromPath, 500).trim();
  const toPath = asStr(body.toPath, 500).trim();
  if (!fromPath.startsWith("/")) fromPath = "/" + fromPath;
  if (!fromPath || !toPath) return json({ error: "Both paths required" }, 400);
  const [created] = await db
    .insert(redirects)
    .values({ fromPath, toPath, statusCode: asInt(body.statusCode, 301) === 302 ? 302 : 301 })
    .onConflictDoNothing()
    .returning();
  if (!created) return json({ error: "Redirect for this path already exists" }, 400);
  await logAudit({ action: "create", entity: "redirect", entityId: created.id, summary: `${created.fromPath} → ${created.toPath}`, req, session: auth });
  return json({ ok: true, redirect: created }, 201);
}

export async function DELETE(req: Request) {
  const auth = await requirePerm("redirects");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const id = asInt(new URL(req.url).searchParams.get("id"));
  const kind = new URL(req.url).searchParams.get("kind") || "redirect";
  if (!id) return json({ error: "id required" }, 400);
  if (kind === "notfound") await db.delete(notFoundLogs).where(eq(notFoundLogs.id, id));
  else await db.delete(redirects).where(eq(redirects.id, id));
  await logAudit({ action: "delete", entity: kind === "notfound" ? "inbox" : "redirect", entityId: id, req, session: auth });
  return json({ ok: true });
}
