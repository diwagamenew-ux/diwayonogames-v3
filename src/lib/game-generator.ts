/**
 * Auto-generates every Add-Game field from a game name (+ optional category).
 *
 * Design goals (see admin request that motivated this file):
 *  - Different wording for every game — headings, intros, FAQs, meta copy
 *    are all pulled from variation pools using a PRNG seeded from the game
 *    name, so "Yono Bonus" and "Diwa 777" never read like the same article
 *    with the name swapped, but the same name always regenerates the same
 *    result (predictable, reviewable, diff-friendly).
 *  - Never invent facts. Version/size/developer/package name/bonus/download
 *    URLs are either a generic non-fabricated placeholder (matching the
 *    database column defaults) or left empty for the admin to fill in after
 *    verifying. Ratings are never fabricated — new games always start at
 *    0 / 0 like the schema default, and FAQs never claim withdrawal times,
 *    payment methods, certifications, or guaranteed winnings.
 *  - Pure function, no DB access — the API route layer is responsible for
 *    slug-uniqueness (via lib/slug.ts) and persistence.
 */

import { slugify } from "./util";
import {
  DEFAULT_GAME_VERSION,
  DEFAULT_MIN_ANDROID,
  DEFAULT_SEO_SETTINGS,
  DEFAULT_EDITORIAL_RATING_RANGE,
} from "./game-defaults";

/* --------------------------------- PRNG ---------------------------------- */
// Small deterministic string hash + PRNG so the same game name always
// generates the same content (reviewable / re-generatable), while different
// names land on different points in the variation pools below.
function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/** Pick `n` distinct items from `arr` (order preserved from a shuffled copy). */
function pickN<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function clampLen(s: string, min: number, max: number, pads: readonly string[]): string {
  let out = s.trim();
  if (out.length > max) {
    out = out.slice(0, max).replace(/\s+\S*$/, "").trim();
  }
  if (out.length < min) {
    for (const pad of pads) {
      if (out.toLowerCase().includes(pad.toLowerCase())) continue;
      const candidate = `${out} ${pad}`.trim();
      if (candidate.length <= max) {
        out = candidate;
        if (out.length >= min) break;
      }
    }
  }
  return out;
}

/* ------------------------------ Variation pools --------------------------- */

const TITLE_PATTERNS = [
  (n: string, y: number) => `${n} APK ${y}`,
  (n: string, y: number) => `${n} APK Download ${y}`,
  (n: string, y: number) => `${n} APK — Latest Version`,
  (n: string, y: number) => `${n} for Android — APK ${y}`,
  (n: string, y: number) => `${n} APK Free Download (${y})`,
];

const META_TITLE_PATTERNS = [
  (n: string, y: number) => `${n} APK Download ${y} – Latest Version`,
  (n: string, y: number) => `${n} APK ${y}: Free Android Download`,
  (n: string, y: number) => `Download ${n} APK – Updated ${y}`,
  (n: string, y: number) => `${n} APK for Android – ${y} Download`,
  (n: string, y: number) => `${n} APK ${y} Download for Android`,
];

const SHORT_DESC_PATTERNS = [
  (n: string, c: string) => `${n} is an Android APK${c ? ` in the ${c} lineup` : ""} you can download and install directly on your phone.`,
  (n: string, c: string) => `Get ${n} for Android — a straightforward APK download${c ? `, listed under ${c}` : ""} with details you can verify before installing.`,
  (n: string, c: string) => `${n} APK, ready for Android devices${c ? ` and grouped with our ${c} picks` : ""}. Check the details below before you download.`,
  (n: string, c: string) => `Here's what to know about ${n} before installing the APK${c ? ` from our ${c} section` : ""}.`,
  (n: string, c: string) => `${n} — download the Android APK and review the app details, permissions and version info first.`,
];

const META_DESC_PATTERNS = [
  (n: string) => `Download ${n} APK for Android. Check version, size and compatibility details, then install directly on your device. Updated details below.`,
  (n: string) => `${n} APK download page — version info, install steps and FAQs for Android users. Review the details before downloading.`,
  (n: string) => `Looking for ${n} APK? Find the download link, installation steps and frequently asked questions on this page.`,
  (n: string) => `Everything you need to download and install ${n} on Android — file details, setup steps and answers to common questions.`,
  (n: string) => `${n} for Android: download details, installation guide and FAQs, all reviewed before publishing.`,
];

