import { db } from "@/db";
import { posts, postTags, users, categories, redirects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { json, requirePerm, checkOrigin, asStr, asInt, asBool } from "@/lib/api";
import { uniqueSlug } from "@/lib/slug";
import { cleanHtml, cleanText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";
import { readingTime } from "@/lib/util";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePerm("posts");
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const [row] = await db
    .select({ post: posts, authorName: users.name, categoryName: categories.name })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .where(eq(posts.id, asInt(id)))
    .limit(1);
  if (!row) return json({ error: "Not found" }, 404);
  const tagRows = await db.select().from(postTags).where(eq(postTags.postId, row.post.id));
  return json({ post: { ...row.post, tagIds: tagRows.map((t) => t.tagId) } });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePerm("posts");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const { id } = await ctx.params;
  const postId = asInt(id);
  const body = await req.json().catch(() => ({}));
  const title = cleanText(asStr(body.title, 200));
  if (!postId || !title) return json({ error: "Invalid data" }, 400);
  const [before] = await db.select({ slug: posts.slug }).from(posts).where(eq(posts.id, postId)).limit(1);
  const slug = body.slug ? await uniqueSlug("posts", asStr(body.slug, 120), postId) : await uniqueSlug("posts", title, postId);
  const content = cleanHtml(asStr(body.content, 200_000));
  const requestedStatus = asStr(body.status, 20);
  const scheduledAt = body.scheduledAt ? new Date(asStr(body.scheduledAt, 40)) : null;
  const status = requestedStatus === "draft" ? "draft" : (requestedStatus === "scheduled" && scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? "scheduled" : "published");

  const [updated] = await db
    .update(posts)
    .set({
      title, slug,
      excerpt: cleanText(asStr(body.excerpt, 300)),
      content,
      image: asStr(body.image, 500),
      categoryId: asInt(body.categoryId) || null,
      status,
      featured: asBool(body.featured),
      scheduledAt: status === "scheduled" ? scheduledAt : null,
      readingTime: readingTime(content),
      metaTitle: cleanText(asStr(body.metaTitle, 200)),
      metaDescription: cleanText(asStr(body.metaDescription, 300)),
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
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId))
    .returning();
  if (!updated) return json({ error: "Not found" }, 404);

  // Preserve SEO when an existing public post slug changes.
  if (before?.slug && before.slug !== updated.slug) {
    await db.insert(redirects).values({
      fromPath: `/blog/${before.slug}`,
      toPath: `/blog/${updated.slug}`,
      statusCode: 301,
    }).onConflictDoNothing();
  }

  await db.delete(postTags).where(eq(postTags.postId, postId));
  const tagIds: number[] = Array.isArray(body.tagIds)
    ? [...new Set((body.tagIds as unknown[]).map((t) => asInt(t)).filter((n) => n > 0))]
    : [];
  if (tagIds.length) {
    await db.insert(postTags).values(tagIds.map((tagId) => ({ postId, tagId }))).onConflictDoNothing();
  }
  await logAudit({ action: "update", entity: "post", entityId: postId, summary: updated.title, req, session: auth });
  return json({ ok: true, post: updated });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePerm("posts");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const { id } = await ctx.params;
  const postId = asInt(id);
  const [existing] = await db.select({ title: posts.title }).from(posts).where(eq(posts.id, postId)).limit(1);
  await db.delete(posts).where(eq(posts.id, postId));
  await logAudit({ action: "delete", entity: "post", entityId: postId, summary: existing?.title || "", req, session: auth });
  return json({ ok: true });
}
