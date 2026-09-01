import { db } from "@/db";
import { users } from "@/db/schema";
import { asc, eq, ne, and } from "drizzle-orm";
import { json, requirePerm, checkOrigin, asStr, asInt } from "@/lib/api";
import { hashPassword, type SessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const ROLES = ["admin", "editor", "author", "moderator"];

export async function GET() {
  const auth = await requirePerm("*");
  if (auth instanceof Response) return auth;
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.id));
  return json({ users: rows });
}

export async function POST(req: Request) {
  const auth = await requirePerm("*");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => ({}));
  const name = asStr(body.name, 120).trim();
  const email = asStr(body.email, 200).trim().toLowerCase();
  const password = asStr(body.password, 100);
  const role = ROLES.includes(body.role) ? body.role : "author";
  if (!name || !email || password.length < 6) {
    return json({ error: "Name, valid email and 6+ char password required" }, 400);
  }
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (exists) return json({ error: "Email already in use" }, 400);
  const [created] = await db
    .insert(users)
    .values({ name, email, role, passwordHash: await hashPassword(password) })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
  await logAudit({ action: "create", entity: "user", entityId: created.id, summary: `${created.email} (${created.role})`, req, session: auth });
  return json({ ok: true, user: created }, 201);
}

export async function PUT(req: Request) {
  const auth = await requirePerm("*");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => ({}));
  const id = asInt(body.id);
  const name = asStr(body.name, 120).trim();
  const role = ROLES.includes(body.role) ? body.role : "author";
  if (!id || !name) return json({ error: "Invalid data" }, 400);
  const set: Partial<typeof users.$inferInsert> = { name, role };
  const password = asStr(body.password, 100);
  if (password) {
    if (password.length < 6) return json({ error: "Password must be 6+ chars" }, 400);
    set.passwordHash = await hashPassword(password);
  }
  const [updated] = await db
    .update(users)
    .set(set)
    .where(eq(users.id, id))
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
  await logAudit({ action: "update", entity: "user", entityId: id, summary: `${updated?.email || ""} (${updated?.role || ""})`, req, session: auth });
  return json({ ok: true, user: updated });
}

export async function DELETE(req: Request) {
  const auth = await requirePerm("*");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const session = auth as SessionUser;
  const id = asInt(new URL(req.url).searchParams.get("id"));
  if (!id) return json({ error: "id required" }, 400);
  if (id === session.id) return json({ error: "You cannot delete your own account" }, 400);
  const [existing] = await db.select({ email: users.email }).from(users).where(eq(users.id, id)).limit(1);
  // keep posts author by setting null happens automatically (onDelete set null)
  await db.delete(users).where(and(eq(users.id, id), ne(users.id, session.id)));
  await logAudit({ action: "delete", entity: "user", entityId: id, summary: existing?.email || "", req, session });
  return json({ ok: true });
}
