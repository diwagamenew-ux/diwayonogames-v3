import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { listGames, listCategories, listPosts } from "@/lib/data";
import { GameCard, GameRow } from "@/components/game-card";
import { MotionReveal } from "@/components/motion-reveal";
import { SearchBox } from "@/components/search-box";
import { TelegramButton } from "@/components/social-links";
import { AdSlot } from "@/components/ad-slot";
import { JsonLd } from "@/components/json-ld";
import { siteUrl, configuredSiteUrl, formatNumber, formatDate } from "@/lib/util";
import { IconShield, IconZap, IconDownload, IconCrown, IconChevron } from "@/components/icons";
import { BLUR_DATA_URL, SIZES_HERO, SIZES_ROW, SIZES_CARD } from "@/lib/blur";

// Number of category TILES shown in the "Browse Categories" grid below.
// This only limits how many category cards appear on the homepage — each
// tile's own `count` (rendered from listCategories(), which does a real
// per-category COUNT(*) in lib/data.ts) is never capped, and the category
// page (/category/[slug]) always lists every game in that category via
// listGames({ categorySlug }), independent of this constant.
const HOMEPAGE_CATEGORY_TILE_LIMIT = 8;

// Home page is ISR: re-rendered at most every 60s, served from Vercel's
// edge cache in between. `dynamic = 'force-static'` is the explicit opt-in
// Next 16 needs when a server component reads from a non-fetch data source
// (Drizzle/pg) — without it Next's static-analysis can't prove the page is
// cacheable and falls back to per-request rendering. If a hidden dynamic
// API ever sneaks in, this will fail the build with a precise pointer.
export const revalidate = 60;
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { absolute: s.seo.homepage.title || `${s.siteName} — ${s.tagline}` },
    description: s.seo.homepage.description || s.description,
    keywords: [s.seo.homepage.focusKeyword, ...s.seo.homepage.secondaryKeywords.split(",").map((k) => k.trim()), ...s.keywords.split(",").map((k) => k.trim())].filter(Boolean),
    alternates: { canonical: s.seo.homepage.canonical || `${configuredSiteUrl(s)}/` },
    robots: s.seo.homepage.noIndex || s.seo.homepage.noFollow ? { index: !s.seo.homepage.noIndex, follow: !s.seo.homepage.noFollow } : undefined,
  };
}

