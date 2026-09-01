import { db } from "@/db";
import { games, categories, gameTags, downloadLinks, redirects, type FaqItem } from "@/db/schema";
import { eq } from "drizzle-orm";
import { json, requirePerm, checkOrigin, asStr, asInt, asBool, asFloat } from "@/lib/api";
import { uniqueSlug } from "@/lib/slug";
import { cleanHtml, cleanText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";
import { revalidateGamePaths } from "@/lib/revalidate";
import { clampRating } from "@/lib/util";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePerm("games");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);

  const { id } = await ctx.params;
  const gameId = asInt(id);
  const body = await req.json().catch(() => ({}));
  const title = cleanText(asStr(body.title, 200));
  if (!gameId || !title) return json({ error: "Invalid data" }, 400);

  const [before] = await db.select({ slug: games.slug, categoryId: games.categoryId }).from(games).where(eq(games.id, gameId)).limit(1);

  const slug = body.slug
    ? await uniqueSlug("games", asStr(body.slug, 120), gameId)
    : await uniqueSlug("games", title, gameId);
  const content = cleanHtml(asStr(body.content, 200_000));

  const [updated] = await db
    .update(games)
    .set({
      title, slug,
      shortDesc: cleanText(asStr(body.shortDesc, 500)),
      content,
      icon: asStr(body.icon, 500), banner: asStr(body.banner, 500),
      version: cleanText(asStr(body.version, 40)) || "1.0",
      size: cleanText(asStr(body.size, 40)),
      developer: cleanText(asStr(body.developer, 120)),
      packageName: cleanText(asStr(body.packageName, 120)),
      minAndroid: cleanText(asStr(body.minAndroid, 20)) || "5.0+",
      bonus: cleanText(asStr(body.bonus, 120)),
      categoryId: asInt(body.categoryId) || null,
      featured: asBool(body.featured),
      status: asStr(body.status, 20) === "draft" ? "draft" : "published",
      metaTitle: cleanText(asStr(body.metaTitle, 200)),
      metaDescription: cleanText(asStr(body.metaDescription, 300)),
      focusKeyword: cleanText(asStr(body.focusKeyword, 120)),
      canonicalUrl: asStr(body.canonicalUrl, 500),
      noIndex: asBool(body.noIndex),
      faqs: Array.isArray(body.faqs)
        ? (body.faqs as FaqItem[])
            .map((f) => ({ q: cleanText(String(f?.q || "")), a: cleanText(String(f?.a || "")) }))
            .filter((f) => f.q && f.a)
            .slice(0, 20)
        : [],
      editorialRating: clampRating(asFloat(body.editorialRating)),
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId))
    .returning();
  if (!updated) return json({ error: "Not found" }, 404);

  // Preserve SEO when an existing public game slug changes. The old URL is
  // automatically redirected instead of becoming a dead link.
  if (before?.slug && before.slug !== updated.slug) {
    await db.insert(redirects).values({
      fromPath: `/game/${before.slug}`,
      toPath: `/game/${updated.slug}`,
      statusCode: 301,
    }).onConflictDoNothing();
  }

  // Replace tags
  await db.delete(gameTags).where(eq(gameTags.gameId, gameId));
  const tagIds: number[] = Array.isArray(body.tagIds)
    ? [...new Set((body.tagIds as unknown[]).map((t) => asInt(t)).filter((n) => n > 0))]
    : [];
  const newNames: string[] = Array.isArray(body.newTags) ? (body.newTags as string[]) : [];
  const { tags } = await import("@/db/schema");
  for (const name of newNames.slice(0, 10)) {
    const clean = cleanText(String(name)).slice(0, 60);
    if (!clean) continue;
    const tSlug = await uniqueSlug("tags", clean);
    const [row] = await db.insert(tags).values({ name: clean, slug: tSlug }).onConflictDoNothing().returning();
    if (row) tagIds.push(row.id);
    else {
      const [found] = await db.select().from(tags).where(eq(tags.slug, tSlug)).limit(1);
      if (found) tagIds.push(found.id);
    }
  }
  if (tagIds.length) {
    await db
      .insert(gameTags)
      .values([...new Set(tagIds)].map((tagId) => ({ gameId, tagId })))
      .onConflictDoNothing();
  }

  // Replace download links
  await db.delete(downloadLinks).where(eq(downloadLinks.gameId, gameId));
  const links = Array.isArray(body.links) ? (body.links as Record<string, unknown>[]) : [];
  const validLinks = links
    .map((l, i) => ({
      gameId,
      label: cleanText(asStr(l.label, 120)) || "Download APK",
      url: asStr(l.url, 1000),
      version: cleanText(asStr(l.version, 40)),
      size: cleanText(asStr(l.size, 40)),
      sort: i,
    }))
    .filter((l) => l.url);
  if (validLinks.length) await db.insert(downloadLinks).values(validLinks);

  await logAudit({ action: "update", entity: "game", entityId: gameId, summary: updated.title, req, session: auth });

  const slugFor = async (catId: number | null | undefined) => {
    if (!catId) return undefined;
    const [cat] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, catId)).limit(1);
    return cat?.slug;
  };
  revalidateGamePaths({
    slug: updated.slug,
    prevSlug: before?.slug,
    categorySlug: await slugFor(updated.categoryId),
    prevCategorySlug: await slugFor(before?.categoryId ?? null),
  });

  return json({ ok: true, game: updated });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePerm("games");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const { id } = await ctx.params;
  const gameId = asInt(id);
  const [existing] = await db.select({ title: games.title, slug: games.slug, categoryId: games.categoryId }).from(games).where(eq(games.id, gameId)).limit(1);
  await db.delete(games).where(eq(games.id, gameId));
  await logAudit({ action: "delete", entity: "game", entityId: gameId, summary: existing?.title || "", req, session: auth });

  let categorySlug: string | undefined;
  if (existing?.categoryId) {
    const [cat] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, existing.categoryId)).limit(1);
    categorySlug = cat?.slug;
  }
  revalidateGamePaths({ slug: existing?.slug, categorySlug });

  return json({ ok: true });
}
