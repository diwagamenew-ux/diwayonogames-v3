import Link from "next/link";
import { SafeImage } from "./safe-image";
import type { SiteSettings } from "@/lib/settings";
import { SocialIcons } from "./social-links";
import { NewsletterForm } from "./newsletter-form";
import { listPosts } from "@/lib/data";

export async function SiteFooter({ settings, categories }: {
  settings: SiteSettings;
  categories: { name: string; slug: string }[];
}) {
  const recent = await listPosts({ limit: 4 }).catch(() => []);
  const pages = [
    { slug: "privacy-policy", label: "Privacy Policy" },
    { slug: "terms-and-conditions", label: "Terms & Conditions" },
    { slug: "dmca", label: "DMCA" },
    { slug: "disclaimer", label: "Disclaimer" },
  ];

  return (
    <footer className="mt-16 border-t border-line bg-panel noise-bg">
      <div className="max-w-7xl mx-auto px-4 py-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <SafeImage
              src={settings.logoUrl}
              alt={`${settings.siteName} logo`}
              width={44}
              height={44}
              sizes="44px"
              loading="lazy"
              className="w-11 h-11 rounded-xl object-cover gold-frame"
            />
            <span className="font-display text-2xl gold-text leading-none pt-1">{settings.siteName.toUpperCase()}</span>
          </Link>
          <p className="text-sm text-mute mt-4 leading-relaxed">{settings.footerText}</p>
          <SocialIcons social={settings.social} className="mt-5" />
        </div>

        <nav aria-label="Footer categories">
          <h3 className="section-title text-lg mb-5">Categories</h3>
          <ul className="grid gap-2.5 text-sm text-mute">
            <li><Link href="/games" className="hover:text-accent transition-colors">All Games</Link></li>
            {categories.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="hover:text-accent transition-colors">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Recent posts">
          <h3 className="section-title text-lg mb-5">Recent Posts</h3>
          <ul className="grid gap-2.5 text-sm text-mute">
            {recent.length === 0 && <li>No posts yet.</li>}
            {recent.map((p) => (
              <li key={p.id}>
                <Link href={`/blog/${p.slug}`} className="hover:text-accent transition-colors line-clamp-1">
                  {p.title}
                </Link>
              </li>
            ))}
            <li><Link href="/blog" className="text-accent hover:underline">View all →</Link></li>
          </ul>
        </nav>

        <div>
          <h3 className="section-title text-lg mb-5">Stay Updated</h3>
          <p className="text-sm text-mute mb-4">Get the newest APK releases and bonuses in your inbox.</p>
          <NewsletterForm />
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2 mt-6 text-xs text-mute">
            {(settings.nav.footerLinks.length
              ? settings.nav.footerLinks
              : pages.map((p) => ({ label: p.label, url: `/page/${p.slug}` }))
            ).map((l, i) => (
              <Link key={l.url + i} href={l.url} className="hover:text-accent transition-colors">
                {l.label}
              </Link>
            ))}
            <a href="/rss.xml" className="hover:text-accent transition-colors">RSS Feed</a>
            <a href="/sitemap.xml" className="hover:text-accent transition-colors">Sitemap</a>
          </nav>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-mute">
          <p>{settings.copyright}</p>
          <p className="text-center">
            18+ only · Play responsibly · We do not host or own any listed trademarks
          </p>
          <Link href="/admin" className="hover:text-accent transition-colors uppercase tracking-widest font-semibold">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
