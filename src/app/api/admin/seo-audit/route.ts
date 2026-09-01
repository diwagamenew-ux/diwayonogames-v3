import { db } from "@/db";
import { games, posts, categories, pages } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { json, requirePerm } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { configuredSiteUrl } from "@/lib/util";

function audit(item: any, type: string, path: string) {
  const issues: string[] = [];
  const title = String(item.metaTitle || "").trim();
  const desc = String(item.metaDescription || "").trim();
  const h1 = String(item.h1 || "").trim();
  const content = String(item.content || item.description || "").replace(/<[^>]+>/g, " ").trim();
  if (!title) issues.push("Missing SEO title");
  else if (title.length < 30) issues.push("SEO title is short");
  else if (title.length > 65) issues.push("SEO title is long");
  if (!desc) issues.push("Missing meta description");
  else if (desc.length < 80) issues.push("Meta description is short");
  else if (desc.length > 170) issues.push("Meta description is long");
  if (!h1) issues.push("Missing H1 override (automatic fallback may still apply)");
  if (content && content.length < 250) issues.push("Content is very short");
  if (!item.ogImage && !item.image && !item.icon) issues.push("Missing social/featured image");
  if (item.noIndex) issues.push("Noindex enabled");
  return { type, id: item.id, title: item.title || item.name, path, score: Math.max(0, 100 - issues.length * 12), issues };
}

export async function GET() {
  const auth = await requirePerm("seo");
  if (auth instanceof Response) return auth;
  const [g, p, c, pg] = await Promise.all([
    db.select().from(games).orderBy(desc(games.updatedAt)).limit(500),
    db.select().from(posts).orderBy(desc(posts.updatedAt)).limit(500),
    db.select().from(categories).orderBy(desc(categories.createdAt)).limit(500),
    db.select().from(pages).limit(500),
  ]);
  const items = [
    ...g.filter(x => x.status === "published").map(x => audit(x, "game", `/game/${x.slug}`)),
    ...p.filter(x => x.status === "published").map(x => audit(x, "post", `/blog/${x.slug}`)),
    ...c.filter(x => !x.noIndex).map(x => audit(x, "category", `/category/${x.slug}`)),
    ...pg.filter(x => !x.noIndex).map(x => audit(x, "page", `/page/${x.slug}`)),
  ];
  const s = await getSettings();
  const base = configuredSiteUrl(s);

  // Lightweight internal-link checker for links stored in editable HTML.
  // It catches stale /game, /blog, /category, /tag and /page links without
  // making outbound HTTP requests or depending on the current domain.
  const valid = {
    game: new Set(g.map(x => x.slug)),
    blog: new Set(p.map(x => x.slug)),
    category: new Set(c.map(x => x.slug)),
    tag: new Set<string>(),
    page: new Set(pg.map(x => x.slug)),
  };
  const contentRows = [
    ...g.map(x => ({ source: `game:${x.slug}`, html: x.content })),
    ...p.map(x => ({ source: `post:${x.slug}`, html: x.content })),
    ...pg.map(x => ({ source: `page:${x.slug}`, html: x.content })),
    ...c.map(x => ({ source: `category:${x.slug}`, html: x.description })),
  ];
  const brokenInternalLinks: { source: string; href: string }[] = [];
  const hrefRe = /(?:href|src)=["'](\/(?:game|blog|category|tag|page)\/[^"'#?]+)["']/gi;
  for (const row of contentRows) {
    const html = String(row.html || "");
    let match: RegExpExecArray | null;
    while ((match = hrefRe.exec(html))) {
      const href = match[1];
      const parts = href.split("/").filter(Boolean);
      const type = parts[0] as keyof typeof valid;
      const slug = parts[1];
      if (valid[type] && !valid[type].has(slug)) brokenInternalLinks.push({ source: row.source, href });
      if (brokenInternalLinks.length >= 100) break;
    }
    if (brokenInternalLinks.length >= 100) break;
  }

  const summary = {
    total: items.length,
    needsWork: items.filter(x => x.issues.length > 0).length,
    noindex: items.filter(x => x.issues.includes("Noindex enabled")).length,
    average: items.length ? Math.round(items.reduce((n, x) => n + x.score, 0) / items.length) : 100,
  };
  const technical = {
    siteUrl: base,
    sitemapUrl: `${base}/sitemap.xml`,
    robotsUrl: `${base}/robots.txt`,
    sitemapConfigured: Boolean(base),
    indexableGames: g.filter(x => x.status === "published" && !x.noIndex).length,
    indexablePosts: p.filter(x => x.status === "published" && !x.noIndex).length,
    indexableCategories: c.filter(x => !x.noIndex).length,
    indexablePages: pg.filter(x => !x.noIndex).length,
    brokenInternalLinks,
  };
  return json({ summary, technical, items: items.sort((a,b) => a.score - b.score).slice(0, 200) });
}
