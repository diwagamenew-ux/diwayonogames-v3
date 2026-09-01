import { db } from "@/db";
import { games, categories, tags, gameTags, downloadLinks, type FaqItem } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { json, requirePerm, checkOrigin, asStr, asInt, asBool, asFloat } from "@/lib/api";
import { uniqueSlug } from "@/lib/slug";
import { cleanHtml, cleanText } from "@/lib/sanitize";
import { excerptFromHtml, clampRating } from "@/lib/util";
import { logAudit } from "@/lib/audit";
import { revalidateGamePaths } from "@/lib/revalidate";

export async function GET() {
  const auth = await requirePerm("games");
  if (auth instanceof Response) return auth;
  const rows = await db
    .select({ game: games, categoryName: categories.name })
    .from(games)
    .leftJoin(categories, eq(games.categoryId, categories.id))
    .orderBy(desc(games.updatedAt))
    .limit(500);
  return json({ games: rows.map((r) => ({ ...r.game, categoryName: r.categoryName })) });
}

function parseFaq(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => ({
      q: cleanText(asStr((f as FaqItem)?.q, 300)),
      a: cleanText(asStr((f as FaqItem)?.a, 1000)),
    }))
    .filter((f) => f.q && f.a)
    .slice(0, 20);
}

async function resolveTagIds(body: Record<string, unknown>): Promise<number[]> {
  const ids: number[] = Array.isArray(body.tagIds)
    ? (body.tagIds as unknown[]).map((t) => asInt(t)).filter((n) => n > 0)
    : [];
  const newNames: string[] = Array.isArray(body.newTags) ? (body.newTags as string[]) : [];
  for (const name of newNames.slice(0, 10)) {
    const clean = cleanText(String(name)).slice(0, 60);
    if (!clean) continue;
    const slug = await uniqueSlug("tags", clean);
    const [row] = await db
      .insert(tags)
      .values({ name: clean, slug })
      .onConflictDoNothing()
      .returning();
    if (row) ids.push(row.id);
    else {
      const [found] = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
      if (found) ids.push(found.id);
    }
  }
  return [...new Set(ids)];
}

export async function POST(req: Request) {
  const auth = await requirePerm("games");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);

  const body = await req.json().catch(() => ({}));
  const title = cleanText(asStr(body.title, 200));
  if (!title) return json({ error: "Title is required" }, 400);

  const slug = body.slug
    ? await uniqueSlug("games", asStr(body.slug, 120))
    : await uniqueSlug("games", title);
  const content = cleanHtml(asStr(body.content, 200_000));
  const shortDesc = cleanText(asStr(body.shortDesc, 500));
  const version = cleanText(asStr(body.version, 40)) || "1.0";

  const metaTitle =
    cleanText(asStr(body.metaTitle, 200)) ||
    `${title} APK Download (Latest Version ${version}) for Android`;
  const metaDescription =
    cleanText(asStr(body.metaDescription, 300)) ||
    (shortDesc || excerptFromHtml(content, 150));

  const [created] = await db
    .insert(games)
    .values({
      title, slug, shortDesc, content,
      icon: asStr(body.icon, 500), banner: asStr(body.banner, 500),
      version, size: cleanText(asStr(body.size, 40)),
      developer: cleanText(asStr(body.developer, 120)),
      packageName: cleanText(asStr(body.packageName, 120)),
      minAndroid: cleanText(asStr(body.minAndroid, 20)) || "5.0+",
      bonus: cleanText(asStr(body.bonus, 120)),
      categoryId: asInt(body.categoryId) || null,
      featured: asBool(body.featured),
      status: asStr(body.status, 20) === "draft" ? "draft" : "published",
      metaTitle, metaDescription,
      h1: cleanText(asStr(body.h1, 200)),
      focusKeyword: cleanText(asStr(body.focusKeyword, 120)),
      secondaryKeywords: cleanText(asStr(body.secondaryKeywords, 500)),
      canonicalUrl: asStr(body.canonicalUrl, 500),
      ogTitle: cleanText(asStr(body.ogTitle, 200)),
      ogDescription: cleanText(asStr(body.ogDescription, 300)),
      ogImage: asStr(body.ogImage, 500),
      twitterTitle: cleanText(asStr(body.twitterTitle, 200)),
      twitterDescription: cleanText(asStr(body.twitterDescription, 300)),
      twitterImage: asStr(body.twitterImage, 500),
      noIndex: asBool(body.noIndex),
      noFollow: asBool(body.noFollow),
      faqs: parseFaq(body.faqs),
      editorialRating: clampRating(asFloat(body.editorialRating)),
    })
    .returning();

  const tagIds = await resolveTagIds(body);
  if (tagIds.length) {
    await db.insert(gameTags).values(tagIds.map((tagId) => ({ gameId: created.id, tagId })));
  }
  const links = Array.isArray(body.links) ? (body.links as Record<string, unknown>[]) : [];
  const validLinks = links
    .map((l, i) => ({
      gameId: created.id,
      label: cleanText(asStr(l.label, 120)) || "Download APK",
      url: asStr(l.url, 1000),
      version: cleanText(asStr(l.version, 40)),
      size: cleanText(asStr(l.size, 40)),
      sort: i,
    }))
    .filter((l) => l.url);
  if (validLinks.length) await db.insert(downloadLinks).values(validLinks);

  await logAudit({ action: "create", entity: "game", entityId: created.id, summary: created.title, req, session: auth });

  let categorySlug: string | undefined;
  if (created.categoryId) {
    const [cat] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, created.categoryId)).limit(1);
    categorySlug = cat?.slug;
  }
  revalidateGamePaths({ slug: created.slug, categorySlug });

  return json({ ok: true, game: created }, 201);
}
