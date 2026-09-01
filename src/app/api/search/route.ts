import { listGames } from "@/lib/data";
import { json } from "@/lib/api";
import { rateLimit, getClientIp } from "@/lib/util";

export async function GET(req: Request) {
  if (!rateLimit("search:" + getClientIp(req), 40, 60_000)) {
    return json({ results: [] }, 429);
  }
  const q = new URL(req.url).searchParams.get("q") || "";
  if (q.trim().length < 1) return json({ results: [] });
  const results = await listGames({ search: q.trim(), limit: 8, sort: "downloads" });
  return json({
    results: results.map((g) => ({
      id: g.id, title: g.title, slug: g.slug, icon: g.icon,
      rating: g.rating, downloads: g.downloads, version: g.version,
    })),
  });
}
