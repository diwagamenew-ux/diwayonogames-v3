import Link from "next/link";
import { headers } from "next/headers";
import { permanentRedirect, redirect } from "next/navigation";
import { db } from "@/db";
import { redirects, notFoundLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { listGames } from "@/lib/data";
import { GameCard } from "@/components/game-card";
import { SearchBox } from "@/components/search-box";
import { IconCrown } from "@/components/icons";

export default async function NotFound() {
  const headerList = await headers();
  const path = (headerList.get("x-pathname") || "").split("?")[0];

  // Redirect manager: honor configured redirects for this path
  if (path && path.length > 1 && !path.startsWith("/admin") && !path.startsWith("/api")) {
    try {
      const [rule] = await db.select().from(redirects).where(eq(redirects.fromPath, path)).limit(1);
      if (rule) {
        await db.update(redirects).set({ hits: sql`${redirects.hits} + 1` }).where(eq(redirects.id, rule.id));
        if (rule.statusCode === 302) redirect(rule.toPath);
        permanentRedirect(rule.toPath);
      }
      // 404 manager: log the miss
      await db
        .insert(notFoundLogs)
        .values({ path })
        .onConflictDoUpdate({
          target: notFoundLogs.path,
          set: { hits: sql`${notFoundLogs.hits} + 1`, lastSeen: new Date() },
        });
    } catch {
      /* table may not exist on first boot */
    }
  }

  const suggested = await listGames({ limit: 4, sort: "downloads" }).catch(() => []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-14 text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl btn-gold flex items-center justify-center animate-glow">
        <IconCrown className="w-8 h-8" />
      </div>
      <p className="font-display text-8xl sm:text-9xl gold-text mt-6 leading-none">404</p>
      <h1 className="font-display text-3xl sm:text-4xl tracking-wide mt-3">PAGE NOT FOUND</h1>
      <p className="text-mute mt-3 max-w-md mx-auto text-sm leading-relaxed">
        The page you are looking for was moved, removed or never existed. Try searching below
        or grab one of our most-downloaded apps.
      </p>
      <div className="max-w-md mx-auto mt-7">
        <SearchBox autoFocus />
      </div>
      <Link href="/" className="btn-gold inline-flex px-7 py-3 text-sm mt-6">Back to Home</Link>
      {suggested.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12 text-left">
          {suggested.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
