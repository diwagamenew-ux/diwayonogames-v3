"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { extractGa4Id, gtagInitScript } from "@/lib/analytics";

/**
 * Mounted once in the root layout. Being a client component means the
 * admin-path check below runs against `usePathname()` in the browser after
 * hydration — it does NOT require headers()/cookies() in the (server,
 * static-friendly) root layout, so public pages keep participating in
 * ISR/SSG exactly as before.
 *
 * Because this lives in the root layout (outside `{children}`), the App
 * Router does not unmount/remount it on client-side navigation between
 * pages — so gtag.js / GTM / Clarity are each injected exactly once per
 * session, never re-injected on route changes. GA4's default "Enhanced
 * measurement" setting already listens for History API navigation
 * (pushState/popState, which next/link uses) and fires page_view on its
 * own, so we deliberately do NOT add a second, manual route-change
 * page_view call here — that would double-count every navigation.
 */
export function Analytics({
  gtmCode,
  analyticsCode,
  clarityCode,
}: {
  gtmCode: string;
  analyticsCode: string;
  clarityCode: string;
}) {
  const pathname = usePathname();

  // No tracking on /admin/** — admin traffic isn't real visitor traffic
  // and would pollute GA4 reports / Clarity recordings with internal use.
  if (pathname?.startsWith("/admin")) return null;

  const gaId = extractGa4Id(analyticsCode);

  return (
    <>
      {gtmCode ? (
        <Script id="gtm" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: gtmCode }} />
      ) : null}

      {gaId ? (
        // Correct two-tag GA4 pattern: a real src-loaded <Script>, then a
        // separate inline <Script> that only calls gtag(). See
        // lib/analytics.ts for why concatenating both into one
        // dangerouslySetInnerHTML tag silently breaks GA4.
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {gtagInitScript(gaId)}
          </Script>
        </>
      ) : analyticsCode ? (
        // Fallback for a saved value that isn't a recognizable GA4 snippet
        // (e.g. some other analytics vendor's tag) — preserves the old
        // "paste anything" behavior rather than silently dropping it.
        <Script id="ga-custom" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: analyticsCode }} />
      ) : null}

      {clarityCode ? (
        <Script id="clarity" strategy="lazyOnload" dangerouslySetInnerHTML={{ __html: clarityCode }} />
      ) : null}
    </>
  );
}