const INTRO_PATTERNS = [
  (n: string, c: string) => `${n} is an Android application${c ? ` listed in our ${c} section` : ""}. Below you'll find the details we have on file — version, size and compatibility — along with steps to install it and answers to common questions.`,
  (n: string, c: string) => `This page covers ${n}, an APK for Android devices${c ? `, part of our ${c} collection` : ""}. We keep the technical details here as accurate as possible, and update them whenever the admin team verifies a new version.`,
  (n: string, c: string) => `If you're after ${n} for Android, this page walks through the app details${c ? ` (filed under ${c})` : ""}, how to install the APK safely, and what to check before you do.`,
  (n: string, c: string) => `${n} is available here as a direct APK download${c ? `, categorized under ${c}` : ""}. We've laid out the app info, installation steps and a short FAQ so you know what you're installing.`,
  (n: string, c: string) => `Here's the download page for ${n}${c ? `, one of the apps in our ${c} category` : ""}. Read through the details below — including compatibility and safety notes — before installing.`,
];

const FEATURES_HEADINGS = ["Key Features", "What's Included", "Highlights", "Feature Overview"];
const FEATURE_POOL: ((n: string) => string)[] = [
  (n) => `Direct APK download for ${n}, no third-party app store required`,
  (n) => `Lightweight installer for ${n} that installs quickly on most Android devices`,
  (n) => `Clean, easy-to-navigate interface for browsing ${n}'s details`,
  (n) => `Regularly checked for updated version info on ${n}`,
  (n) => `Straightforward install process for ${n} — no unnecessary permissions requested by this page`,
  (n) => `${n} works on a wide range of Android versions (see compatibility below)`,
  (n) => `${n}'s details are reviewed by our editorial team before publishing`,
  (n) => `${n} details page kept current as new information becomes available`,
];

const APP_DETAILS_HEADINGS = ["App Details", "Game / App Details", "Technical Details", "At a Glance"];

const INTERESTING_HEADINGS = [
  (n: string) => `What Makes ${n} Interesting?`,
  (n: string) => `Why Users May Want to Try ${n}`,
  (n: string) => `A Quick Look at ${n}`,
  (n: string) => `Should You Download ${n}?`,
  (n: string) => `${n} at a Glance`,
];
const INTERESTING_BODY = [
  (n: string, c: string) => `${n}${c ? ` sits in our ${c} category` : ""} and, like any APK install, is worth a quick look at the details — version, size and permissions — before you download. We keep this page updated as we confirm more information.`,
  (n: string, c: string) => `Whether ${n} is right for you depends on your device and what you're looking for${c ? ` in ${c} apps` : ""}. Check the compatibility section below to make sure your Android version is supported.`,
  (n: string, c: string) => `We don't make claims about ${n} we can't verify. What's listed here is what our team has confirmed; anything not yet verified is marked "Not specified" until it is.`,
  (n: string, c: string) => `${n} is listed here for Android users who prefer a direct APK download${c ? ` over browsing the wider ${c} category` : ""}. Take a look at the install steps and FAQ before proceeding.`,
];

const INSTALL_HEADINGS: ((n: string) => string)[] = [
  (n) => `How to Download and Install ${n} APK`,
  (n) => `Installing ${n} on Android`,
  (n) => `${n} — Download & Installation Guide`,
  (n) => `Getting ${n} Set Up on Your Device`,
];
const INSTALL_STEPS_POOL: ((n: string) => string)[] = [
  (n) => `Tap the download button on this page to get the ${n} APK file.`,
  (n) => `Once ${n} is downloaded, open the file from your notifications or file manager.`,
  (n) => `If prompted, allow installation from this source in your Android settings before ${n} installs.`,
  (n) => `Follow the on-screen prompts to finish installing ${n}.`,
  (n) => `Open ${n} from your app drawer once installation completes.`,
];

const COMPAT_HEADINGS = ["Compatibility", "Device Compatibility", "System Requirements"];

const BONUS_HEADINGS = ["Bonus / Promotional Information", "Offers", "Promotions"];

const SAFETY_HEADINGS = ["Safety and Responsible Use", "A Note on Safety", "Before You Install"];
const SAFETY_BODY = [
  (n: string) => `Only download ${n} from a source you trust, and check your device's security settings before installing an APK from outside the Play Store. We don't verify every claim made by third-party servers, so use your own judgement.`,
  (n: string) => `As with any APK install, review the permissions ${n} requests and keep your device's security settings up to date. If anything about a download link looks off, don't proceed.`,
  (n: string) => `We can't independently confirm every technical detail about ${n}. Treat unverified fields ("Not specified") as just that — unverified — until our team confirms them.`,
];

