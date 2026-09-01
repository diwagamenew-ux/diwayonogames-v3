/**
 * Database bootstrap + demo seed (canonical source).
 * - `bootstrapDatabase()` runs SQL migrations from ./drizzle and seeds demo
 *   content if the database is empty. Called automatically by instrumentation.ts
 *   on every server start, so a fresh/empty database can never break the app.
 * - `reseedDatabase()` wipes all tables and re-seeds (used by scripts/seed.mjs).
 */
import path from "node:path";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";
import {
  users,
  categories,
  tags,
  games,
  downloadLinks,
  gameTags,
  posts,
  reviews,
  pages,
  newsletterSubs,
} from "./schema";

const YEAR = new Date().getFullYear();

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

/* ------------------------------- HTML builders ------------------------------ */

type GameDef = {
  title: string; slug: string; icon: string; cat: string; version: string; size: string;
  developer: string; packageName: string; bonus: string; featured: boolean;
  rating: number; votes: number; downloads: number; views: number; shortDesc: string; kw: string;
};

function gameContent(g: GameDef) {
  return `
<p><strong>${g.title}</strong> is one of the most popular ${g.cat} apps available for Android right now.
Review the available details for <strong>${g.title}</strong>, including its listed features, compatibility information and any current offers.
Welcome bonus information is shown only when provided in the listing.</p>

<h2>${g.title} APK — Key Features</h2>
<ul>
<li>Offer information is shown when provided in the listing</li>
<li>Payment and withdrawal options depend on the app and provider.</li>
<li>Review the app's terms, permissions and responsible-use information before playing.</li>
<li>Listed file size: ${g.size}; check the Android requirement before installing</li>
<li>Support options depend on the app or developer</li>
<li>Features and promotions depend on the current app version</li>
</ul>

<h2>Why Choose ${g.title}?</h2>
<p>There are hundreds of ${g.cat.toLowerCase()} apps in the market, but ${g.title} stands out because of its
simple design that even first-time players understand in seconds. The wallet system is transparent,
the minimum withdrawal is just ₹100, and payments usually arrive within minutes. Whether you are a
casual player or grinding daily tournaments, ${g.title} gives you a premium experience.</p>

<h2>Deposit & Withdrawal Process</h2>
<table>
<thead><tr><th>Method</th><th>Minimum</th><th>Processing Time</th></tr></thead>
<tbody>
<tr><td>UPI / Paytm / PhonePe</td><td>₹100</td><td>Instant</td></tr>
<tr><td>Bank Transfer (IMPS)</td><td>₹100</td><td>5–30 minutes</td></tr>
<tr><td>USDT (Crypto)</td><td>₹500</td><td>10–60 minutes</td></tr>
</tbody>
</table>

<h2>Safety & Responsible Gaming</h2>
<p>This app involves an element of financial risk and may be addictive. Please play responsibly and at
your own risk. Only users 18 years or older should use this application. Set a budget before you play
and never chase losses. If you feel your gaming is becoming a problem, take a break immediately.</p>

<h2>Final Verdict</h2>
<p>If you are considering <strong>${g.title}</strong>, review the available app details, terms, compatibility information and current offers before installing or using it.</p>`.trim();
}

function faqs(g: GameDef) {
  return [
    { q: `What should I check before downloading ${g.title}?`, a: `Review the version, package details, permissions, compatibility information and download source before installing. If any detail is not specified, check the developer or publisher information directly.` },
    { q: `How do I claim the ${g.bonus}?`, a: `Install the app, register with your mobile number and verify the OTP. The welcome bonus is credited automatically to your game wallet.` },
    { q: `Where can I find withdrawal information for ${g.title}?`, a: `Withdrawal limits and processing times can change. Check the app's current terms and payment information before making a transaction.` },
    { q: `Does ${g.title} work on Android 5.0+?`, a: `Yes, the app supports all Android devices running 5.0 or higher, and the file size is only about ${g.size}.` },
  ];
}

