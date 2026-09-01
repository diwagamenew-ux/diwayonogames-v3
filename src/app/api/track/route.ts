import { db } from "@/db";
import { games, posts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { json } from "@/lib/api";
import { rateLimit, getClientIp } from "@/lib/util";

export async function POST(req: Request) {
  if (!rateLimit("track:" + getClientIp(req), 60, 60_000)) return json({ ok: false }, 429);
  const body = await req.json().catch(() => ({}));
  const gameId = parseInt(String(body.gameId || 0), 10);
  const postId = parseInt(String(body.postId || 0), 10);
  if (gameId > 0) {
    await db.update(games).set({ views: sql`${games.views} + 1` }).where(eq(games.id, gameId));
  }
  if (postId > 0) {
    await db.update(posts).set({ views: sql`${posts.views} + 1` }).where(eq(posts.id, postId));
  }
  return json({ ok: true });
}
