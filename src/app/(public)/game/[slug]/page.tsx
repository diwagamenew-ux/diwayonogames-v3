import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameBySlug, relatedGames, developerGames, getApprovedReviews, listGames, listPosts, listCategories, listTagsWithCount } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { buildMetadata, gameSchema, breadcrumbSchema, faqSchema } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GameCard } from "@/components/game-card";
import { Stars } from "@/components/stars";
import { TelegramButton } from "@/components/social-links";
import { ShareButtons } from "@/components/share-buttons";
import { FaqAccordion } from "@/components/faq-accordion";
import { ReviewForm } from "@/components/review-form";
import { CaptchaForm } from "@/components/captcha-form";
import { ViewTracker } from "@/components/view-tracker";
import { AdSlot } from "@/components/ad-slot";
import { SearchBox } from "@/components/search-box";
import { IconDownload, IconShield, IconEye, IconClock, IconCrown } from "@/components/icons";
import { formatNumber, formatDate, siteUrl, configuredSiteUrl, displayRating } from "@/lib/util";
import { BLUR_DATA_URL, SIZES_ROW } from "@/lib/blur";

// Game detail pages are ISR with a 5-minute TTL. The slug is dynamic so
// Next renders on first request and caches the result; subsequent visits
// within 5 minutes hit the edge cache.
export const dynamic = "force-static";
export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return {};
  const s = await getSettings();
  const title = game.metaTitle || `${game.title} APK Download Latest Version ${game.version}`;
  const description =
    game.metaDescription || game.shortDesc ||
    `View ${game.title} APK version ${game.version} for Android, including available app details, installation information and download links on ${s.siteName}.`;
  return buildMetadata({
    title, description,
    path: `/game/${game.slug}`,
    image: game.banner || game.icon || "/images/og-default.png",
    keywords: [
      game.focusKeyword, game.title, `${game.title} apk`, `${game.title} download`,
      game.categoryName || "", ...game.tags.map((t) => t.name),
    ].filter(Boolean),
    canonical: game.canonicalUrl || undefined,
    type: "article",
    baseUrl: configuredSiteUrl(s),
    ogTitle: game.ogTitle || undefined,
    ogDescription: game.ogDescription || undefined,
    ogImage: game.ogImage || undefined,
    twitterTitle: game.twitterTitle || undefined,
    twitterDescription: game.twitterDescription || undefined,
    twitterImage: game.twitterImage || undefined,
    publishedTime: new Date(game.publishedAt).toISOString(),
    modifiedTime: new Date(game.updatedAt).toISOString(),
    noIndex: game.noIndex,
  });
}

