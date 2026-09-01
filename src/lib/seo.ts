import type { Metadata } from "next";
import { siteUrl, absoluteUrl } from "./util";
import type { SiteSettings } from "./settings";

export function buildMetadata(opts: {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string[];
  canonical?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  noIndex?: boolean;
  noFollow?: boolean;
  baseUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}): Metadata {
  const base = (opts.baseUrl || siteUrl()).replace(/\/$/, "");
  const url = absoluteUrl(opts.path, base);
  const image = opts.image
    ? opts.image.startsWith("http")
      ? opts.image
      : absoluteUrl(opts.image, base)
    : absoluteUrl("/images/og-default.png", base);
  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: { canonical: opts.canonical || url },
    robots: opts.noIndex || opts.noFollow ? { index: !opts.noIndex, follow: !opts.noFollow } : undefined,
    openGraph: {
      title: opts.ogTitle || opts.title,
      description: opts.ogDescription || opts.description,
      url,
      type: opts.type || "website",
      images: [{ url: opts.ogImage ? (opts.ogImage.startsWith("http") ? opts.ogImage : absoluteUrl(opts.ogImage, base)) : image, width: 1200, height: 630, alt: opts.ogTitle || opts.title }],
      publishedTime: opts.publishedTime,
      modifiedTime: opts.modifiedTime,
    },
    twitter: {
      card: "summary_large_image",
      title: opts.twitterTitle || opts.ogTitle || opts.title,
      description: opts.twitterDescription || opts.ogDescription || opts.description,
      images: [opts.twitterImage ? (opts.twitterImage.startsWith("http") ? opts.twitterImage : absoluteUrl(opts.twitterImage, base)) : image],
    },
  };
}

/* ---------------------------- JSON-LD builders ---------------------------- */
export function organizationSchema(s: SiteSettings, baseUrl?: string) {
  const sameAs = Object.values(s.social).filter((v) => v && v.startsWith("http"));
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: s.siteName,
    url: baseUrl || siteUrl(),
    logo: absoluteUrl(s.logoUrl, baseUrl || siteUrl()),
    sameAs,
    contactPoint: s.social.email
      ? [{ "@type": "ContactPoint", email: s.social.email, contactType: "customer support" }]
      : undefined,
  };
}

export function websiteSchema(s: SiteSettings, baseUrl?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: s.siteName,
    url: baseUrl || siteUrl(),
    description: s.description,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/search?q={search_term_string}", baseUrl || siteUrl()) },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[], baseUrl?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url.startsWith("http") ? it.url : absoluteUrl(it.url, baseUrl || siteUrl()),
    })),
  };
}

export function gameSchema(g: {
  title: string; slug: string; shortDesc: string; icon: string;
  version: string; size: string; developer: string; rating: number;
  ratingCount: number; updatedAt: Date; categoryName?: string; baseUrl?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: g.title,
    operatingSystem: "Android",
    applicationCategory: g.categoryName || "GameApplication",
    url: absoluteUrl("/game/" + g.slug, g.baseUrl || siteUrl()),
    image: g.icon ? absoluteUrl(g.icon, g.baseUrl || siteUrl()) : undefined,
    description: g.shortDesc || `${g.title} APK free download for Android.`,
    softwareVersion: g.version,
    fileSize: g.size || undefined,
    dateModified: new Date(g.updatedAt).toISOString(),
    author: g.developer ? { "@type": "Organization", name: g.developer } : undefined,
    aggregateRating:
      g.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: g.rating.toFixed(1),
            ratingCount: g.ratingCount,
            bestRating: "5",
            worstRating: "1",
          }
        : undefined,
  };
}

export function articleSchema(p: {
  title: string; slug: string; excerpt: string; image: string;
  publishedAt: Date; updatedAt: Date; authorName: string; baseUrl?: string;
}, s: SiteSettings) {
  return {
    "@context": "https://schema.org",
    "@type": ["Article", "BlogPosting"],
    headline: p.title,
    description: p.excerpt,
    image: p.image ? [absoluteUrl(p.image, p.baseUrl || siteUrl())] : undefined,
    datePublished: new Date(p.publishedAt).toISOString(),
    dateModified: new Date(p.updatedAt).toISOString(),
    mainEntityOfPage: absoluteUrl("/blog/" + p.slug, p.baseUrl || siteUrl()),
    author: { "@type": "Person", name: p.authorName || s.siteName },
    publisher: {
      "@type": "Organization",
      name: s.siteName,
      logo: { "@type": "ImageObject", url: absoluteUrl(s.logoUrl, p.baseUrl || siteUrl()) },
    },
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}


