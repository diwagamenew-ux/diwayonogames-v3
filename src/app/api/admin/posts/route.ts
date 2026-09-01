import { db } from "@/db";
import { posts, categories, users, postTags } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { json, requirePerm, checkOrigin, asStr, asInt, asBool } from "@/lib/api";
import { uniqueSlug } from "@/lib/slug";
import { cleanHtml, cleanText } from "@/lib/sanitize";
import { excerptFromHtml, readingTime } from "@/lib/util";
import type { SessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requirePerm("posts");
  if (auth instanceof Response) return auth;
  const rows = await db
    .select({ post: posts, authorName: users.name, categoryName: categories.name })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .orderBy(desc(posts.updatedAt))
    .limit(500);
  return json({ posts: rows.map((r) => ({ ...r.post, authorName: r.authorName, categoryName: r.categoryName })) });
}

export async function POST(req: Request) {
  const auth = await requirePerm("posts");
  if (auth instanceof Response) return auth;
  const session = auth as SessionUser;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);

  const body = await req.json().catch(() => ({}));
  const title = cleanText(asStr(body.title, 200));
  if (!title) return json({ error: "Title is required" }, 400);
  const slug = body.slug ? await uniqueSlug("posts", asStr(body.slug, 120)) : await uniqueSlug("posts", title);
  const content = cleanHtml(asStr(body.content, 200_000));
  const excerpt = cleanText(asStr(body.excerpt, 300)) || excerptFromHtml(content, 150);
  const requestedStatus = asStr(body.status, 20);
  const scheduledAt = body.scheduledAt ? new Date(asStr(body.scheduledAt, 40)) : null;
  const status = requestedStatus === "draft" ? "draft" : (requestedStatus === "scheduled" && scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? "scheduled" : "published");

  const [created] = await db
    .insert(posts)
    .values({
      title, slug, excerpt, content,
      image: asStr(body.image, 500),
      categoryId: asInt(body.categoryId) || null,
      authorId: session.id,
      status,
      featured: asBool(body.featured),
      scheduledAt: status === "scheduled" ? scheduledAt : null,
      readingTime: readingTime(content),
      metaTitle: cleanText(asStr(body.metaTitle, 200)) || title,
      metaDescription: cleanText(asStr(body.metaDescription, 300)) || excerpt,
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
    })
    .returning();

  const tagIds: number[] = Array.isArray(body.tagIds)
    ? [...new Set((body.tagIds as unknown[]).map((t) => asInt(t)).filter((n) => n > 0))]
    : [];
  if (tagIds.length) {
    await db.insert(postTags).values(tagIds.map((tagId) => ({ postId: created.id, tagId }))).onConflictDoNothing();
  }
  await logAudit({ action: "create", entity: "post", entityId: created.id, summary: created.title, req, session });
  return json({ ok: true, post: created }, 201);
}
