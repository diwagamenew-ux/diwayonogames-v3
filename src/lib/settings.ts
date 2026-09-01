import { cache } from "react";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type AdSlotConfig = { enabled: boolean; code: string };

export type SiteSettings = {
  siteName: string;
  siteUrl: string;
  tagline: string;
  description: string;
  keywords: string;
  logoUrl: string;
  faviconUrl: string;
  footerText: string;
  copyright: string;
  theme: { primary: string; accent: string };
  social: {
    telegram: string; whatsapp: string; discord: string; facebook: string;
    instagram: string; twitter: string; youtube: string; email: string; website: string;
  };
  homepage: {
    heroBadge: string;
    h1: string;
    intro: string;
    primaryCtaText: string;
    primaryCtaUrl: string;
    secondaryCtaText: string;
    secondaryCtaUrl: string;
    featuredTitle: string;
    latestTitle: string;
    trendingTitle: string;
    categoriesTitle: string;
    blogTitle: string;
    ctaTitle: string;
    ctaDescription: string;
    ctaButtonText: string;
    heroLogos: { title: string; image: string; url: string }[];
  };
  seo: {
    homepage: {
      title: string;
      description: string;
      focusKeyword: string;
      secondaryKeywords: string;
      h1: string;
      canonical: string;
      noIndex: boolean;
      noFollow: boolean;
      ogTitle: string;
      ogDescription: string;
      ogImage: string;
      twitterTitle: string;
      twitterDescription: string;
      twitterImage: string;
    };
    googleVerification: string; bingVerification: string; yandexVerification: string;
    analyticsCode: string; gtmCode: string; clarityCode: string; indexNowKey: string;
  };
  ads: {
    header: AdSlotConfig; sidebar: AdSlotConfig; inContent: AdSlotConfig;
    stickyBottom: AdSlotConfig; popup: AdSlotConfig; beforeDownload: AdSlotConfig;
  };
  features: {
    maintenanceMode: boolean; maintenanceMessage: string;
    telegramFloat: boolean; whatsappFloat: boolean; cookieConsent: boolean;
  };
  nav: {
    headerLinks: { label: string; url: string }[];
    footerLinks: { label: string; url: string }[];
  };
  smtp: { host: string; port: string; user: string; pass: string; from: string };
};

