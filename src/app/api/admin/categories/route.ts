import { db } from "@/db";
import { categories } from "@/db/schema";
import { json, requirePerm, checkOrigin, asStr, asInt, asBool } from "@/lib/api";
import { uniqueSlug } from "@/lib/slug";
import { cleanText } from "@/lib/sanitize";
import { asc, eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { revalidateCategoryPaths } from "@/lib/revalidate";

export async function GET() {
  const auth = await requirePerm("categories");
  if (auth instanceof Response) return auth;
  const rows = await db.select().from(categories).orderBy(asc(categories.name));
  return json({ categories: rows });
}

export async function POST(req: Request) {
  const auth = await requirePerm("categories");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => ({}));
  const name = cleanText(asStr(body.name, 120));
  if (!name) return json({ error: "Name required" }, 400);
  const slug = body.slug
    ? await uniqueSlug("categories", asStr(body.slug, 120))
    : await uniqueSlug("categories", name);
  const [created] = await db
    .insert(categories)
    .values({
      name, slug,
      description: cleanText(asStr(body.description, 1000)),
      icon: asStr(body.icon, 500),
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
    })
    .returning();
  await logAudit({ action: "create", entity: "category", entityId: created.id, summary: created.name, req, session: auth });
  revalidateCategoryPaths({ slug: created.slug });
  return json({ ok: true, category: created }, 201);
}

export async function PUT(req: Request) {
  const auth = await requirePerm("categories");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => ({}));
  const id = asInt(body.id);
  const name = cleanText(asStr(body.name, 120));
  if (!id || !name) return json({ error: "Invalid data" }, 400);
  const [before] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, id)).limit(1);
  const slug = body.slug
    ? await uniqueSlug("categories", asStr(body.slug, 120), id)
    : await uniqueSlug("categories", name, id);
  const [updated] = await db
    .update(categories)
    .set({
      name, slug,
      description: cleanText(asStr(body.description, 1000)),
      icon: asStr(body.icon, 500),
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
    })
    .where(eq(categories.id, id))
    .returning();
  await logAudit({ action: "update", entity: "category", entityId: id, summary: updated?.name || "", req, session: auth });
  revalidateCategoryPaths({ slug: updated?.slug, prevSlug: before?.slug });
  return json({ ok: true, category: updated });
}

export async function DELETE(req: Request) {
  const auth = await requirePerm("categories");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const id = asInt(new URL(req.url).searchParams.get("id"));
  if (!id) return json({ error: "id required" }, 400);
  const [existing] = await db.select({ name: categories.name, slug: categories.slug }).from(categories).where(eq(categories.id, id)).limit(1);
  await db.delete(categories).where(eq(categories.id, id));
  await logAudit({ action: "delete", entity: "category", entityId: id, summary: existing?.name || "", req, session: auth });
  revalidateCategoryPaths({ slug: existing?.slug });
  return json({ ok: true });
}