function postContent(title: string, keyword: string) {
  return `
<p><strong>${title}</strong> is a sample editorial article included with the YonoDiwaGames demo dataset. It is written around the topic <strong>${keyword}</strong> so you can replace it with your own researched content before publishing.</p>
<h2>What This Guide Covers</h2>
<p>This article explains the basics in plain language, highlights the details readers should verify, and gives a simple checklist for comparing Android game and app information. Always confirm version numbers, file sources, permissions, device compatibility and the developer's current terms before installing or using an app.</p>
<h2>Quick Checklist</h2>
<ul>
<li>Check the app or game name and developer.</li>
<li>Compare the listed version and file size with the current release.</li>
<li>Review Android compatibility and requested permissions.</li>
<li>Use a trusted source and scan downloaded files before installation.</li>
<li>Read the app's own rules, privacy information and responsible-use guidance.</li>
</ul>
<h2>Why It Matters</h2>
<p>Good game information should help a reader make an informed decision rather than promise a particular result. If details change, update the article and its metadata so the page stays useful and accurate.</p>
<h2>Conclusion</h2>
<p>Use this demo article as a starting point for your editorial workflow. Add original research, screenshots you have permission to use, current facts and relevant internal links before publishing a final version.</p>`.trim();
}

const PAGES: { title: string; slug: string; content: string }[] = [
  {
    title: "Privacy Policy", slug: "privacy-policy",
    content: `<p>Your privacy is important to us. This policy explains what information we collect and how we use it.</p>
<h2>Information We Collect</h2><p>We collect only the information you provide voluntarily (name, email) when contacting us, subscribing to our newsletter or submitting reviews. We also collect anonymous usage statistics via analytics tools.</p>
<h2>Cookies</h2><p>We use cookies to remember your preferences, analyze traffic and serve relevant content. You can disable cookies in your browser settings at any time.</p>
<h2>Third-Party Services</h2><p>We may display third-party advertisements (e.g. Google AdSense). These services may use cookies to serve personalized ads based on your browsing history. We do not control their data collection.</p>
<h2>Data Protection</h2><p>We never sell, rent or share your personal information with third parties. Contact form submissions are stored securely and used only to respond to your inquiry.</p>
<h2>Contact</h2><p>For any privacy-related questions, please reach us through the Contact page.</p>`,
  },
  {
    title: "Terms & Conditions", slug: "terms-and-conditions",
    content: `<p>By using this website, you agree to the following terms and conditions.</p>
<h2>Content Purpose</h2><p>All content on this website is for informational and promotional purposes only. We are not affiliated with, endorsed by, or operated by any of the gaming companies, developers or brands mentioned.</p>
<h2>Age Restriction</h2><p>You must be 18 years or older to use this website. Online gaming involves financial risk — please play responsibly and check your local laws before participating.</p>
<h2>Trademarks</h2><p>All trademarks, logos and brand names are the property of their respective owners and are mentioned on this site for informational purposes only.</p>
<h2>Accuracy</h2><p>We work hard to keep download links, versions and bonus information accurate, but offers may change without notice. Always verify details on the official app before depositing money.</p>
<h2>Limitation of Liability</h2><p>We are not responsible for any financial loss, damages or issues arising from the use of third-party applications listed on this website.</p>`,
  },
  {
    title: "DMCA", slug: "dmca",
    content: `<p>We respect the intellectual property rights of others and comply with the Digital Millennium Copyright Act (DMCA).</p>
<h2>Copyright Infringement Notice</h2><p>If you believe that any content on this website infringes your copyright, please send us a notice including:</p>
<ul><li>Your full name and contact information</li><li>The exact URL(s) of the content in question</li><li>Proof of ownership of the copyrighted material</li><li>A statement that the information provided is accurate</li></ul>
<h2>Action</h2><p>Valid DMCA requests are processed within 48 hours. The reported content will be removed or access disabled upon verification.</p>
<h2>Submit a Request</h2><p>Please use the Contact page and select "DMCA" as the subject, or email us directly.</p>`,
  },
  {
    title: "Disclaimer", slug: "disclaimer",
    content: `<p>This website is an independent informational platform that shares gaming apps and online gaming information.</p>
<h2>No Affiliation</h2><p>We are NOT affiliated with, endorsed by, sponsored by, or operated by any official gaming company, developer or brand group mentioned on this site.</p>
<h2>Trademark Notice</h2><p>All trademarks, logos and brand names are the property of their respective owners and are mentioned strictly for informational purposes.</p>
<h2>Financial Risk Warning</h2><p>Online gaming involves an element of financial risk and can be addictive. Users must be 18+ and are advised to play responsibly. Please understand the risks involved and never play with money you cannot afford to lose.</p>
<h2>External Links</h2><p>This website contains links to third-party applications and websites. We do not control and are not responsible for their content, availability or practices.</p>`,
  },
];

