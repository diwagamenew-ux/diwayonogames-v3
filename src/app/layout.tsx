import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Outfit } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { configuredSiteUrl } from "@/lib/util";
import { JsonLd } from "@/components/json-ld";
import { organizationSchema, websiteSchema } from "@/lib/seo";
import { Analytics } from "@/components/analytics";

// ---- Fonts ----------------------------------------------------------------
// next/font/google self-hosts the fonts at build time, inlines the @font-face
// rules with the correct unicode-range subsets, preloads the files via
// <link rel="preload" as="font">, and exposes CSS variables we wire into
// Tailwind's @theme block in globals.css. No render-blocking stylesheet
// request, no third-party preconnect, no FOUT.
const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bebas",
  preload: true,
});
const outfit = Outfit({
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
  preload: true,
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const base = configuredSiteUrl(s);
  const homeSeo = s.seo.homepage;
  const other: Record<string, string> = {};
  if (s.seo.bingVerification) other["msvalidate.01"] = s.seo.bingVerification;
  if (s.seo.yandexVerification) other["yandex-verification"] = s.seo.yandexVerification;
  return {
    metadataBase: new URL(base + "/"),
    title: { default: homeSeo.title || `${s.siteName} — ${s.tagline}`, template: `%s | ${s.siteName}` },
    description: homeSeo.description || s.description,
    keywords: [homeSeo.focusKeyword, ...homeSeo.secondaryKeywords.split(",").map((k) => k.trim()), ...s.keywords.split(",").map((k) => k.trim())].filter(Boolean),
    icons: { icon: s.faviconUrl, apple: s.logoUrl },
    manifest: "/manifest.webmanifest",
    verification: {
      google: s.seo.googleVerification || undefined,
      other: Object.keys(other).length ? other : undefined,
    },
    alternates: { canonical: homeSeo.canonical || `${base}/` },
    robots: homeSeo.noIndex || homeSeo.noFollow ? { index: !homeSeo.noIndex, follow: !homeSeo.noFollow } : undefined,
    openGraph: {
      siteName: s.siteName,
      type: "website",
      title: homeSeo.ogTitle || homeSeo.title || s.siteName,
      description: homeSeo.ogDescription || homeSeo.description || s.description,
      images: [{ url: homeSeo.ogImage || "/images/og-default.png", width: 1200, height: 630, alt: s.siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title: homeSeo.twitterTitle || homeSeo.ogTitle || homeSeo.title || s.siteName,
      description: homeSeo.twitterDescription || homeSeo.ogDescription || homeSeo.description || s.description,
      images: [homeSeo.twitterImage || homeSeo.ogImage || "/images/og-default.png"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2fb" },
    { media: "(prefers-color-scheme: dark)", color: "#07060d" },
  ],
  width: "device-width",
  initialScale: 1,
};

function isHex(v: string) {
  return /^#[0-9a-fA-F]{3,8}$/.test(v.trim());
}

/**
 * Root layout — intentionally static-friendly. No headers(), no cookies(),
 * no request-bound APIs. Everything request-specific (chrome, maintenance
 * gate, admin detection) lives in the (public) route-group layout or is
 * handled client-side via the inline script below. This is what lets every
 * public page participate in ISR / SSG.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const s = await getSettings();
  const base = configuredSiteUrl(s);
  const themeVars =
    (isHex(s.theme.primary) ? `--primary:${s.theme.primary};--primary2:${s.theme.primary};` : "") +
    (isHex(s.theme.accent) ? `--accent:${s.theme.accent};` : "");

  // Inline script runs before first paint: picks the theme from localStorage
  // (default light) and tags admin routes so CSS can hide the public chrome
  // without the server having to know the pathname. No flash, no layout shift.
  const bootScript = `(function(){try{var d=document.documentElement,m=localStorage.getItem('av-theme');if(m==='dark')d.classList.remove('light');else d.classList.add('light');if(location.pathname.indexOf('/admin')===0)d.classList.add('is-admin')}catch(e){}})();`;

  return (
    <html lang="en" className={`light ${bebas.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        {themeVars ? <style>{`:root{${themeVars}}`}</style> : null}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="bg-base text-ink font-body min-h-screen flex flex-col antialiased">
        <JsonLd data={[organizationSchema(s, base), websiteSchema(s, base)]} />
        {children}

        {/* Analytics / tag managers load AFTER hydration via next/script.
            strategy="afterInteractive" = defer until page is interactive,
            never block first paint. Clarity is non-critical → lazyOnload.
            Rendered once here (outside route-level layouts) so client-side
            navigation never remounts / re-injects the scripts. The
            component itself skips /admin routes — see components/analytics.tsx. */}
        <Analytics gtmCode={s.seo.gtmCode} analyticsCode={s.seo.analyticsCode} clarityCode={s.seo.clarityCode} />
      </body>
    </html>
  );
}
