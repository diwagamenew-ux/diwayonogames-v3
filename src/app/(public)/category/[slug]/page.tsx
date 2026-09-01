import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryBySlug, listGames, countGames } from "@/lib/data";
import { GameCard } from "@/components/game-card";
import { Pagination } from "@/components/pagination";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, buildMetadata } from "@/lib/seo";
import { siteUrl, configuredSiteUrl } from "@/lib/util";
import { getSettings } from "@/lib/settings";

const PAGE_SIZE = 24;

type Ctx = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params, searchParams }: Ctx): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return {};
  const s = await getSettings();
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  return buildMetadata({
    title: (cat.metaTitle || `${cat.name} APK Download`) + (page > 1 ? ` — Page ${page}` : ""),
    description: cat.metaDescription || cat.description || `Download the best ${cat.name} apps and games for Android. Latest versions and game information.`,
    path: `/category/${cat.slug}`,
    noIndex: page > 1 || cat.noIndex,
    noFollow: cat.noFollow,
    baseUrl: configuredSiteUrl(s),
    keywords: [cat.focusKeyword, cat.name].filter(Boolean),
    canonical: cat.canonicalUrl || undefined,
    ogTitle: cat.ogTitle || undefined,
    ogDescription: cat.ogDescription || undefined,
    ogImage: cat.ogImage || undefined,
    twitterTitle: cat.twitterTitle || undefined,
    twitterDescription: cat.twitterDescription || undefined,
    twitterImage: cat.twitterImage || undefined,
  });
}

export default async function CategoryPage({ params, searchParams }: Ctx) {
  const { slug } = await params;
  const sp = await searchParams;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();
  const s = await getSettings();
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const [games, total] = await Promise.all([
    listGames({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, categorySlug: cat.slug }),
    countGames({ categorySlug: cat.slug }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <JsonLd data={[
        breadcrumbSchema([
          { name: "Home", url: configuredSiteUrl(s) + "/" },
          { name: cat.name, url: `${configuredSiteUrl(s)}/category/${cat.slug}` },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${cat.name} APK Download`,
          url: `${configuredSiteUrl(s)}/category/${cat.slug}`,
          description: cat.description || undefined,
        },
      ]} />
      <Breadcrumbs items={[{ name: cat.name }]} />
      <header className="mt-4 mb-8 card-gold p-6 sm:p-8">
        <h1 className="font-display text-4xl sm:text-5xl tracking-wide gold-text">{(cat.h1 || cat.name).toUpperCase()}</h1>
        <p className="text-mute text-sm mt-2 max-w-2xl leading-relaxed">
          {cat.description || `Browse ${total} ${cat.name} apps and games with available details, versions and download links.`}
        </p>
        <p className="text-xs text-accent font-semibold mt-3 uppercase tracking-widest">{total} apps available</p>
      </header>

      {games.length === 0 ? (
        <div className="card p-12 text-center text-mute">No apps in this category yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} basePath={`/category/${cat.slug}`} />
    </div>
  );
}