const GAMES: GameDef[] = [
  {
    title: "Diwa Win — Rummy & Slots", slug: "diwa-win-apk", icon: "/images/games/diwa-win.png",
    cat: "Rummy Games", version: "5.7.3", size: "34 MB", developer: "Diwa Games Studio",
    packageName: "com.diwawin.rummy", bonus: "₹78 Bonus Free", featured: true,
    rating: 4.7, votes: 76348, downloads: 547043, views: 891234,
    shortDesc: "Diwa Win APK listing with version, package, compatibility and available download information. Check the current app details and offers before use.",
    kw: "diwa win apk download",
  },
  {
    title: "Diwa Top — Rummy Master", slug: "diwa-top-apk", icon: "/images/games/diwa-top.png",
    cat: "Rummy Games", version: "3.2.1", size: "28 MB", developer: "Diwa Games Studio",
    packageName: "com.diwatop.rummy", bonus: "₹51–220 Bonus", featured: true,
    rating: 4.5, votes: 41210, downloads: 312880, views: 512300,
    shortDesc: "Diwa Top APK listing with game information, version details, package information and available download links.",
    kw: "diwa top apk",
  },
  {
    title: "Gold Slots 777", slug: "gold-slots-777-apk", icon: "/images/games/gold-slots.png",
    cat: "Slots Games", version: "7.0.9", size: "41 MB", developer: "Lucky Reel Studios",
    packageName: "com.luckyreel.goldslots", bonus: "₹200 Signup Bonus", featured: true,
    rating: 4.6, votes: 28940, downloads: 245110, views: 402500,
    shortDesc: "Gold Slots 777 APK listing with available game details, version information and installation guidance.",
    kw: "gold slots 777 apk",
  },
  {
    title: "Rummy Royal Pro", slug: "rummy-royal-pro-apk", icon: "/images/games/rummy-royal.png",
    cat: "Rummy Games", version: "2.9.4", size: "31 MB", developer: "Royal Card Labs",
    packageName: "com.royalcard.rummypro", bonus: "₹101 Welcome Bonus", featured: false,
    rating: 4.4, votes: 18770, downloads: 188420, views: 301800,
    shortDesc: "Rummy Royal Pro APK listing with game details, version information and available installation/download information.",
    kw: "rummy royal pro apk",
  },
  {
    title: "Teen Patti Gold Club", slug: "teen-patti-gold-club-apk", icon: "/images/games/teen-patti-gold.png",
    cat: "Teen Patti", version: "4.4.0", size: "36 MB", developer: "Gold Club Interactive",
    packageName: "com.goldclub.teenpatti", bonus: "₹150 Bonus Chips", featured: false,
    rating: 4.8, votes: 52330, downloads: 624700, views: 998200,
    shortDesc: "Teen Patti Gold Club APK listing with available game modes, version details and installation information.",
    kw: "teen patti gold club apk",
  },
  {
    title: "Diwa Spin — Lucky Wheel", slug: "diwa-spin-apk", icon: "/images/games/diwa-spin.png",
    cat: "Casino & Spin", version: "1.8.6", size: "22 MB", developer: "Diwa Games Studio",
    packageName: "com.diwa.spinwheel", bonus: "₹99 Free Spins", featured: false,
    rating: 4.3, votes: 15480, downloads: 210460, views: 356900,
    shortDesc: "Diwa Spin APK listing with available game details, version information and installation guidance.",
    kw: "diwa spin apk",
  },
];

/* --------------------------------- Seeding --------------------------------- */

