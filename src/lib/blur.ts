/**
 * Tiny warm-toned 4×4 LQIP used as `blurDataURL` on next/image instances
 * whose source is a remote URL (we can't compute a real per-image blur
 * without fetching it server-side, which would defeat the optimisation).
 * A single shared placeholder is enough to mask the network gap with a
 * smooth fade-in; the actual image replaces it as soon as it decodes.
 */
export const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4IDgiPjxmaWx0ZXIgaWQ9ImIiPjxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjIiLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZTVkZmM5IiBmaWx0ZXI9InVybCgjYikiLz48L3N2Zz4=";

/** Standard responsive `sizes` for a card thumbnail (1 col mobile → 4 col desktop). */
export const SIZES_CARD =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw";

/** Standard responsive `sizes` for a list-row icon (fixed-ish on all breakpoints). */
export const SIZES_ROW = "56px";

/** Standard responsive `sizes` for a hero / banner image. */
export const SIZES_HERO =
  "(max-width: 768px) 100vw, (max-width: 1280px) 60vw, 50vw";

/** Standard responsive `sizes` for a full-width content image. */
export const SIZES_CONTENT =
  "(max-width: 768px) 100vw, (max-width: 1024px) 80vw, 720px";
