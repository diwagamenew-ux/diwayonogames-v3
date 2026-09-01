/**
 * Centralized defaults for the Add-Game auto-generation system.
 *
 * Nothing game-specific lives here — this is the shared configuration that
 * `generateGameDetails()` (see ./game-generator.ts) reads from. Change these
 * to retune the generator site-wide without touching generation logic.
 */

/** Category to fall back to when the admin generates details before picking one. */
export const DEFAULT_GAME_CATEGORY = "";

/** New games never ship with a fabricated *user* rating — the site's real
 *  review system (0 rating / 0 ratingCount until real reviews come in) is
 *  the only legitimate source of a user rating, and this mirrors the
 *  `games` table default for those two columns. */
export const DEFAULT_EDITORIAL_RATING = 0;

/** Range the generator picks an *editorial* rating from — the site team's
 *  own assessment, stored separately (`games.editorialRating`) from the
 *  user-review-derived `rating`/`ratingCount` columns and always labeled
 *  "Editorial Rating" in the UI, never presented as a user rating or count. */
export const DEFAULT_EDITORIAL_RATING_RANGE = { min: 3.7, max: 4.6 };

/** Generic, non-fabricated starting values — same convention already used
 *  by the database schema's own column defaults. These are placeholders the
 *  admin is expected to confirm/replace, never a claim about a real app. */
export const DEFAULT_GAME_VERSION = "1.0";
export const DEFAULT_MIN_ANDROID = "5.0+";

/** Section order for the generated article body. Heading wording for each
 *  section is varied per game by the generator — this list only fixes the
 *  structure, not the copy. */
export const DEFAULT_ARTICLE_STRUCTURE = [
  "introduction",
  "features",
  "appDetails",
  "whatMakesInteresting",
  "howToInstall",
  "compatibility",
  "bonus",
  "safety",
  "finalSummary",
] as const;

export const DEFAULT_SEO_SETTINGS = {
  metaTitleMin: 50,
  metaTitleMax: 65,
  metaDescriptionMin: 120,
  metaDescriptionMax: 160,
};

export const DEFAULT_FAQ_COUNT = { min: 3, max: 5 };
export const DEFAULT_TAG_COUNT = { min: 8, max: 15 };