export async function seedIfEmpty(): Promise<boolean> {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) return false;

  /* Users */
  const userDefs = [
    { name: "Site Admin", email: "admin@yonodiwagames.xyz", pass: "admin123", role: "admin" },
    { name: "Editor Neha", email: "editor@yonodiwagames.xyz", pass: "editor123", role: "editor" },
    { name: "Priya Sharma", email: "priya@yonodiwagames.xyz", pass: "author123", role: "author" },
  ];
  const userIds: number[] = [];
  for (const u of userDefs) {
    const hash = await bcrypt.hash(u.pass, 10);
    const [row] = await db
      .insert(users)
      .values({ name: u.name, email: u.email, passwordHash: hash, role: u.role })
      .returning({ id: users.id });
    userIds.push(row.id);
  }

  /* Categories */
  const catDefs = [
    { name: "Rummy Games", description: "Download the best rummy apps for Android — play Indian Rummy, Points Rummy and Pool Rummy with real players and instant withdrawals." },
    { name: "Slots Games", description: "Spin and win with top-rated slots games. Classic 777 machines, video slots and jackpot games — all free to download." },
    { name: "Teen Patti", description: "India's favourite card game. Download Teen Patti apps with live tables, private rooms and daily bonus chips." },
    { name: "Casino & Spin", description: "Lucky wheels, casinos and spin-to-win apps. Review the available app details and terms before use." },
  ];
  const catIds: Record<string, number> = {};
  for (const c of catDefs) {
    const [row] = await db
      .insert(categories)
      .values({
        name: c.name,
        slug: slugify(c.name),
        description: c.description,
        metaTitle: `${c.name} APK Download — Best ${c.name} for Android (${YEAR})`,
        metaDescription: c.description.slice(0, 155),
      })
      .returning({ id: categories.id });
    catIds[c.name] = row.id;
  }

  /* Tags */
  const tagNames = ["APK Download", "Latest Version", "Bonus", "Rummy APK", "Slots APK", "Teen Patti APK", "Free Download", "Instant Withdrawal", String(YEAR), "New App"];
  const tagIds: number[] = [];
  for (const t of tagNames) {
    const [row] = await db.insert(tags).values({ name: t, slug: slugify(t) }).returning({ id: tags.id });
    tagIds.push(row.id);
  }

  /* Games (with links + tag relations) */
  const gameIdBySlug: Record<string, number> = {};
  for (const g of GAMES) {
    const [row] = await db
      .insert(games)
      .values({
        title: g.title,
        slug: g.slug,
        shortDesc: g.shortDesc,
        content: gameContent(g),
        icon: g.icon,
        version: g.version,
        size: g.size,
        developer: g.developer,
        packageName: g.packageName,
        minAndroid: "5.0+",
        bonus: g.bonus,
        categoryId: catIds[g.cat],
        rating: g.rating,
        ratingCount: g.votes,
        downloads: g.downloads,
        views: g.views,
        featured: g.featured,
        status: "published",
        metaTitle: `${g.title} APK Download (Latest Version ${g.version}) ${YEAR}`,
        metaDescription: g.shortDesc.slice(0, 155),
        focusKeyword: g.kw,
        faqs: faqs(g),
      })
      .returning({ id: games.id });
    const gid = row.id;
    gameIdBySlug[g.slug] = gid;

    await db.insert(downloadLinks).values([
      { gameId: gid, label: `Download ${g.title} APK (Latest v${g.version})`, url: "/uploads/sample-game.apk", version: g.version, size: g.size, hits: Math.floor(g.downloads * 0.7), sort: 0 },
      { gameId: gid, label: `${g.title} — Mirror Server 2`, url: "/uploads/sample-game.apk", version: g.version, size: g.size, hits: Math.floor(g.downloads * 0.3), sort: 1 },
    ]);

    const relTagIds = [tagIds[0], tagIds[1], tagIds[2], tagIds[8]];
    if (g.cat === "Rummy Games") relTagIds.push(tagIds[3]);
    if (g.cat === "Slots Games") relTagIds.push(tagIds[4]);
    if (g.cat === "Teen Patti") relTagIds.push(tagIds[5]);
    relTagIds.push(tagIds[6], tagIds[7]);
    for (const tid of new Set(relTagIds)) {
      await db.insert(gameTags).values({ gameId: gid, tagId: tid }).onConflictDoNothing();
    }
  }

  /* Reviews */
  const reviewSeed = [
    { slug: "diwa-win-apk", name: "Rahul Verma", rating: 5, comment: "Withdrawal received in 2 minutes. Best rummy app I have used so far!" },
    { slug: "diwa-win-apk", name: "Sneha Kapoor", rating: 4, comment: "Smooth gameplay and nice bonus. Customer support is actually responsive." },
    { slug: "diwa-top-apk", name: "Amit Singh", rating: 5, comment: "Tournaments are very competitive. Won my first pool rummy game here." },
    { slug: "gold-slots-777-apk", name: "Farhan Ali", rating: 4, comment: "Huge variety of slots. Free spins every hour keeps it fun." },
    { slug: "teen-patti-gold-club-apk", name: "Deepika Nair", rating: 5, comment: "Feels like playing at a real table. Muflis variation is my favourite." },
    { slug: "diwa-spin-apk", name: "Vikram Joshi", rating: 4, comment: "Quick time-pass with real rewards. Jackpots hit more often than expected." },
  ];
  for (const rv of reviewSeed) {
    const gid = gameIdBySlug[rv.slug];
    if (!gid) continue;
    await db.insert(reviews).values({ gameId: gid, name: rv.name, rating: rv.rating, comment: rv.comment, status: "approved" });
  }

  /* Blog posts */
  const postsData = [
    { title: "YonoDiwaGames Beginner Guide: How to Find New Android Games", image: "/images/og-default.png", kw: "android games guide" },
    { title: "How to Check an APK Before Installing It on Android", image: "/images/og-default.png", kw: "check apk before installing" },
    { title: "Diwa Games vs Yono Games: What Is the Difference?", image: "/images/games/diwa-top.png", kw: "diwa games vs yono games" },
    { title: "5 Simple Ways to Keep Your Android Game Library Organized", image: "/images/og-default.png", kw: "organize android games" },
    { title: "APK Version Numbers Explained for Beginners", image: "/images/og-default.png", kw: "apk version numbers" },
    { title: "How to Read Android App Size and Version Details", image: "/images/games/rummy-royal.png", kw: "android app size version" },
    { title: "What to Do When an Android APK Will Not Install", image: "/images/og-default.png", kw: "apk will not install" },
    { title: "Android Game Update Checklist: What to Review After an Update", image: "/images/games/gold-slots.png", kw: "android game update checklist" },
    { title: "Mobile Gaming in 2026: Features Players Expect", image: "/images/og-default.png", kw: "mobile gaming 2026" },
    { title: "YonoDiwaGames FAQ: Downloads, Updates and Game Information", image: "/images/games/teen-patti-gold.png", kw: "yonodiwagames faq" },
  ];
  for (const p of postsData) {
    const excerpt = `A practical ${YEAR} guide covering ${p.kw}, key checks and useful Android game information.`;
    await db.insert(posts).values({
      title: p.title,
      slug: slugify(p.title),
      excerpt,
      content: postContent(p.title, p.kw),
      image: p.image,
      categoryId: catIds["Rummy Games"],
      authorId: userIds[2] ?? userIds[0],
      views: Math.floor(2000 + Math.random() * 9000),
      status: "published",
      metaTitle: `${p.title} | Expert Guide`,
      metaDescription: excerpt,
      focusKeyword: p.kw,
    });
  }

  /* Static pages */
  for (const p of PAGES) {
    await db.insert(pages).values({
      title: p.title,
      slug: p.slug,
      content: p.content,
      metaTitle: p.title,
      metaDescription: `${p.title} — important information about using this website.`,
    });
  }

  await db.insert(newsletterSubs).values({ email: "gamer@example.com" }).onConflictDoNothing();
  return true;
}

