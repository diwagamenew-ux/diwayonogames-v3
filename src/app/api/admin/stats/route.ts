import { db } from "@/db";
import { games, reviews } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { json, requireAuth } from "@/lib/api";
import { dashboardStats } from "@/lib/data";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const stats = await dashboardStats();
  const topGames = await db
    .select({ id: games.id, title: games.title, slug: games.slug, views: games.views, downloads: games.downloads, rating: games.rating, icon: games.icon })
    .from(games)
    .orderBy(desc(games.downloads))
    .limit(6);
  const recentReviews = await db
    .select()
    .from(reviews)
    .where(eq(reviews.status, "pending"))
    .orderBy(desc(reviews.createdAt))
    .limit(6);
  return json({ stats, topGames, recentReviews });
}
