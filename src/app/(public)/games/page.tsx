import type { Metadata } from "next";
import { listGames, countGames } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { GameCard } from "@/components/game-card";
import { Pagination } from "@/components/pagination";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, buildMetadata } from "@/lib/seo";
import { siteUrl, configuredSiteUrl } from "@/lib/util";
import type { SortMode } from "@/lib/data";
import Link from "next/link";


const PAGE_SIZE = 24;

const SORTS: { key: SortMode; label: string }[] = [
  { key: "latest", label: "Latest" },
  { key: "trending", label: "Trending" },
  { key: "rating", label: "Top Rated" },
  { key: "popular", label: "Most Viewed" },
  { key: "downloads", label: "Most Downloaded" },
];

export async function generateMetadata({ searchParams }: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const s = await getSettings();
  return buildMetadata({
    title: page > 1 ? `All Games & Apps — Page ${page}` : "All Games & Apps",
    description: "Browse Android games and apps with game information, versions, categories, installation guidance and available download links.",
    path: "/games",
    noIndex: page > 1,
    baseUrl: configuredSiteUrl(s),
  });
}

export default async function GamesPage({ searchParams }: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const s = await getSettings();
  const sort = (SORTS.some((s) => s.key === sp.sort) ? sp.sort : "latest") as SortMode;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const [gamesList, total] = await Promise.all([
    listGames({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, sort }),
    countGames(),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <JsonLd data={breadcrumbSchema([
        { name: "Home", url: configuredSiteUrl(s) + "/" },
        { name: "Games", url: configuredSiteUrl(s) + "/games" },
      ])} />
      <Breadcrumbs items={[{ name: "Games" }]} />
      <div className="flex flex-wrap items-end justify-between gap-4 mt-4 mb-8">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-wide">
            <span className="gold-text">ALL GAMES & APPS</span>
          </h1>
          <p className="text-mute text-sm mt-2">{total} games and apps listed</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={`/games${s.key === "latest" ? "" : `?sort=${s.key}`}`}
              className={`chip px-4 py-2 text-xs font-semibold ${sort === s.key ? "!border-accent !text-gold2" : "text-mute"}`}
              aria-current={sort === s.key ? "true" : undefined}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {gamesList.length === 0 ? (
        <div className="card p-12 text-center text-mute">No games found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {gamesList.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} basePath="/games" query={sort === "latest" ? {} : { sort }} />
    </div>
  );
}
