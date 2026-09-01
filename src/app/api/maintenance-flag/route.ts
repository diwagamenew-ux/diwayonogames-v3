import { getSettings } from "@/lib/settings";

// Tiny edge-cacheable flag used by middleware to decide whether to rewrite
// public requests to the maintenance screen. Cached for 60s so toggling
// maintenance in the admin panel propagates within a minute without any
// per-request DB hit. Middleware excludes /api/* from its matcher, so this
// endpoint never recurses through the middleware fetch.
export const revalidate = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // revalidate handles caching; this just opts out of static prerender

export async function GET() {
  try {
    const s = await getSettings();
    return Response.json(
      { on: Boolean(s.features.maintenanceMode) },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch {
    return Response.json({ on: false }, { status: 200 });
  }
}
