import Link from "next/link";
import { db } from "@/db";
import { games, categories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { formatNumber, formatDate } from "@/lib/util";
import { DeleteButton, StatusBadge } from "@/components/admin/buttons";
import { can } from "@/lib/auth";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminGamesPage() {
  const session = await getSession();
  const rows = await db
    .select({ game: games, categoryName: categories.name })
    .from(games)
    .leftJoin(categories, eq(games.categoryId, categories.id))
    .orderBy(desc(games.updatedAt))
    .limit(500);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-4xl gold-text tracking-wide">GAMES</h1>
          <p className="text-sm text-mute mt-1">{rows.length} games in the library</p>
        </div>
        {can(session?.role || "", "games") && (
          <Link href="/admin/games/new" className="btn-gold px-5 py-2.5 text-sm">+ Add Game</Link>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="admin-table w-full min-w-[760px]">
          <thead>
            <tr>
              <th>Game</th><th>Category</th><th>Stats</th><th>Status</th><th>Updated</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ game, categoryName }) => (
              <tr key={game.id}>
                <td>
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={game.icon || "/images/logo.png"} alt="" width={36} height={36} className="w-9 h-9 rounded-lg object-cover gold-frame" />
                    <div className="min-w-0">
                      <p className="font-semibold line-clamp-1 max-w-[240px]">
                        {game.title} {game.featured && <span className="text-accent" title="Featured">★</span>}
                      </p>
                      <p className="text-[0.68rem] text-mute">/{game.slug} · v{game.version}</p>
                    </div>
                  </div>
                </td>
                <td className="text-mute">{categoryName || "—"}</td>
                <td className="text-mute text-xs">
                  {formatNumber(game.downloads)} dl · {formatNumber(game.views)} views · ★ {game.rating.toFixed(1)}
                </td>
                <td><StatusBadge status={game.status} /></td>
                <td className="text-mute text-xs">{formatDate(game.updatedAt)}</td>
                <td className="text-right whitespace-nowrap space-x-3">
                  <Link href={`/game/${game.slug}`} target="_blank" className="text-xs text-mute hover:text-accent">View</Link>
                  <Link href={`/admin/games/${game.id}`} className="text-xs text-accent hover:underline">Edit</Link>
                  <DeleteButton endpoint={`/api/admin/games/${game.id}`} confirmText={`Delete "${game.title}"? This cannot be undone.`} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center text-mute py-10">No games yet. Add your first one!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