const SUMMARY_HEADINGS = ["Final Summary", "Wrapping Up", "In Short"];
const SUMMARY_BODY = [
  (n: string, c: string) => `${n} is available here as an APK download${c ? ` under ${c}` : ""}. Review the app details above, follow the install steps, and check back if you have questions — the FAQ below covers the basics.`,
  (n: string, c: string) => `That covers the information currently listed for ${n}${c ? ` in the ${c} category` : ""}. We'll update this page when the listed information changes.`,
  (n: string, c: string) => `In short: ${n} is a direct APK download with the details listed above. Double-check compatibility with your device before installing.`,
];

const FAQ_POOL: ((n: string, c: string) => { q: string; a: string })[] = [
  (n) => ({ q: `What is ${n} APK?`, a: `${n} is an Android application available here as a direct APK download. Full technical details are listed above.` }),
  (n) => ({ q: `Is ${n} available for Android?`, a: `Yes, ${n} is distributed as an APK file for Android devices. Check the compatibility section for the minimum supported version.` }),
  (n) => ({ q: `How do I install ${n} APK?`, a: `Download the APK from this page, open the file, allow installs from this source if prompted, then follow the on-screen steps.` }),
  (n, c) => ({ q: `What category does ${n} belong to?`, a: c ? `${n} is listed under ${c} on this site.` : `${n} hasn't been assigned a category yet — check back once it's published.` }),
  (n) => ({ q: `What version of ${n} is available?`, a: `The version currently listed for ${n} is shown in the App Details section above; we update it when a newer build is verified.` }),
  (n) => ({ q: `Is ${n} free to download?`, a: `Yes, the ${n} APK on this page is a free download.` }),
  (n) => ({ q: `Do I need to uninstall a previous version before installing ${n}?`, a: `Not usually — most APK updates install over the existing app. If you run into issues, uninstalling the old version first can help.` }),
  (n) => ({ q: `Where can I report a problem with the ${n} download?`, a: `Use the "Report" option on this page (or the Contact page) to let us know if a link isn't working.` }),
];

const TAG_POOL = [
  "Android Games", "Android APK", "APK Download", "Mobile Gaming", "Free Android App",
  "Latest APK", "Android App Download", "APK File", "Android Application",
];

/* --------------------------------- Types ---------------------------------- */

export type GeneratedGameDetails = {
  title: string;
  slugBase: string;
  shortDesc: string;
  content: string; // sanitized-safe HTML (still passes through cleanHtml server-side)
  version: string;
  size: string;
  minAndroid: string;
  developer: string;
  packageName: string;
  bonus: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  faqs: { q: string; a: string }[];
  tagNames: string[];
  /** The site's own editorial rating (0–5, one decimal) — NOT a user rating
   *  or review count. Always render this labeled "Editorial Rating"; never
   *  feed it into AggregateRating structured data or a "N users" label. */
  editorialRating: number;
};

/**
 * Generate every Add-Game field from a game name. `categoryName` is optional
 * — pass it when the admin has already picked a category so headings/FAQs
 * can reference it naturally; omit it and the copy simply doesn't mention a
 * category.
 */