/* ------------------------------- Bootstrap --------------------------------- */

const MIGRATIONS = () => path.join(process.cwd(), "drizzle");

/**
 * Tri-state on purpose. A plain boolean here is what caused the original
 * data-loss bug: any transient failure (dropped pooler connection, cold-start
 * race, permissions hiccup) was caught and coerced to `false`, which the old
 * ensureSchema() treated as "database is empty" and responded to by running
 * `DROP SCHEMA public CASCADE` — wiping real tables/data that were just
 * temporarily unreachable, not actually missing.
 *
 * "unknown" now means exactly that — we could not verify — and callers must
 * NOT treat it as "missing".
 */
type SchemaState = "present" | "missing" | "unknown";

async function checkCoreTables(): Promise<SchemaState> {
  try {
    const res = await db.execute(sql`SELECT to_regclass('public.users') AS u, to_regclass('public.games') AS g`);
    const row = (res.rows?.[0] ?? {}) as { u: string | null; g: string | null };
    return row.u && row.g ? "present" : "missing";
  } catch (err) {
    console.error("[bootstrap] could not verify schema state (connection/permissions issue) — treating as UNKNOWN, not missing:", err);
    return "unknown";
  }
}

/**
 * Make sure the schema exists. This function is intentionally NEVER allowed
 * to drop, truncate, or otherwise delete anything — it only ever *creates*
 * tables that are confirmed absent, via drizzle's own idempotent migrator.
 *
 * If we can't positively confirm the tables are missing (e.g. a transient DB
 * error), we do nothing destructive and surface the error instead of
 * guessing. A false "missing" reading used to mean "wipe the database" —
 * now it means "leave it alone and fail loudly so it gets noticed."
 */
