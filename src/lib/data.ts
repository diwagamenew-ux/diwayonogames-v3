import { db } from "@/db";
import {
  games, categories, tags, gameTags, postTags, downloadLinks, posts, users, reviews,
} from "@/db/schema";
import { and, desc, eq, ilike, inArray, ne, or, sql, lte } from "drizzle-orm";

export type GameWithCategory = typeof games.$inferSelect & {
  categoryName?: string | null;
  categorySlug?: string | null;
};

export type SortMode = "latest" | "rating" | "popular" | "downloads" | "trending";

function orderFor(sort: SortMode) {
  switch (sort) {
    case "rating":
      return [desc(games.rating), desc(games.ratingCount)] as const;
    case "popular":
      return [desc(games.views)] as const;
    case "downloads":
      return [desc(games.downloads)] as const;
    case "trending":
      return [desc(sql`${games.views} + ${games.downloads} * 5`)] as const;
    default:
      return [desc(games.publishedAt)] as const;
  }
}

export async function listGames(opts: {
  limit?: number; offset?: number; categorySlug?: string;
  search?: string; sort?: SortMode; featured?: boolean;
} = {}): Promise<GameWithCategory[]> {
  const { limit = 24, offset = 0, categorySlug, search, sort = "latest", featured } = opts;
  const conds = [eq(games.status, "published")];
  if (categorySlug) conds.push(eq(categories.slug, categorySlug));
  if (featured !== undefined) conds.push(eq(games.featured, featured));
  if (search) {
    conds.push(
      or(
        ilike(games.title, `%${search}%`),
        ilike(games.shortDesc, `%${search}%`),
        ilike(games.developer, `%${search}%`)
      )!
    );
  }
  const rows = await db
    .select({ game: games, categoryName: categories.name, categorySlug: categories.slug })
    .from(games)
    .leftJoin(categories, eq(games.categoryId, categories.id))
    .where(and(...conds))
    .orderBy(...orderFor(sort))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({
    ...r.game,
    categoryName: r.categoryName,
    categorySlug: r.categorySlug,
  }));
}

export async function countGames(opts: { categorySlug?: string; search?: string } = {}) {
  const conds = [eq(games.status, "published")];
  if (opts.search) conds.push(or(ilike(games.title, `%${opts.search}%`))!);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(games)
    .leftJoin(categories, eq(games.categoryId, categories.id))
    .where(and(...(opts.categorySlug ? [...conds, eq(categories.slug, opts.categorySlug)] : conds)));
  return row?.count ?? 0;
}

export async function getGameBySlug(slug: string) {
  const [row] = await db
    .select({ game: games, categoryName: categories.name, categorySlug: categories.slug })
    .from(games)
    .leftJoin(categories, eq(games.categoryId, categories.id))
    .where(eq(games.slug, slug))
    .limit(1);
  if (!row) return null;
  const links = await db
    .select()
    .from(downloadLinks)
    .where(eq(downloadLinks.gameId, row.game.id))
    .orderBy(downloadLinks.sort, downloadLinks.id);
  const tagRows = await db
    .select({ tag: tags })
    .from(gameTags)
    .innerJoin(tags, eq(gameTags.tagId, tags.id))
    .where(eq(gameTags.gameId, row.game.id));
  return {
    ...row.game,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    links,
    tags: tagRows.map((t) => t.tag),
  };
}

export async function getGameTags(gameId: number) {
  const rows = await db
    .select({ tag: tags })
    .from(gameTags)
    .innerJoin(tags, eq(gameTags.tagId, tags.id))
    .where(eq(gameTags.gameId, gameId));
  return rows.map((r) => r.tag);
}

export async function relatedGames(game: {
  id: number; categoryId: number | null; tags: { id: number }[];
}, limit = 6): Promise<GameWithCategory[]> {
  const tagIds = game.tags.map((t) => t.id);
  if (tagIds.length > 0) {
    const tagged = await db
      .select({ gameId: gameTags.gameId })
      .from(gameTags)
      .where(and(inArray(gameTags.tagId, tagIds), ne(gameTags.gameId, game.id)))
      .limit(20);
    const ids = [...new Set(tagged.map((t) => t.gameId))];
    if (ids.length > 0) {
      const rows = await db
        .select({ game: games, categoryName: categories.name, categorySlug: categories.slug })
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .where(and(inArray(games.id, ids), eq(games.status, "published")))
        .orderBy(desc(games.rating))
        .limit(limit);
      return rows.map((r) => ({ ...r.game, categoryName: r.categoryName, categorySlug: r.categorySlug }));
    }
  }
  if (game.categoryId) {
    return listGames({ limit, sort: "rating", categorySlug: undefined }).then((all) =>
      all.filter((g) => g.id !== game.id && g.categoryId === game.categoryId).slice(0, limit)
    );
  }
  return [];
}

