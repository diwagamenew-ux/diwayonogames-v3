import { db } from "@/db";
import { pages } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { json, requirePerm, checkOrigin, asStr, asInt, asBool } from "@/lib/api";
import { uniqueSlug } from "@/lib/slug";
import { cleanHtml, cleanText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requirePerm("pages");
  if (auth instanceof Response) return auth;
  const rows = await db.select().from(pages).orderBy(asc(pages.title));
  return json({ pages: rows });
}

export async function POST(req: Request) {
  const auth = await requirePerm("pages");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => ({}));
  const title = cleanText(asStr(body.title, 200));
  if (!title) return json({ error: "Title required" }, 400);
  const slug = body.slug ? await uniqueSlug("pages", asStr(body.slug, 120)) : await uniqueSlug("pages", title);
  const [created] = await db
    .insert(pages)
    .values({
      title, slug,
      content: cleanHtml(asStr(body.content, 200_000)),
      metaTitle: cleanText(asStr(body.metaTitle, 200)) || title,
      metaDescription: cleanText(asStr(body.metaDescription, 300)),
      h1: cleanText(asStr(body.h1, 200)),
      focusKeyword: cleanText(asStr(body.focusKeyword, 120)),
      canonicalUrl: asStr(body.canonicalUrl, 500),
      ogTitle: cleanText(asStr(body.ogTitle, 200)),
      ogDescription: cleanText(asStr(body.ogDescription, 300)),
      ogImage: asStr(body.ogImage, 500),
      twitterTitle: cleanText(asStr(body.twitterTitle, 200)),
      twitterDescription: cleanText(asStr(body.twitterDescription, 300)),
      twitterImage: asStr(body.twitterImage, 500),
      noIndex: asBool(body.noIndex),
      noFollow: asBool(body.noFollow),
    })
    .returning();
  await logAudit({ action: "create", entity: "page", entityId: created.id, summary: created.title, req, session: auth });
  return json({ ok: true, page: created }, 201);
}

export async function PUT(req: Request) {
  const auth = await requirePerm("pages");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => ({}));
  const id = asInt(body.id);
  const title = cleanText(asStr(body.title, 200));
  if (!id || !title) return json({ error: "Invalid data" }, 400);
  const slug = body.slug ? await uniqueSlug("pages", asStr(body.slug, 120), id) : await uniqueSlug("pages", title, id);
  const [updated] = await db
    .update(pages)
    .set({
      title, slug,
      content: cleanHtml(asStr(body.content, 200_000)),
      metaTitle: cleanText(asStr(body.metaTitle, 200)),
      metaDescription: cleanText(asStr(body.metaDescription, 300)),
      h1: cleanText(asStr(body.h1, 200)),
      focusKeyword: cleanText(asStr(body.focusKeyword, 120)),
      canonicalUrl: asStr(body.canonicalUrl, 500),
      ogTitle: cleanText(asStr(body.ogTitle, 200)),
      ogDescription: cleanText(asStr(body.ogDescription, 300)),
      ogImage: asStr(body.ogImage, 500),
      twitterTitle: cleanText(asStr(body.twitterTitle, 200)),
      twitterDescription: cleanText(asStr(body.twitterDescription, 300)),
      twitterImage: asStr(body.twitterImage, 500),
      noIndex: asBool(body.noIndex),
      noFollow: asBool(body.noFollow),
      updatedAt: new Date(),
    })
    .where(eq(pages.id, id))
    .returning();
  await logAudit({ action: "update", entity: "page", entityId: id, summary: updated?.title || "", req, session: auth });
  return json({ ok: true, page: updated });
}

export async function DELETE(req: Request) {
  const auth = await requirePerm("pages");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const id = asInt(new URL(req.url).searchParams.get("id"));
  if (!id) return json({ error: "id required" }, 400);
  const [existing] = await db.select({ title: pages.title }).from(pages).where(eq(pages.id, id)).limit(1);
  await db.delete(pages).where(eq(pages.id, id));
  await logAudit({ action: "delete", entity: "page", entityId: id, summary: existing?.title || "", req, session: auth });
  return json({ ok: true });
}