async function ensureSchema(): Promise<void> {
  const state = await checkCoreTables();
  if (state === "unknown") {
    throw new Error(
      "[bootstrap] cannot verify whether core tables exist (DB unreachable?) — refusing to run migrations against an unverified schema"
    );
  }
  // IMPORTANT: always run the migrator, even when the core tables already
  // exist. drizzle's migrate() tracks applied migrations in its own
  // `drizzle.__drizzle_migrations` table and only ever runs the ones that
  // haven't been applied yet — it is safe/idempotent to call on every boot.
  //
  // This used to early-return whenever `users`/`games` were already
  // present, which meant that on an EXISTING deployment (like a live site
  // that was first deployed before a later migration file was added — e.g.
  // the 0002 performance-index migration or the 0003 editorial-rating
  // column) the new migration would never actually run automatically. New
  // columns/tables added in later releases of this project would silently
  // never reach an already-running production database. Always invoking
  // the migrator (which only ever adds, never drops/truncates — see the
  // guarantee on bootstrapDatabase above) fixes forward migrations for
  // existing sites without reintroducing any destructive behavior.
  if (state === "missing") {
    console.log("[bootstrap] core tables not found — applying migrations (create-only, no drops)");
  }
  await migrate(db, { migrationsFolder: MIGRATIONS() });
}

/** Ensure schema exists (migrating if needed), then seed if database is empty. */
export async function bootstrapDatabase(): Promise<void> {
  const t0 = Date.now();
  await ensureSchema();
  const seeded = await seedIfEmpty();
  console.log(
    `[bootstrap] database ready in ${Date.now() - t0}ms${seeded ? " (seeded demo content)" : ""}`
  );
}

const ALL_TABLES = [
  "reviews", "game_tags", "post_tags", "download_links", "games", "posts", "tags",
  "categories", "pages", "settings", "redirects", "not_found_logs", "newsletter_subs",
  "game_requests", "reports", "contact_messages", "users",
];

/**
 * Wipe everything and re-seed demo content. DESTRUCTIVE — manual/CLI use
 * only (see scripts/seed.mjs). Never called from application runtime code
 * (instrumentation.ts, API routes, etc.) — only a human running the script
 * directly can trigger this.
 *
 * Refuses to run against what looks like production unless the operator
 * explicitly opts in, so a mistyped command or a stray CI/deploy step can't
 * truncate real data.
 */
export async function reseedDatabase(): Promise<void> {
  const looksProd = process.env.NODE_ENV === "production";
  if (looksProd && process.env.CONFIRM_DESTRUCTIVE_RESEED !== "yes") {
    throw new Error(
      "[reseed] refusing to run: NODE_ENV=production. If you really intend to " +
        "wipe this database, re-run with CONFIRM_DESTRUCTIVE_RESEED=yes explicitly set."
    );
  }
  await ensureSchema();
  await db.execute(sql.raw(`TRUNCATE ${ALL_TABLES.join(", ")} RESTART IDENTITY CASCADE`));
  await seedIfEmpty();
  console.log("✔ Reseed complete.");
  console.log("  Admin login:  admin@yonodiwagames.xyz / admin123");
  console.log("  Editor login: editor@yonodiwagames.xyz / editor123");
  console.log("  Author login: priya@yonodiwagames.xyz / author123");
}
