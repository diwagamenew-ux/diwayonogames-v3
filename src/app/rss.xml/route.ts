import { db } from "@/db";
import { games, posts } from "@/db/schema";
import { desc, eq, and, or, lte, sql } from "drizzle-orm";
import { configuredSiteUrl, escapeXml, excerptFromHtml } from "@/lib/util";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  const base = configuredSiteUrl(s);
  const [gameRows, postRows] = await Promise.all([
    db.select().from(games).where(eq(games.status, "published")).orderBy(desc(games.publishedAt)).limit(20),
    db.select().from(posts).where(and(or(eq(posts.status, "published"), and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, new Date())))!)).orderBy(desc(posts.publishedAt)).limit(20),
  ]);

  const items = [
    ...gameRows.map((g) => ({
      title: g.title,
      link: `${base}/game/${g.slug}`,
      desc: g.shortDesc || excerptFromHtml(g.content, 160),
      date: g.publishedAt,
    })),
    ...postRows.map((p) => ({
      title: p.title,
      link: `${base}/blog/${p.slug}`,
      desc: p.excerpt || excerptFromHtml(p.content, 160),
      date: p.publishedAt,
    })),
  ]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 25);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(s.siteName)}</title>
  <link>${base}</link>
  <description>${escapeXml(s.description)}</description>
  <language>en-us</language>
  <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml"/>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items
  .map(
    (i) => `  <item>
    <title>${escapeXml(i.title)}</title>
    <link>${i.link}</link>
    <guid>${i.link}</guid>
    <description>${escapeXml(i.desc)}</description>
    <pubDate>${new Date(i.date).toUTCString()}</pubDate>
  </item>`
  )
  .join("\n")}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=1800" },
  });
}
