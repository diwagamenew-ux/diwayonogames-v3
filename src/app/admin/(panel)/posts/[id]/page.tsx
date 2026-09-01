import { notFound } from "next/navigation";
import { db } from "@/db";
import { posts, postTags, categories, tags } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { PostForm } from "@/components/admin/post-form";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id, 10);
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) notFound();
  const [tagRows, cats, allTags] = await Promise.all([
    db.select().from(postTags).where(eq(postTags.postId, postId)),
    db.select().from(categories).orderBy(asc(categories.name)),
    db.select().from(tags).orderBy(asc(tags.name)).limit(300),
  ]);
  return (
    <div>
      <h1 className="font-display text-4xl gold-text tracking-wide mb-6">EDIT POST</h1>
      <PostForm
        initial={{
          id: post.id, title: post.title, slug: post.slug, excerpt: post.excerpt,
          content: post.content, image: post.image, categoryId: post.categoryId,
          status: post.status, metaTitle: post.metaTitle, metaDescription: post.metaDescription, h1: post.h1,
          focusKeyword: post.focusKeyword, secondaryKeywords: post.secondaryKeywords, canonicalUrl: post.canonicalUrl, ogTitle: post.ogTitle, ogDescription: post.ogDescription, ogImage: post.ogImage, twitterTitle: post.twitterTitle, twitterDescription: post.twitterDescription, twitterImage: post.twitterImage, noIndex: post.noIndex, noFollow: post.noFollow, tagIds: tagRows.map((t) => t.tagId),
        }}
        categories={cats}
        allTags={allTags}
      />
    </div>
  );
}
