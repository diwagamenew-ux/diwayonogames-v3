import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware. Two jobs, both cheap:
 *   1. Tag every request with its pathname so /not-found can log the
 *      missing URL (the only remaining reader of x-pathname).
 *   2. When the maintenance flag is on, rewrite public HTML requests to
 *      /maintenance. The flag is read from /api/maintenance-flag which is
 *      itself cached for 60s, so this adds at most one cached fetch per
 *      edge region per minute — not a per-request DB hit.
 *
 * Critically, middleware runs at the edge BEFORE the React render and
 * does NOT opt any page into dynamic rendering, so public pages remain
 * fully ISR/SSG-cacheable.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  // Maintenance gate — skip admin, the maintenance page itself, API, and
  // any non-HTML asset. The fetch is edge-cached via `next.revalidate`.
  const isHtmlPage =
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/images") &&
    !pathname.startsWith("/uploads") &&
    pathname !== "/maintenance" &&
    pathname !== "/favicon.ico" &&
    pathname !== "/manifest.webmanifest" &&
    pathname !== "/robots.txt" &&
    pathname !== "/sitemap.xml" &&
    pathname !== "/rss.xml" &&
    !pathname.includes("."); // skip anything with a file extension

  if (isHtmlPage) {
    try {
      const flagUrl = new URL("/api/maintenance-flag", req.url);
      const res = await fetch(flagUrl, { next: { revalidate: 60 } });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { on?: boolean } | null;
        if (data?.on) {
          return NextResponse.rewrite(new URL("/maintenance", req.url), {
            request: { headers: requestHeaders },
          });
        }
      }
    } catch {
      // If the flag endpoint is unreachable, fail open (show the site).
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Tight matcher: skip everything that can't possibly need the maintenance
  // gate or the x-pathname tag. Fewer edge invocations = lower latency.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|rss.xml|images/|uploads/|api/).*)",
  ],
};
