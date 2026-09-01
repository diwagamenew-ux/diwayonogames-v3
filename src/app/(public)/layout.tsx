import dynamic from "next/dynamic";
import { getSettings } from "@/lib/settings";
import { listCategories } from "@/lib/data";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// Heavy client-only widgets are code-split so they don't bloat the initial
// JS bundle of every public page. next/dynamic moves each into its own
// async chunk loaded in parallel with the main bundle.
const FloatingButtons = dynamic(
  () => import("@/components/floating-buttons").then((m) => ({ default: m.FloatingButtons }))
);
const CookieConsent = dynamic(
  () => import("@/components/cookie-consent").then((m) => ({ default: m.CookieConsent }))
);
const PopupAd = dynamic(
  () => import("@/components/popup-ad").then((m) => ({ default: m.PopupAd }))
);
const PwaRegister = dynamic(
  () => import("@/components/pwa-register").then((m) => ({ default: m.PwaRegister }))
);

/**
 * Public-pages layout. Intentionally uses NO request-bound APIs (no
 * headers(), no cookies()) so every page in this group can participate in
 * ISR / SSG. The maintenance gate lives in middleware (edge, cached); the
 * admin-detection lives in a client-side inline script in the root layout.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const cats = await listCategories().catch(() => []);
  const catLinks = cats.map((c) => ({ name: c.name, slug: c.slug }));

  return (
    <>
      <div data-public-chrome>
        <SiteHeader settings={s} categories={catLinks} />
      </div>
      <div className="flex-1">{children}</div>
      <div data-public-chrome>
        <SiteFooter settings={s} categories={catLinks} />
        <FloatingButtons settings={s} />
        {s.features.cookieConsent && <CookieConsent />}
        {s.ads.popup.enabled && s.ads.popup.code && <PopupAd code={s.ads.popup.code} />}
        <PwaRegister />
      </div>
    </>
  );
}
