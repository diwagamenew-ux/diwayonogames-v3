import type { Metadata } from "next";
import { listGames, countGames, listPosts } from "@/lib/data";
import { GameCard } from "@/components/game-card";
import { SearchBox } from "@/components/search-box";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatDate } from "@/lib/util";
import Link from "next/link";


export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Search",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const [games, total, posts] = query
    ? await Promise.all([
        listGames({ search: query, limit: 24, sort: "downloads" }),
        countGames({ search: query }),
        listPosts({ search: query, limit: 6 }),
      ])
    : [[], 0, []];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumbs items={[{ name: `Search: ${query}` }]} />
      <div className="max-w-xl mt-6 mb-8">
        <SearchBox autoFocus placeholder="Search apps, games & posts…" />
      </div>

      {query ? (
        <>
          <h1 className="font-display text-3xl sm:text-4xl tracking-wide">
            <span className="gold-text">{total} RESULT{total === 1 ? "" : "S"} FOR “{query.toUpperCase()}”</span>
          </h1>
          {games.length === 0 ? (
            <div className="card p-12 text-center text-mute mt-8">
              <p className="text-lg font-semibold text-ink">No apps found for “{query}”</p>
              <p className="text-sm mt-2">
                Try different keywords, or{" "}
                <Link href="/request" className="text-accent hover:underline">request this app</Link>{" "}
                and we will add it for you.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {games.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
          {posts.length > 0 && (
            <section className="mt-12">
              <h2 className="section-title mb-5">From the Blog</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {posts.map((p) => (
                  <Link key={p.id} href={`/blog/${p.slug}`} className="card card-hover p-5 block group">
                    <p className="text-[0.65rem] uppercase tracking-widest text-accent font-semibold">{formatDate(p.publishedAt)}</p>
                    <p className="font-bold mt-2 leading-snug line-clamp-2 group-hover:text-gold2 transition-colors">{p.title}</p>
                    <p className="text-sm text-mute mt-2 line-clamp-2">{p.excerpt}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <p className="text-mute">Type above to search across all apps, games and blog posts.</p>
      )}
    </div>
  );
}
