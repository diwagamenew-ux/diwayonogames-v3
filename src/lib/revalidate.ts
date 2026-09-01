import { revalidatePath } from "next/cache";

/**
 * Several public pages use ISR (`export const revalidate = N`) so they can
 * be served from cache most of the time: the homepage (60s), the game
 * detail page and tag pages (300s each). That's fine for normal traffic,
 * but it means a game the admin just created/edited/deleted could still
 * show the old state — or, on the homepage's category tiles, a stale
 * "0 games" count — for up to that window. `/games` and `/category/[slug]`
 * already render per-request (no `revalidate` export) so they're always
 * fresh; this only needs to bust the pages that opt into caching.
 *
 * Called after every admin game/category create, update and delete so the
 * public site reflects changes immediately instead of on the next
 * background revalidation or a manual server restart. Never throws —
 * a failed revalidation must not fail the mutation it followed.
 */
export function revalidateGamePaths(opts: { slug?: string; prevSlug?: string; categorySlug?: string; prevCategorySlug?: string } = {}) {
  try {
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
    revalidatePath("/rss.xml");
    if (opts.slug) revalidatePath(`/game/${opts.slug}`);
    if (opts.prevSlug && opts.prevSlug !== opts.slug) revalidatePath(`/game/${opts.prevSlug}`);
    if (opts.categorySlug) revalidatePath(`/category/${opts.categorySlug}`);
    if (opts.prevCategorySlug && opts.prevCategorySlug !== opts.categorySlug) {
      revalidatePath(`/category/${opts.prevCategorySlug}`);
    }
  } catch (err) {
    console.error("[revalidate] game paths failed:", err);
  }
}

export function revalidateCategoryPaths(opts: { slug?: string; prevSlug?: string } = {}) {
  try {
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
    if (opts.slug) revalidatePath(`/category/${opts.slug}`);
    if (opts.prevSlug && opts.prevSlug !== opts.slug) revalidatePath(`/category/${opts.prevSlug}`);
  } catch (err) {
    console.error("[revalidate] category paths failed:", err);
  }
}
