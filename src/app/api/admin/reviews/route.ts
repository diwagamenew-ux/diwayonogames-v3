import { db } from "@/db";
import { reviews, games, posts } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { json, requirePerm, checkOrigin, asStr, asInt } from "@/lib/api";
import { logAudit } from "@/lib/audit";

async function recomputeGameRating(gameId: number | null) {
  if (!gameId) return;
  const [agg] = await db
    .select({
      avg: sql<number>`coalesce(avg(${reviews.rating}),0)::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.gameId, gameId), eq(reviews.status, "approved")));
  await db
    .update(games)
    .set({ rating: agg?.avg ?? 0, ratingCount: agg?.count ?? 0 })
    .where(eq(games.id, gameId));
}

export async function GET() {
  const auth = await requirePerm("reviews");
  if (auth instanceof Response) return auth;
  const rows = await db
    .select({ review: reviews, gameTitle: games.title, postTitle: posts.title })
    .from(reviews)
    .leftJoin(games, eq(reviews.gameId, games.id))
    .leftJoin(posts, eq(reviews.postId, posts.id))
    .orderBy(desc(reviews.createdAt))
    .limit(300);
  return json({ reviews: rows.map((r) => ({ ...r.review, gameTitle: r.gameTitle, postTitle: r.postTitle })) });
}

export async function PUT(req: Request) {
  const auth = await requirePerm("reviews");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => ({}));
  const id = asInt(body.id);
  const status = asStr(body.status, 20);
  if (!id || !["approved", "rejected", "pending"].includes(status)) {
    return json({ error: "Invalid data" }, 400);
  }
  const [updated] = await db.update(reviews).set({ status }).where(eq(reviews.id, id)).returning();
  await recomputeGameRating(updated?.gameId ?? null);
  await logAudit({
    action: status === "approved" ? "approve" : status === "rejected" ? "reject" : "update",
    entity: "review", entityId: id, summary: updated?.comment?.slice(0, 100) || "", req, session: auth,
  });
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requirePerm("reviews");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const id = asInt(new URL(req.url).searchParams.get("id"));
  if (!id) return json({ error: "id required" }, 400);
  const [deleted] = await db.delete(reviews).where(eq(reviews.id, id)).returning();
  await recomputeGameRating(deleted?.gameId ?? null);
  await logAudit({ action: "delete", entity: "review", entityId: id, summary: deleted?.comment?.slice(0, 100) || "", req, session: auth });
  return json({ ok: true });
}
