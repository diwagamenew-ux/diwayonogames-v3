import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostBySlug, getApprovedReviews, listPosts } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { buildMetadata, articleSchema, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ShareButtons } from "@/components/share-buttons";
import { ReviewForm } from "@/components/review-form";
import { ViewTracker } from "@/components/view-tracker";
import { ProgressBar } from "@/components/progress-bar";
import { AdSlot } from "@/components/ad-slot";
import { GameCard } from "@/components/game-card";
import { listGames } from "@/lib/data";
import { IconClock, IconEye } from "@/components/icons";
import { formatDate, formatNumber, readingTime, siteUrl, configuredSiteUrl } from "@/lib/util";
import { Stars } from "@/components/stars";
import { BLUR_DATA_URL, SIZES_HERO, SIZES_ROW } from "@/lib/blur";

export const dynamic = "force-static";
export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  const s = await getSettings();
  return buildMetadata({
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    path: `/blog/${post.slug}`,
    image: post.image || "/images/og-default.png",
    keywords: [post.focusKeyword, post.categoryName || "", ...post.tags.map((t) => t.name)].filter(Boolean),
    type: "article",
    publishedTime: new Date(post.publishedAt).toISOString(),
    modifiedTime: new Date(post.updatedAt).toISOString(),
    noIndex: post.noIndex,
    noFollow: post.noFollow,
    baseUrl: configuredSiteUrl(s),
    ogTitle: post.ogTitle || undefined,
    ogDescription: post.ogDescription || undefined,
    ogImage: post.ogImage || undefined,
    twitterTitle: post.twitterTitle || undefined,
    twitterDescription: post.twitterDescription || undefined,
    twitterImage: post.twitterImage || undefined,
  });
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.status !== "published") notFound();

  const s = await getSettings();
  const [comments, relatedPosts, featuredGames] = await Promise.all([
    getApprovedReviews({ postId: post.id }, 30),
    listPosts({ limit: 4 }),
    listGames({ limit: 3, sort: "downloads" }),
  ]);
  const mins = readingTime(post.content);

  return (
    <>
      <ProgressBar />
      <JsonLd data={[
        articleSchema({
          title: post.title, slug: post.slug, excerpt: post.excerpt, image: post.image,
          publishedAt: post.publishedAt, updatedAt: post.updatedAt, authorName: post.authorName || s.siteName, baseUrl: configuredSiteUrl(s),
        }, s),
        breadcrumbSchema([
          { name: "Home", url: configuredSiteUrl(s) + "/" },
          { name: "Blog", url: configuredSiteUrl(s) + "/blog" },
          { name: post.title, url: `${configuredSiteUrl(s)}/blog/${post.slug}` },
        ]),
      ]} />
      <ViewTracker postId={post.id} />

      <article className="max-w-3xl mx-auto px-4 py-8">
        <Breadcrumbs items={[{ name: "Blog", href: "/blog" }, { name: post.title }]} />
        <h1 className="font-display text-3xl sm:text-5xl leading-[1.05] tracking-wide mt-5">
          {(post.h1 || post.title).toUpperCase()}
        </h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-mute">
          <span>By <b className="text-gold2">{post.authorName || s.siteName}</b></span>
          <span className="inline-flex items-center gap-1"><IconClock className="w-3.5 h-3.5 text-accent" /> {formatDate(post.publishedAt)}</span>
          <span className="inline-flex items-center gap-1"><IconEye className="w-3.5 h-3.5 text-accent" /> {formatNumber(post.views)} views</span>
          <span>{mins} min read</span>
        </div>

        {post.image && (
          <div className="card-gold p-2 mt-6 rounded-2xl">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl">
              <SafeImage
                src={post.image}
                alt={post.title}
                title={post.title}
                fill
                priority
                sizes={SIZES_HERO}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                fallbackSrc="/images/og-default.png"
                className="object-cover"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-5">
          <ShareButtons title={post.title} path={`/blog/${post.slug}`} />
        </div>

        <AdSlot slot={s.ads.inContent} className="my-6" />

        <div className="rich-html mt-2" dangerouslySetInnerHTML={{ __html: post.content }} />

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-8">
            {post.tags.map((t) => (
              <Link key={t.id} href={`/tag/${t.slug}`} className="chip px-3.5 py-1.5 text-xs text-mute">
                #{t.name}
              </Link>
            ))}
          </div>
        )}

        {/* Featured games internal linking */}
        <section className="mt-12" aria-labelledby="featured-games">
          <h2 id="featured-games" className="section-title mb-5">Featured Games</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {featuredGames.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>

        {/* Comments */}
        <section className="mt-12 space-y-5" aria-labelledby="comments">
          <h2 id="comments" className="section-title">Comments ({comments.length})</h2>
          {comments.length === 0 && (
            <p className="text-sm text-mute">No comments yet. Start the discussion!</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full btn-violet flex items-center justify-center font-bold text-sm uppercase">
                  {c.name.charAt(0)}
                </span>
                <div>
                  <p className="font-semibold text-sm">{c.name}</p>
                  <p className="text-[0.65rem] text-mute">{formatDate(c.createdAt)}</p>
                </div>
                <Stars rating={c.rating} size="w-3 h-3" showValue={false} className="ml-auto" />
              </div>
              <p className="text-sm text-mute mt-3 leading-relaxed">{c.comment}</p>
            </div>
          ))}
          <ReviewForm postId={post.id} />
        </section>

        {/* Related posts */}
        <section className="mt-12" aria-labelledby="related-posts">
          <h2 id="related-posts" className="section-title mb-5">More From the Blog</h2>
          <ul className="grid gap-3">
            {relatedPosts.filter((p) => p.id !== post.id).slice(0, 3).map((p) => (
              <li key={p.id}>
                <Link href={`/blog/${p.slug}`} className="card card-hover p-4 flex items-center gap-4 group">
                  {p.image && (
                    <SafeImage src={p.image} alt={p.title} loading="lazy" width={80} height={52} sizes={SIZES_ROW} placeholder="blur" blurDataURL={BLUR_DATA_URL} fallbackSrc="/images/og-default.png" className="w-20 h-[52px] rounded-lg object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm line-clamp-2 group-hover:text-gold2 transition-colors">{p.title}</p>
                    <p className="text-[0.68rem] text-mute mt-1">{formatDate(p.publishedAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </>
  );
}