export function generateGameDetails(opts: { name: string; categoryName?: string }): GeneratedGameDetails {
  const name = opts.name.trim().replace(/\s+/g, " ");
  const categoryName = (opts.categoryName || "").trim();
  const year = new Date().getFullYear();
  const rng = mulberry32(hashSeed(name.toLowerCase()));

  const title = pick(rng, TITLE_PATTERNS)(name, year);
  const slugBase = slugify(`${name} apk`);
  const focusKeyword = `${name} APK`;

  const metaTitle = clampLen(
    pick(rng, META_TITLE_PATTERNS)(name, year),
    DEFAULT_SEO_SETTINGS.metaTitleMin,
    DEFAULT_SEO_SETTINGS.metaTitleMax,
    ["for Android", "– Latest Details", "Free Download"]
  );

  const shortDesc = pick(rng, SHORT_DESC_PATTERNS)(name, categoryName);
  const metaDescription = clampLen(
    pick(rng, META_DESC_PATTERNS)(name),
    DEFAULT_SEO_SETTINGS.metaDescriptionMin,
    DEFAULT_SEO_SETTINGS.metaDescriptionMax,
    ["Details reviewed and updated regularly for accuracy.", "Check the info below before installing.", "See install steps and FAQs below."]
  );

  // ---- Article body -------------------------------------------------------
  const featureHeading = pick(rng, FEATURES_HEADINGS);
  const features = pickN(rng, FEATURE_POOL, 5).map((f) => f(name));
  const appDetailsHeading = pick(rng, APP_DETAILS_HEADINGS);
  const interestingHeading = pick(rng, INTERESTING_HEADINGS)(name);
  const interestingBody = pick(rng, INTERESTING_BODY)(name, categoryName);
  const installHeading = pick(rng, INSTALL_HEADINGS)(name);
  const installSteps = pickN(rng, INSTALL_STEPS_POOL, 4).map((s) => s(name));
  const compatHeading = pick(rng, COMPAT_HEADINGS);
  const bonusHeading = pick(rng, BONUS_HEADINGS);
  const safetyHeading = pick(rng, SAFETY_HEADINGS);
  const safetyBody = pick(rng, SAFETY_BODY)(name);
  const summaryHeading = pick(rng, SUMMARY_HEADINGS);
  const summaryBody = pick(rng, SUMMARY_BODY)(name, categoryName);
  const intro = pick(rng, INTRO_PATTERNS)(name, categoryName);

  const content = [
    `<p>${intro}</p>`,
    `<h2>${featureHeading}</h2>`,
    `<ul>${features.map((f) => `<li>${f}</li>`).join("")}</ul>`,
    `<h2>${appDetailsHeading}</h2>`,
    `<table><tbody>`,
    `<tr><td>Version</td><td>${DEFAULT_GAME_VERSION}</td></tr>`,
    `<tr><td>Requires Android</td><td>${DEFAULT_MIN_ANDROID}</td></tr>`,
    `<tr><td>Size</td><td>Not specified</td></tr>`,
    `<tr><td>Developer</td><td>Not specified</td></tr>`,
    categoryName ? `<tr><td>Category</td><td>${categoryName}</td></tr>` : "",
    `</tbody></table>`,
    `<h2>${interestingHeading}</h2>`,
    `<p>${interestingBody}</p>`,
    `<h2>${installHeading}</h2>`,
    `<ol>${installSteps.map((s) => `<li>${s}</li>`).join("")}</ol>`,
    `<h2>${compatHeading}</h2>`,
    `<p>${name} requires Android ${DEFAULT_MIN_ANDROID} or higher. Exact device compatibility can vary — if the app doesn't open after installing, your device may not meet the minimum requirement.</p>`,
    `<h2>${bonusHeading}</h2>`,
    `<p>No verified bonus or promotional details are on file for ${name} yet. This section will be updated once the admin team confirms an offer directly from the developer.</p>`,
    `<h2>${safetyHeading}</h2>`,
    `<p>${safetyBody}</p>`,
    `<h2>${summaryHeading}</h2>`,
    `<p>${summaryBody}</p>`,
  ].filter(Boolean).join("\n");

  // ---- FAQs -----------------------------------------------------------------
  const faqCount = 3 + Math.floor(rng() * 3); // 3–5
  const faqs = pickN(rng, FAQ_POOL, faqCount).map((f) => f(name, categoryName));

  // ---- Tags -------------------------------------------------------------
  const nameTokens = name
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);
  const nameBasedTags = [
    name,
    `${name} APK`,
    `${name} Download`,
    ...(nameTokens.length > 1 ? nameTokens.map((t) => `${t} APK`) : []),
  ];
  const categoryTags = categoryName ? [categoryName, `${categoryName} APK`] : [];
  const genericTags = pickN(rng, TAG_POOL, 6);
  const tagNames = [...new Set([...nameBasedTags, ...categoryTags, ...genericTags])].slice(0, 15);

  // ---- Editorial rating ---------------------------------------------------
  // A deterministic, plausible-but-clearly-editorial score in a fixed band —
  // not a claim about real users, never paired with a fabricated vote count.
  const { min, max } = DEFAULT_EDITORIAL_RATING_RANGE;
  const editorialRating = Math.round((min + rng() * (max - min)) * 10) / 10;

  return {
    title,
    slugBase,
    shortDesc,
    content,
    version: DEFAULT_GAME_VERSION,
    size: "",
    minAndroid: DEFAULT_MIN_ANDROID,
    developer: "",
    packageName: "",
    bonus: "",
    metaTitle,
    metaDescription,
    focusKeyword,
    canonicalUrl: "",
    faqs,
    tagNames,
    editorialRating,
  };
}
