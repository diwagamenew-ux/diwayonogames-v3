import { db } from "@/db";
import { tags, gameTags } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { json, requirePerm, checkOrigin, asStr, asInt } from "@/lib/api";
import { uniqueSlug } from "@/lib/slug";
import { cleanText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requirePerm("tags");
  if (auth instanceof Response) return auth;
  const rows = await db
    .select({
      tag: tags,
      count: sql<number>`(select count(*) from ${gameTags} where ${gameTags.tagId} = ${tags.id})::int`,
    })
    .from(tags)
    .orderBy(asc(tags.name));
  return json({ tags: rows.map((r) => ({ ...r.tag, count: r.count })) });
}

export async function POST(req: Request) {
  const auth = await requirePerm("tags");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => ({}));
  const name = cleanText(asStr(body.name, 80));
  if (!name) return json({ error: "Name required" }, 400);
  const slug = body.slug ? await uniqueSlug("tags", asStr(body.slug, 80)) : await uniqueSlug("tags", name);
  const [created] = await db.insert(tags).values({
    name, slug,
    metaTitle: cleanText(asStr(body.metaTitle, 200)),
    metaDescription: cleanText(asStr(body.metaDescription, 300)),
    h1: cleanText(asStr(body.h1, 200)),
    focusKeyword: cleanText(asStr(body.focusKeyword, 120)),
    canonicalUrl: asStr(body.canonicalUrl, 500),
    noIndex: body.noIndex === undefined ? true : Boolean(body.noIndex),
    noFollow: Boolean(body.noFollow),
  }).returning();
  await logAudit({ action: "create", entity: "tag", entityId: created.id, summary: created.name, req, session: auth });
  return json({ ok: true, tag: created }, 201);
}

export async function PUT(req: Request) {
  const auth = await requirePerm("tags");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => ({}));
  const id = asInt(body.id);
  const name = cleanText(asStr(body.name, 80));
  if (!id || !name) return json({ error: "Invalid data" }, 400);
  const slug = body.slug ? await uniqueSlug("tags", asStr(body.slug, 80), id) : await uniqueSlug("tags", name, id);
  const [updated] = await db.update(tags).set({
    name, slug,
    metaTitle: cleanText(asStr(body.metaTitle, 200)),
    metaDescription: cleanText(asStr(body.metaDescription, 300)),
    h1: cleanText(asStr(body.h1, 200)),
    focusKeyword: cleanText(asStr(body.focusKeyword, 120)),
    canonicalUrl: asStr(body.canonicalUrl, 500),
    noIndex: Boolean(body.noIndex),
    noFollow: Boolean(body.noFollow),
  }).where(eq(tags.id, id)).returning();
  await logAudit({ action: "update", entity: "tag", entityId: id, summary: updated?.name || "", req, session: auth });
  return json({ ok: true, tag: updated });
}

export async function DELETE(req: Request) {
  const auth = await requirePerm("tags");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const id = asInt(new URL(req.url).searchParams.get("id"));
  if (!id) return json({ error: "id required" }, 400);
  const [existing] = await db.select({ name: tags.name }).from(tags).where(eq(tags.id, id)).limit(1);
  await db.delete(tags).where(eq(tags.id, id));
  await logAudit({ action: "delete", entity: "tag", entityId: id, summary: existing?.name || "", req, session: auth });
  return json({ ok: true });
}
