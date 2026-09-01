import { db } from "@/db";
import { games, posts, categories, tags, pages } from "@/db/schema";
import { and, eq, or, lte } from "drizzle-orm";
import { configuredSiteUrl, escapeXml } from "@/lib/util";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function url(loc: string, lastmod?: Date | string, priority = "0.7", freq = "weekly") {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    ${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function GET() {
  const base = configuredSiteUrl(await getSettings());

  // A sitemap must remain fetchable even during a cold start, migration, or
  // temporary database outage. Google only needs a valid XML response; the
  // dynamic content can be added on the next crawl once the DB is available.
  let gameRows: { slug: string; updatedAt: Date }[] = [];
  let postRows: { slug: string; updatedAt: Date }[] = [];
  let catRows: { slug: string }[] = [];
  let tagRows: { slug: string }[] = [];
  let pageRows: { slug: string; updatedAt: Date }[] = [];

  try {
    [gameRows, postRows, catRows, tagRows, pageRows] = await Promise.all([
      db.select({ slug: games.slug, updatedAt: games.updatedAt }).from(games)
        .where(and(eq(games.status, "published"), eq(games.noIndex, false))),
      db.select({ slug: posts.slug, updatedAt: posts.updatedAt }).from(posts)
        .where(and(or(eq(posts.status, "published"), and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, new Date())))!, eq(posts.noIndex, false))),
      db.select({ slug: categories.slug }).from(categories).where(eq(categories.noIndex, false)),
      db.select({ slug: tags.slug }).from(tags).where(eq(tags.noIndex, false)),
      db.select({ slug: pages.slug, updatedAt: pages.updatedAt }).from(pages).where(eq(pages.noIndex, false)),
    ]);
  } catch (error) {
    console.error("[sitemap] database unavailable; serving core URLs only:", error);
  }

  const urls: string[] = [
    url(base + "/", new Date(), "1.0", "daily"),
    url(base + "/games", undefined, "0.9", "daily"),
    url(base + "/blog", undefined, "0.8", "daily"),
    url(base + "/contact", undefined, "0.4", "monthly"),
    url(base + "/request", undefined, "0.4", "monthly"),
    ...gameRows.map((g) => url(`${base}/game/${g.slug}`, g.updatedAt, "0.9", "weekly")),
    ...postRows.map((p) => url(`${base}/blog/${p.slug}`, p.updatedAt, "0.8", "weekly")),
    ...catRows.map((c) => url(`${base}/category/${c.slug}`, undefined, "0.8", "daily")),
    ...tagRows.map((t) => url(`${base}/tag/${t.slug}`, undefined, "0.6", "weekly")),
    ...pageRows.map((p) => url(`${base}/page/${p.slug}`, p.updatedAt, "0.5", "monthly")),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
