import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import type { Metadata } from "next";
import { listPosts } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { Pagination } from "@/components/pagination";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema, buildMetadata } from "@/lib/seo";
import { formatDate, siteUrl, configuredSiteUrl } from "@/lib/util";
import { BLUR_DATA_URL, SIZES_CARD } from "@/lib/blur";

// Uses searchParams for pagination → Next treats this as dynamic
// automatically; the explicit force-dynamic was redundant.
const PAGE_SIZE = 12;

export async function generateMetadata({ searchParams }: {
  searchParams: Promise<{ page?: string; q?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const s = await getSettings();
  return buildMetadata({
    title: page > 1 ? `Blog — Page ${page}` : "Blog — APK News, Guides & Updates",
    description: "Latest APK news, game guides, app reviews, tips and bonus updates from our blog.",
    path: "/blog",
    noIndex: page > 1,
    baseUrl: configuredSiteUrl(s),
  });
}

export default async function BlogPage({ searchParams }: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const s = await getSettings();
  const posts = await listPosts({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, featuredFirst: page === 1 });
  // simple hasMore check by fetching one extra if full page
  const more = posts.length === PAGE_SIZE;
  const totalPages = more ? page + 1 : page;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <JsonLd data={breadcrumbSchema([
        { name: "Home", url: configuredSiteUrl(s) + "/" },
        { name: "Blog", url: configuredSiteUrl(s) + "/blog" },
      ])} />
      <Breadcrumbs items={[{ name: "Blog" }]} />
      <h1 className="font-display text-4xl sm:text-5xl tracking-wide mt-4 mb-8">
        <span className="gold-text">LATEST NEWS & GUIDES</span>
      </h1>

      {posts.length === 0 ? (
        <div className="card p-12 text-center text-mute">No posts published yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="card card-hover overflow-hidden block group">
              {p.image && (
                <div className="relative aspect-[16/9] overflow-hidden">
                  <SafeImage
                    src={p.image}
                    alt={p.title}
                    fill
                    sizes={SIZES_CARD}
                    loading="lazy"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    fallbackSrc="/images/og-default.png"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              <div className="p-5">
                <p className="text-[0.65rem] uppercase tracking-widest text-accent font-semibold">
                  {p.categoryName || "News"} · {formatDate(p.publishedAt)}
                </p>
                <h2 className="font-bold mt-2 leading-snug line-clamp-2 group-hover:text-gold2 transition-colors">
                  {p.title}
                </h2>
                <p className="text-sm text-mute mt-2 line-clamp-3">{p.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} basePath="/blog" />
    </div>
  );
}
