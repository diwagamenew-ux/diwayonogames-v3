import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatDate, configuredSiteUrl } from "@/lib/util";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-static";
export const revalidate = 600;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return {};
  const s = await getSettings();
  return buildMetadata({
    title: page.metaTitle || page.title,
    description: page.metaDescription || `${page.title} — read our policies and information.`,
    path: `/page/${page.slug}`,
    noIndex: page.noIndex,
    noFollow: page.noFollow,
    baseUrl: configuredSiteUrl(s),
    keywords: [page.focusKeyword].filter(Boolean),
    canonical: page.canonicalUrl || undefined,
    ogTitle: page.ogTitle || undefined,
    ogDescription: page.ogDescription || undefined,
    ogImage: page.ogImage || undefined,
    twitterTitle: page.twitterTitle || undefined,
    twitterDescription: page.twitterDescription || undefined,
    twitterImage: page.twitterImage || undefined,
  });
}

export default async function StaticPage({ params }: Params) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Breadcrumbs items={[{ name: page.title }]} />
      <h1 className="font-display text-4xl sm:text-5xl tracking-wide mt-5 gold-text">
        {(page.h1 || page.title).toUpperCase()}
      </h1>
      <p className="text-xs text-mute mt-3">Last updated: {formatDate(page.updatedAt)}</p>
      <div className="rich-html mt-8" dangerouslySetInnerHTML={{ __html: page.content }} />
    </div>
  );
}
