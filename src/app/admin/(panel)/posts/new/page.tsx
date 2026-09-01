import { db } from "@/db";
import { categories, tags } from "@/db/schema";
import { asc } from "drizzle-orm";
import { PostForm } from "@/components/admin/post-form";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const [cats, allTags] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.name)),
    db.select().from(tags).orderBy(asc(tags.name)).limit(300),
  ]);
  return (
    <div>
      <h1 className="font-display text-4xl gold-text tracking-wide mb-6">NEW POST</h1>
      <PostForm categories={cats} allTags={allTags} />
    </div>
  );
}