export default async function GamePage({ params }: Params) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game || game.status !== "published") notFound();

  const s = await getSettings();
  const [related, devApps, reviews, popular, recentPosts, cats, tagCloud] = await Promise.all([
    relatedGames(game, 6),
    developerGames(game.developer, game.id, 6),
    getApprovedReviews({ gameId: game.id }, 20),
    listGames({ limit: 5, sort: "popular" }),
    listPosts({ limit: 5 }),
    listCategories(),
    listTagsWithCount(),
  ]);

  const firstLink = game.links[0];
  const gameRating = displayRating(game);
  const crumbs = [
    { name: "Games", href: "/games" },
    ...(game.categorySlug && game.categoryName
      ? [{ name: game.categoryName, href: `/category/${game.categorySlug}` }]
      : []),
    { name: game.title },
  ];

  return (
    <>
      <JsonLd data={[
        gameSchema({
          title: game.title, slug: game.slug, shortDesc: game.shortDesc, icon: game.icon,
          version: game.version, size: game.size, developer: game.developer,
          rating: game.rating, ratingCount: game.ratingCount, updatedAt: game.updatedAt,
          categoryName: game.categoryName || "Game", baseUrl: configuredSiteUrl(s),
        }),
        breadcrumbSchema([
          { name: "Home", url: configuredSiteUrl(s) + "/" },
          { name: "Games", url: configuredSiteUrl(s) + "/games" },
          ...(game.categorySlug && game.categoryName
            ? [{ name: game.categoryName, url: `${configuredSiteUrl(s)}/category/${game.categorySlug}` }]
            : []),
          { name: game.title, url: `${configuredSiteUrl(s)}/game/${game.slug}` },
        ]),
        ...(game.faqs.length > 0 ? [faqSchema(game.faqs)] : []),
      ]} />
      <ViewTracker gameId={game.id} />

      <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_330px] gap-8">
        {/* ------------------------------- MAIN ------------------------------ */}
        <article className="min-w-0">
          <Breadcrumbs items={crumbs} />

          <h1 className="font-display text-3xl sm:text-5xl leading-[1.02] tracking-wide mt-4">
            {(game.h1 || `${game.title} APK Download`).toUpperCase()}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {game.categorySlug && game.categoryName && (
              <Link href={`/category/${game.categorySlug}`} className="chip px-3 py-1 text-[0.7rem] font-bold text-violet-300 uppercase tracking-wider">
                {game.categoryName}
              </Link>
            )}
            {game.tags.slice(0, 3).map((t) => (
              <Link key={t.id} href={`/tag/${t.slug}`} className="chip px-3 py-1 text-[0.7rem] text-accent uppercase tracking-wider">
                {t.name}
              </Link>
            ))}
          </div>

          {game.shortDesc && (
            <p className="text-mute mt-4 leading-relaxed">{game.shortDesc}</p>
          )}

          {/* App info card */}
          <div className="card-gold p-5 sm:p-6 mt-6">
            <div className="flex flex-col sm:flex-row gap-5">
              <SafeImage
                src={game.icon || "/images/logo.png"}
                alt={`${game.title} APK icon`}
                title={`${game.title} APK Download`}
                width={120}
                height={120}
                sizes="(max-width: 640px) 100px, 120px"
                priority
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] rounded-3xl object-cover gold-frame shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
                  {[
                    ["Updated", formatDate(game.updatedAt)],
                    ["Version", game.version],
                    ["Size", game.size || "—"],
                    ["Developer", game.developer || "—"],
                    ["Requires", `Android ${game.minAndroid}`],
                    ["Package", game.packageName || "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[0.62rem] uppercase tracking-widest text-mute">{k}</p>
                      <p className="font-semibold text-[0.85rem] mt-0.5 truncate" title={v}>{v}</p>
                    </div>
                  ))}
                </div>

              </div>
            </div>

            <div id="download" className="mt-5 grid gap-3">
              <AdSlot slot={s.ads.beforeDownload} />
              {firstLink ? (
                <a
                  href={`/api/download/${firstLink.id}`}
                  rel="nofollow"
                  className="btn-gold animate-glow w-full overflow-hidden px-4 py-3 flex flex-col items-center justify-center gap-1"
                >
                  <span className="inline-flex items-center gap-2 text-base sm:text-lg font-extrabold uppercase tracking-wider leading-none">
                    <IconDownload className="w-5 h-5 shrink-0" />
                    Download APK
                  </span>
                  <span className="max-w-full truncate text-[0.68rem] font-bold opacity-75 tracking-wide leading-none">
                    {game.title} · v{game.version}{game.size ? ` · ${game.size}` : ""}
                  </span>
                </a>
              ) : (
                <p className="text-mute text-sm text-center py-3">Download link coming soon.</p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[0.7rem] text-mute inline-flex items-center gap-1.5">
                  <IconShield className="w-3.5 h-3.5 text-emerald-400" /> Review the app details and installation information before downloading
                </p>
                <ShareButtons title={game.title} path={`/game/${game.slug}`} />
              </div>
              <CaptchaForm kind="report" gameId={game.id} url={`/game/${game.slug}`} compact />
            </div>
          </div>

          <TelegramButton url={s.social.telegram} className="w-full mt-5 py-4" />

          {/* Description */}
          <section className="mt-10" aria-labelledby="desc">
            <h2 id="desc" className="section-title mb-5">Description</h2>
            <AdSlot slot={s.ads.inContent} className="mb-5" />
            <div
              className="rich-html"
              dangerouslySetInnerHTML={{ __html: game.content || `<p>${game.shortDesc}</p>` }}
            />
          </section>

          {/* How to install */}
          <section className="mt-10 card p-5 sm:p-6" aria-labelledby="howto">
            <h2 id="howto" className="font-display text-2xl tracking-wide gold-text mb-4">
              How to Download & Install {game.title} APK
            </h2>
            <ol className="space-y-3 text-sm text-mute leading-relaxed list-none">
              {[
                `Click the "Download ${game.title} APK" button above to get the latest version ${game.version}.`,
                "Once the download page opens, tap on the APK file to save it to your device.",
                `Open your phone Settings → Security and enable "Install from Unknown Sources".`,
                "Open the downloaded APK file and tap Install.",
                "Launch the app, register with your mobile number and start exploring.",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="btn-gold w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          {/* FAQ */}
          {game.faqs.length > 0 && (
            <section className="mt-10" aria-labelledby="faq">
              <h2 id="faq" className="section-title mb-5">Frequently Asked Questions</h2>
              <FaqAccordion faqs={game.faqs} />
            </section>
          )}

          {/* Download links */}
          {game.links.length > 0 && (
            <section className="mt-10" aria-labelledby="dllinks">
              <h2 id="dllinks" className="section-title mb-5">Download Links</h2>
              <div className="space-y-3">
                {game.links.map((l) => (
                  <div key={l.id} className="card p-3 sm:p-4 flex flex-wrap items-center gap-2.5 sm:gap-3 overflow-hidden">
                    <span className="btn-ghost w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-accent font-bold text-sm shrink-0">
                      {l.sort + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm line-clamp-1">{l.label}</p>
                      <p className="text-[0.68rem] sm:text-xs text-mute line-clamp-1">
                        {l.version ? `v${l.version} · ` : ""}{l.size || ""}
                        {l.hits > 0 ? ` · ${formatNumber(l.hits)} downloads` : ""}
                      </p>
                    </div>
                    <a
                      href={`/api/download/${l.id}`}
                      rel="nofollow"
                      className="btn-gold px-4 sm:px-5 py-2.5 text-[0.7rem] sm:text-xs inline-flex items-center justify-center gap-2 uppercase tracking-wider whitespace-nowrap max-sm:w-full"
                    >
                      <IconDownload className="w-4 h-4 shrink-0" /> Download
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related apps */}
          {related.length > 0 && (
            <section className="mt-12" aria-labelledby="related">
              <h2 id="related" className="section-title mb-5">Related Apps</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {related.map((g) => (
                  <GameCard key={g.id} game={g} />
                ))}
              </div>
            </section>
          )}

          {/* Developer apps */}
          {devApps.length > 0 && (
            <section className="mt-12" aria-labelledby="devapps">
              <h2 id="devapps" className="section-title mb-5">{`Developer's Apps`}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {devApps.map((g) => (
                  <GameCard key={g.id} game={g} />
                ))}
              </div>
            </section>
          )}

          {/* Tags */}
          {game.tags.length > 0 && (
            <section className="mt-10" aria-labelledby="gametags">
              <h2 id="gametags" className="section-title mb-4">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {game.tags.map((t) => (
                  <Link key={t.id} href={`/tag/${t.slug}`} className="chip px-3.5 py-1.5 text-xs text-mute">
                    {t.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Reviews */}
          <section className="mt-12 space-y-5" aria-labelledby="reviews">
            <h2 id="reviews" className="section-title">User Reviews ({reviews.length})</h2>
            {reviews.length === 0 && (
              <p className="text-sm text-mute">No reviews yet. Be the first to share your experience!</p>
            )}
            {reviews.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full btn-violet flex items-center justify-center font-bold text-sm uppercase">
                    {r.name.charAt(0)}
                  </span>
                  <div>
                    <p className="font-semibold text-sm">{r.name}</p>
                    <p className="text-[0.65rem] text-mute inline-flex items-center gap-1">
                      <IconClock className="w-3 h-3" /> {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <Stars rating={r.rating} size="w-3.5 h-3.5" showValue={false} className="ml-auto" />
                </div>
                <p className="text-sm text-mute mt-3 leading-relaxed">{r.comment}</p>
              </div>
            ))}
            <ReviewForm gameId={game.id} />
          </section>
        </article>

        {/* ------------------------------ SIDEBAR ---------------------------- */}
        <aside className="space-y-6 lg:sticky lg:top-24 self-start">
          <div className="card p-4">
            <SearchBox placeholder="Search apps…" />
          </div>

          <div className="card-gold p-5 text-center">
            <IconCrown className="w-8 h-8 text-accent mx-auto" />
            <p className="font-display text-xl tracking-wide mt-2 gold-text">JOIN {s.siteName.toUpperCase()}</p>
            <p className="text-xs text-mute mt-1.5 mb-4">New releases, bonus codes & exclusive offers on Telegram.</p>
            <TelegramButton url={s.social.telegram} className="w-full !py-3 text-xs" />
          </div>

          <AdSlot slot={s.ads.sidebar} />

          <div className="card p-5">
            <h3 className="section-title text-lg mb-4">Popular Apps</h3>
            <div className="space-y-3">
              {popular.map((g) => (
                <Link key={g.id} href={`/game/${g.slug}`} className="flex items-center gap-3 group">
                  <SafeImage src={g.icon || "/images/logo.png"} alt={`${g.title} icon`} loading="lazy" width={44} height={44} sizes={SIZES_ROW} placeholder="blur" blurDataURL={BLUR_DATA_URL} className="w-11 h-11 rounded-xl object-cover gold-frame shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold line-clamp-1 group-hover:text-gold2 transition-colors">{g.title}</p>
                    <p className="text-[0.68rem] text-mute">{formatNumber(g.views)} views · ★ {displayRating(g).value.toFixed(1)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="section-title text-lg mb-4">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`} className="chip px-3 py-1.5 text-xs text-mute">
                  {c.name} ({c.count})
                </Link>
              ))}
            </div>
          </div>

          {recentPosts.length > 0 && (
            <div className="card p-5">
              <h3 className="section-title text-lg mb-4">Recent Posts</h3>
              <ul className="space-y-2.5 text-sm text-mute">
                {recentPosts.map((p) => (
                  <li key={p.id}>
                    <Link href={`/blog/${p.slug}`} className="hover:text-accent transition-colors line-clamp-2 leading-snug">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card p-5">
            <h3 className="section-title text-lg mb-4">Top Tags</h3>
            <div className="flex flex-wrap gap-2">
              {tagCloud.filter((t) => t.count > 0).slice(0, 14).map((t) => (
                <Link key={t.id} href={`/tag/${t.slug}`} className="chip px-3 py-1.5 text-xs text-mute">
                  {t.name}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
