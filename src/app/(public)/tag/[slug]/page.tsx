import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTagBySlug, gamesByTag } from "@/lib/data";
import { GameCard } from "@/components/game-card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, buildMetadata } from "@/lib/seo";
import { siteUrl, configuredSiteUrl } from "@/lib/util";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-static";
export const revalidate = 300;

type Ctx = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) return {};
  const s = await getSettings();
  return buildMetadata({
    title: tag.metaTitle || `${tag.name} — Apps & Games`,
    description: tag.metaDescription || `Browse Android games and apps tagged "${tag.name}".`,
    path: `/tag/${tag.slug}`,
    baseUrl: configuredSiteUrl(s),
    keywords: [tag.focusKeyword, tag.name].filter(Boolean),
    canonical: tag.canonicalUrl || undefined,
    noIndex: tag.noIndex,
    noFollow: tag.noFollow,
  });
}

export default async function TagPage({ params }: Ctx) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) notFound();
  const s = await getSettings();
  const games = await gamesByTag(tag.id, 48);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <JsonLd data={breadcrumbSchema([
        { name: "Home", url: configuredSiteUrl(s) + "/" },
        { name: tag.name, url: `${configuredSiteUrl(s)}/tag/${tag.slug}` },
      ])} />
      <Breadcrumbs items={[{ name: tag.name }]} />
      <header className="mt-4 mb-8">
        <h1 className="font-display text-4xl sm:text-5xl tracking-wide">
          <span className="gold-text">{(tag.h1 || tag.name).toUpperCase()}</span>
        </h1>
        <p className="text-mute text-sm mt-2">{games.length} apps tagged “{tag.name}”</p>
      </header>
      {games.length === 0 ? (
        <div className="card p-12 text-center text-mute">No apps with this tag yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
