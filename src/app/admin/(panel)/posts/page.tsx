import Link from "next/link";
import { db } from "@/db";
import { posts, users, categories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { formatDate } from "@/lib/util";
import { DeleteButton, StatusBadge } from "@/components/admin/buttons";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage() {
  const rows = await db
    .select({ post: posts, authorName: users.name, categoryName: categories.name })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .orderBy(desc(posts.updatedAt))
    .limit(500);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-4xl gold-text tracking-wide">BLOG POSTS</h1>
          <p className="text-sm text-mute mt-1">{rows.length} posts</p>
        </div>
        <Link href="/admin/posts/new" className="btn-gold px-5 py-2.5 text-sm">+ New Post</Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="admin-table w-full min-w-[700px]">
          <thead>
            <tr><th>Title</th><th>Category</th><th>Author</th><th>Views</th><th>Publishing</th><th>Status</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map(({ post, authorName, categoryName }) => (
              <tr key={post.id}>
                <td className="max-w-[280px]">
                  <p className="font-semibold line-clamp-1">{post.title}</p>
                  <p className="text-[0.68rem] text-mute">/{post.slug} · {formatDate(post.updatedAt)}</p>
                </td>
                <td className="text-mute">{categoryName || "—"}</td>
                <td className="text-mute">{authorName || "—"}</td>
                <td className="text-mute">{post.views}</td>
                <td className="text-xs">{post.status === "scheduled" ? <span className="text-accent">Scheduled {post.scheduledAt ? formatDate(post.scheduledAt) : ""}</span> : post.featured ? <span className="text-gold2">Featured</span> : "—"}</td>
                <td><StatusBadge status={post.status} /></td>
                <td className="text-right whitespace-nowrap space-x-3">
                  <Link href={`/blog/${post.slug}`} target="_blank" className="text-xs text-mute hover:text-accent">View</Link>
                  <Link href={`/admin/posts/${post.id}`} className="text-xs text-accent hover:underline">Edit</Link>
                  <DeleteButton endpoint={`/api/admin/posts/${post.id}`} confirmText={`Delete "${post.title}"?`} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-center text-mute py-10">No posts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