export default async function HomePage() {
  const s = await getSettings();
  // Each call is individually defensive so a missing/empty database at build
  // time (fresh deploy before the runtime self-heal has run) prerenders an
  // empty-but-valid page instead of failing the build. Within one ISR
  // revalidate window (60s) the page re-renders with real data.
  const emptyGames = [] as Awaited<ReturnType<typeof listGames>>;
  const emptyCats = [] as Awaited<ReturnType<typeof listCategories>>;
  const emptyPosts = [] as Awaited<ReturnType<typeof listPosts>>;
  const [topRated, latest, trending, categories, posts, totalGames, heroFeatured] = await Promise.all([
    listGames({ limit: 6, sort: "rating" }).catch(() => emptyGames),
    listGames({ limit: 12, sort: "latest" }).catch(() => emptyGames),
    listGames({ limit: 8, sort: "trending" }).catch(() => emptyGames),
    listCategories().catch(() => emptyCats),
    listPosts({ limit: 3 }).catch(() => emptyPosts),
    import("@/lib/data").then((m) => m.countGames().catch(() => 0)),
    listGames({ limit: 3, featured: true, sort: "downloads" }).catch(() => emptyGames),
  ]);
  const configuredHeroLogos = (s.homepage.heroLogos || []).filter((item) => item?.image && item?.url).slice(0, 3);
  const heroCards = configuredHeroLogos.length === 3
    ? configuredHeroLogos
    : (heroFeatured.length ? heroFeatured : latest.slice(0, 3)).map((g) => ({ title: g.title, image: g.icon, url: `/game/${g.slug}` }));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Top APK Downloads",
          itemListElement: topRated.map((g, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${configuredSiteUrl(s)}/game/${g.slug}`,
            name: g.title,
          })),
        }}
      />

      {/* ------------------------------- HERO ------------------------------- */}
      <section className="relative overflow-hidden noise-bg">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-primary/20 blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full bg-accent/10 blur-[140px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 py-12 lg:py-20 grid lg:grid-cols-2 gap-10 items-center relative">
          <MotionReveal>
            {s.homepage.heroBadge.trim() ? (
              <div className="inline-flex items-center gap-2 chip px-4 py-1.5 text-xs font-semibold text-gold2">
                <IconCrown className="w-3.5 h-3.5 text-accent" />
                {s.homepage.heroBadge}
              </div>
            ) : null}
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.95] mt-5 gold-text">{s.seo.homepage.h1 || s.homepage.h1 || `${s.siteName} – Latest Android Games & Apps`}</h1>
            <p className="text-mute mt-5 max-w-lg text-base sm:text-lg leading-relaxed">
              {s.homepage.intro || s.description}
            </p>
            <div className="mt-7 max-w-md">
              <SearchBox placeholder={`Search ${formatNumber(totalGames)}+ games…`} />
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-7">
              <Link href={s.homepage.primaryCtaUrl || "/games"} className="btn-gold px-7 py-3.5 text-sm inline-flex items-center gap-2">
                <IconDownload className="w-4 h-4" /> {s.homepage.primaryCtaText || "Explore Games"}
              </Link>
              <TelegramButton url={s.social.telegram} className="!px-6 !py-3.5" />
            </div>
            <div className="flex flex-wrap gap-6 mt-8 text-sm">
              {[
                { k: formatNumber(totalGames) + "+", v: "Apps & Games" },
                { k: "Info", v: "Game Details" },
              ].map((st) => (
                <div key={st.v}>
                  <p className="font-display text-3xl gold-text">{st.k}</p>
                  <p className="text-xs text-mute uppercase tracking-widest mt-0.5">{st.v}</p>
                </div>
              ))}
            </div>
          </MotionReveal>

          <MotionReveal delay={0.15} className="relative hidden lg:block">
            <div className="relative mx-auto max-w-md">
              <div className="card-gold gold-frame p-2 rounded-3xl rotate-2 hover:rotate-0 transition-transform duration-500">
                <SafeImage
                  src={s.logoUrl}
                  alt={`${s.siteName} logo`}
                  width={560}
                  height={340}
                  sizes={SIZES_HERO}
                  priority
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="rounded-2xl w-full h-auto object-contain"
                  fallbackSrc="/images/logo.png"
                />
              </div>
              {heroCards.map((g, i) => (
                <Link
                  key={`${g.title}-${g.url}-${i}`}
                  href={g.url}
                  className={`absolute card-gold p-3 flex items-center gap-3 shadow-2xl hover:scale-105 transition-transform ${
                    i === 0 ? "-left-16 top-8 animate-floaty" : i === 1 ? "-right-12 top-1/3 animate-floaty-slow" : "-left-10 bottom-10 animate-floaty"
                  }`}
                  style={{ animationDelay: `${i * 1.2}s` }}
                >
                  <SafeImage
                    src={g.image}
                    alt={`${g.title} logo`}
                    width={44}
                    height={44}
                    sizes={SIZES_ROW}
                    loading="lazy"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="w-11 h-11 rounded-xl object-cover gold-frame"
                  />
                  <div className="pr-1">
                    <p className="text-xs font-bold line-clamp-1 max-w-[120px]">{g.title}</p>
                    <p className="text-[0.65rem] text-accent font-semibold"></p>
                  </div>
                </Link>
              ))}
            </div>
          </MotionReveal>
        </div>

        {/* trust strip */}
        <div className="border-y border-line bg-panel/60 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { Icon: IconShield, t: "Game Details", d: "Version and app information" },
              { Icon: IconZap, t: "Download Links", d: "Available links for listed games" },
              { Icon: IconDownload, t: "Game Information", d: "Details and installation guidance" },
              { Icon: IconCrown, t: "Regular Updates", d: "Content is updated when information changes" },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="flex items-center gap-3 justify-center">
                <span className="btn-ghost p-2.5 text-accent shrink-0"><Icon className="w-4 h-4" /></span>
                <div className="text-left">
                  <p className="text-sm font-bold">{t}</p>
                  <p className="text-[0.68rem] text-mute">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4">
        <AdSlot slot={s.ads.header} className="mt-8" />

        {/* ---------------------------- TOP RATED ---------------------------- */}
        <section className="mt-14" aria-labelledby="featured-games">
          <div className="flex items-center justify-between mb-6">
            <h2 id="featured-games" className="section-title">{s.homepage.featuredTitle || "Featured Games"}</h2>
            <Link href="/games" className="text-sm text-accent font-semibold hover:underline inline-flex items-center gap-1">
              View all <IconChevron className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topRated.map((g, i) => (
              <MotionReveal key={g.id} delay={i * 0.05}>
                <GameRow game={g} rank={i + 1} />
              </MotionReveal>
            ))}
          </div>
        </section>

        {/* --------------------------- LATEST APPS --------------------------- */}
        <section className="mt-16" aria-labelledby="latest">
          <div className="flex items-center justify-between mb-6">
            <h2 id="latest" className="section-title">{s.homepage.latestTitle || "Latest Apps"}</h2>
            <Link href="/games" className="text-sm text-accent font-semibold hover:underline inline-flex items-center gap-1">
              View all <IconChevron className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {latest.slice(0, 8).map((g, i) => (
              <MotionReveal key={g.id} delay={i * 0.04}>
                <GameCard game={g} />
              </MotionReveal>
            ))}
          </div>
        </section>

        {/* ----------------------------- TRENDING ---------------------------- */}
        <section className="mt-16" aria-labelledby="trending">
          <div className="flex items-center justify-between mb-6">
            <h2 id="trending" className="section-title">{s.homepage.trendingTitle || "Trending Now"}</h2>
            <Link href="/games?sort=trending" className="text-sm text-accent font-semibold hover:underline inline-flex items-center gap-1">
              View all <IconChevron className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x [scrollbar-width:thin]">
            {trending.map((g) => (
              <div key={g.id} className="min-w-[270px] snap-start">
                <GameCard game={g} />
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------- CATEGORIES ---------------------------- */}
        {categories.length > 0 && (
          <section className="mt-16" aria-labelledby="cats">
            <h2 id="cats" className="section-title mb-6">{s.homepage.categoriesTitle || "Browse Categories"}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.slice(0, HOMEPAGE_CATEGORY_TILE_LIMIT).map((c, i) => (
                <MotionReveal key={c.id} delay={i * 0.05}>
                  <Link href={`/category/${c.slug}`} className="card card-hover p-5 block group">
                    <p className="font-display text-xl tracking-wide group-hover:text-gold2 transition-colors">
                      {c.name.toUpperCase()}
                    </p>
                    <p className="text-xs text-mute mt-1.5">{c.count} apps</p>
                    <span className="inline-block mt-3 text-accent"><IconChevron className="w-4 h-4" /></span>
                  </Link>
                </MotionReveal>
              ))}
            </div>
          </section>
        )}

        {/* ------------------------------ TELEGRAM ---------------------------- */}
        <section className="mt-16">
          <div className="card-gold p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 shimmer-line opacity-30 pointer-events-none" />
            <h2 className="font-display text-3xl sm:text-4xl gold-text tracking-wide">
              {s.homepage.ctaTitle || "GET INSTANT UPDATES & BONUS ALERTS"}
            </h2>
            <p className="text-mute mt-3 max-w-lg mx-auto text-sm sm:text-base">
              {s.homepage.ctaDescription || "Join our Telegram channel and never miss a new release or update."}
            </p>
            {s.social.telegram ? <TelegramButton url={s.social.telegram} className="mt-6" /> : null}
          </div>
        </section>

        {/* ------------------------------- BLOG ------------------------------ */}
        {posts.length > 0 && (
          <section className="mt-16" aria-labelledby="from-blog">
            <div className="flex items-center justify-between mb-6">
              <h2 id="from-blog" className="section-title">{s.homepage.blogTitle || "From the Blog"}</h2>
              <Link href="/blog" className="text-sm text-accent font-semibold hover:underline inline-flex items-center gap-1">
                All posts <IconChevron className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {posts.map((p, i) => (
                <MotionReveal key={p.id} delay={i * 0.06}>
                  <Link href={`/blog/${p.slug}`} className="card card-hover overflow-hidden block group h-full">
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
                      <h3 className="font-bold mt-2 leading-snug line-clamp-2 group-hover:text-gold2 transition-colors">
                        {p.title}
                      </h3>
                      <p className="text-sm text-mute mt-2 line-clamp-2">{p.excerpt}</p>
                    </div>
                  </Link>
                </MotionReveal>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