export async function developerGames(developer: string, excludeId: number, limit = 6) {
  if (!developer) return [];
  const rows = await db
    .select({ game: games, categoryName: categories.name })
    .from(games)
    .leftJoin(categories, eq(games.categoryId, categories.id))
    .where(and(eq(games.developer, developer), ne(games.id, excludeId), eq(games.status, "published")))
    .orderBy(desc(games.downloads))
    .limit(limit);
  return rows.map((r) => ({ ...r.game, categoryName: r.categoryName }));
}

export async function listCategories() {
  const rows = await db
    .select({
      category: categories,
      count: sql<number>`(select count(*) from ${games} where ${games.categoryId} = ${categories.id} and ${games.status} = 'published')::int`,
    })
    .from(categories)
    .orderBy(categories.name);
  return rows.map((r) => ({ ...r.category, count: r.count }));
}

export async function getCategoryBySlug(slug: string) {
  const [row] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return row ?? null;
}

export async function listTagsWithCount() {
  const rows = await db
    .select({
      tag: tags,
      count: sql<number>`(select count(*) from ${gameTags} where ${gameTags.tagId} = ${tags.id})::int`,
    })
    .from(tags)
    .orderBy(tags.name);
  return rows.map((r) => ({ ...r.tag, count: r.count }));
}

export async function getTagBySlug(slug: string) {
  const [row] = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return row ?? null;
}

export async function gamesByTag(tagId: number, limit = 24, offset = 0) {
  const rows = await db
    .select({ game: games, categoryName: categories.name })
    .from(gameTags)
    .innerJoin(games, eq(gameTags.gameId, games.id))
    .leftJoin(categories, eq(games.categoryId, categories.id))
    .where(and(eq(gameTags.tagId, tagId), eq(games.status, "published")))
    .orderBy(desc(games.publishedAt))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({ ...r.game, categoryName: r.categoryName }));
}

export async function listPosts(opts: { limit?: number; offset?: number; search?: string; featuredFirst?: boolean } = {}) {
  const { limit = 12, offset = 0, search, featuredFirst = false } = opts;
  const conds = [or(eq(posts.status, "published"), and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, new Date())))!];
  if (search) conds.push(or(ilike(posts.title, `%${search}%`), ilike(posts.excerpt, `%${search}%`))!);
  const rows = await db
    .select({ post: posts, authorName: users.name, categoryName: categories.name })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .where(and(...conds))
    .orderBy(...(featuredFirst ? [desc(posts.featured), desc(posts.publishedAt)] : [desc(posts.publishedAt)]))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({ ...r.post, authorName: r.authorName, categoryName: r.categoryName }));
}

export async function getPostBySlug(slug: string) {
  const [row] = await db
    .select({ post: posts, authorName: users.name, categoryName: categories.name, categorySlug: categories.slug })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .where(eq(posts.slug, slug))
    .limit(1);
  if (!row) return null;
  const tagRows = await db
    .select({ tag: tags })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, row.post.id));
  return { ...row.post, authorName: row.authorName, categoryName: row.categoryName, categorySlug: row.categorySlug, tags: tagRows.map((t) => t.tag) };
}

export async function getApprovedReviews(opts: { gameId?: number; postId?: number }, limit = 50) {
  const conds = [eq(reviews.status, "approved")];
  if (opts.gameId) conds.push(eq(reviews.gameId, opts.gameId));
  if (opts.postId) conds.push(eq(reviews.postId, opts.postId));
  return db.select().from(reviews).where(and(...conds)).orderBy(desc(reviews.createdAt)).limit(limit);
}

export async function getPageBySlug(slug: string) {
  const { pages } = await import("@/db/schema");
  const [row] = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  return row ?? null;
}

export async function dashboardStats() {
  // These six queries are all independent — running them one at a time
  // means the dashboard's load time is the SUM of six DB round trips.
  // Firing them concurrently makes it the MAX of the six instead, which on
  // a typical ~20-40ms-per-query connection cuts this from ~150-250ms to
  // ~25-45ms.
  const [[gameCount], [postCount], [categoryCount], [tagCount], [pendingReviews], [totals]] =
    await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(games),
      db.select({ c: sql<number>`count(*)::int` }).from(posts),
      db.select({ c: sql<number>`count(*)::int` }).from(categories),
      db.select({ c: sql<number>`count(*)::int` }).from(tags),
      db.select({ c: sql<number>`count(*)::int` }).from(reviews).where(eq(reviews.status, "pending")),
      db
        .select({
          downloads: sql<number>`coalesce(sum(${games.downloads}),0)::int`,
          views: sql<number>`coalesce(sum(${games.views}),0)::int`,
        })
        .from(games),
    ]);
  return {
    games: gameCount?.c ?? 0,
    posts: postCount?.c ?? 0,
    categories: categoryCount?.c ?? 0,
    tags: tagCount?.c ?? 0,
    pendingReviews: pendingReviews?.c ?? 0,
    downloads: totals?.downloads ?? 0,
    views: totals?.views ?? 0,
  };
}