// Fallback values only — used when the "site" row hasn't been saved to the
// DB yet (deepMerge below lets any real row from Site Settings override
// every field here, individually). The social handles/email are
// placeholders; confirm/edit the real ones in Admin → Site Settings →
// Social Links before relying on them anywhere public-facing.
export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "YonoDiwaGames",
  siteUrl: "https://diwayonogames.xyz",
  tagline: "New Diwa & Yono Games — Discover, Download & Play",
  description:
    "New Diwa & Yono Games — Discover Android games and apps with game information, versions, installation guidance and available download links.",
  keywords: "android games, apk download, games apk, android apps, latest games",
  logoUrl: "/images/logo.png",
  faviconUrl: "/images/logo.png",
  footerText:
    "Discover the latest Android games and apps with game information, updates and download access.",
  copyright: `© ${new Date().getFullYear()} YonoDiwaGames • All Rights Reserved`,
  theme: { primary: "#8b5cf6", accent: "#f5b942" },
  // Intentionally blank in the reusable template. Add the real brand
  // profiles from Admin → Settings → Social Links before publishing them.
  social: {
    telegram: "", whatsapp: "", discord: "", facebook: "", instagram: "",
    twitter: "", youtube: "", email: "", website: "",
  },
  homepage: {
    heroBadge: "Latest Android Games & Apps",
    h1: "YonoDiwaGames – Latest Android Games & Apps",
    intro: "Explore Android games and apps with game information, version details, installation guidance and download links.",
    primaryCtaText: "Explore Games",
    primaryCtaUrl: "/games",
    secondaryCtaText: "",
    secondaryCtaUrl: "",
    featuredTitle: "Featured Games",
    latestTitle: "Latest Apps",
    trendingTitle: "Trending Now",
    categoriesTitle: "Browse Categories",
    blogTitle: "From the Blog",
    ctaTitle: "GET INSTANT UPDATES & BONUS ALERTS",
    ctaDescription: "Join our Telegram channel and never miss a new release, update or useful game information.",
    ctaButtonText: "Join Telegram",
    heroLogos: [
      { title: "Diwa Win", image: "/images/games/diwa-win.png", url: "/game/diwa-win-apk" },
      { title: "Diwa Top", image: "/images/games/diwa-top.png", url: "/game/diwa-top-apk" },
      { title: "Gold Slots 777", image: "/images/games/gold-slots.png", url: "/game/gold-slots-777-apk" },
    ],
  },
  seo: {
    homepage: {
      title: "YonoDiwaGames – New Diwa & Yono Games APK",
      description: "YonoDiwaGames helps you discover Diwa, Yono and Android games with APK updates, game information, installation guides and useful download details.",
      focusKeyword: "yonodiwagames",
      secondaryKeywords: "diwa game, yono games, android games, apk download",
      h1: "YonoDiwaGames – Latest Android Games & Apps",
      canonical: "",
      noIndex: false,
      noFollow: false,
      ogTitle: "",
      ogDescription: "",
      ogImage: "/images/og-default.png",
      twitterTitle: "",
      twitterDescription: "",
      twitterImage: "/images/og-default.png",
    },
    googleVerification: "", bingVerification: "", yandexVerification: "",
    analyticsCode: "", gtmCode: "", clarityCode: "", indexNowKey: "",
  },
  ads: {
    header: { enabled: false, code: "" },
    sidebar: { enabled: false, code: "" },
    inContent: { enabled: false, code: "" },
    stickyBottom: { enabled: false, code: "" },
    popup: { enabled: false, code: "" },
    beforeDownload: { enabled: false, code: "" },
  },
  features: {
    maintenanceMode: false,
    maintenanceMessage: "We are performing scheduled maintenance. Please check back soon.",
    telegramFloat: true,
    whatsappFloat: false,
    cookieConsent: true,
  },
  nav: {
    headerLinks: [
      { label: "Games", url: "/games" },
      { label: "Blog", url: "/blog" },
      { label: "Request", url: "/request" },
      { label: "Contact", url: "/contact" },
    ],
    footerLinks: [
      { label: "Privacy Policy", url: "/page/privacy-policy" },
      { label: "Terms & Conditions", url: "/page/terms-and-conditions" },
      { label: "DMCA", url: "/page/dmca" },
      { label: "Disclaimer", url: "/page/disclaimer" },
      { label: "Contact Us", url: "/contact" },
    ],
  },
  smtp: { host: "", port: "587", user: "", pass: "", from: "" },
};

function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base;
  if (Array.isArray(base)) return (override as T) ?? base;
  if (typeof base === "object" && base !== null) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const k of Object.keys(base as Record<string, unknown>)) {
      out[k] = deepMerge(
        (base as Record<string, unknown>)[k],
        (override as Record<string, unknown>)?.[k]
      );
    }
    return out as T;
  }
  return (override as T) ?? base;
}

export const getSettings = cache(async function getSettings(): Promise<SiteSettings> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "site"))
      .limit(1);
    if (!row) return DEFAULT_SETTINGS;
    const merged = deepMerge(DEFAULT_SETTINGS, row.value);
    // Older settings rows predate the 3 homepage hero-logo slots. Normalize
    // them here so the admin UI always has exactly three editable slots.
    const defaults = DEFAULT_SETTINGS.homepage.heroLogos;
    const current = Array.isArray(merged.homepage.heroLogos) ? merged.homepage.heroLogos : [];
    merged.homepage.heroLogos = [0, 1, 2].map((i) => current[i] || defaults[i]);
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export async function saveSettings(value: SiteSettings) {
  await db
    .insert(settings)
    .values({ key: "site", value: value as unknown as Record<string, unknown> })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as unknown as Record<string, unknown> } as never });
}
