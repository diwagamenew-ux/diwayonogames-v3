# README-DEPLOYMENT — Reusable Android Games/Apps CMS

This project (internal codename **APKVault**, currently branded **New Diwa
Games**) is a reusable Next.js + PostgreSQL publishing CMS for Android
game/app download sites. Nothing about "New Diwa Games" or any specific
game name is hardcoded in the source — the brand, domain, games, and SEO
defaults all live in the database and are edited from `/admin`. This file
explains how to run it, deploy it, and reuse it for a brand-new site.

---

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in real values:

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase, Neon, RDS, etc.) |
| `AUTH_SECRET` | Yes in production | Signs the admin session cookie. Generate with `openssl rand -base64 48`. The app **refuses to boot in production** without a real one — this is intentional, not a bug. |
| `NEXT_PUBLIC_SITE_URL` | Yes in production | Your live domain, no trailing slash (e.g. `https://yourdomain.com`). Used for canonical tags, sitemap, robots.txt, Open Graph, and structured data. |

No real secrets are committed anywhere in this repo — `.env.example`
contains variable **names** only.

## 3. Run locally

```bash
npm run dev
```

On first boot against a genuinely empty database, the app automatically
creates all tables and seeds demo content (games, a blog post, categories,
three demo admin/editor/author logins). On every subsequent boot it only
ever *adds* new tables/columns from later releases of this project — it
never drops or truncates existing data. See `src/db/seed.ts` for the
guarantee.

Demo logins (seeded only into a fresh, empty database — **change these
before going live**):
- `admin@apkvault.com` / `admin123` (full access)
- `editor@apkvault.com` / `editor123`
- `priya@apkvault.com` / `author123`

## 4. Build

```bash
npm run build
```

> **Note on this delivery:** the sandbox this project was audited and
> edited in has no network access, so `npm install` / `npm run build`
> could not actually be executed here (see "Remaining issues" in the
> audit report). Every change was reviewed by hand for syntax and type
> correctness, but please run `npm run build` yourself as the first step
> after unzipping, before deploying, and open an issue/fix anything the
> compiler flags.

## 5. Deploy to Vercel

See `deploy/vercel-supabase.md` for a full walkthrough (Supabase Postgres +
Vercel, no GitHub required). Short version:

```bash
npm i -g vercel
vercel
```

Then in **Vercel → Project → Settings → Environment Variables**, add
`DATABASE_URL`, `AUTH_SECRET`, and `NEXT_PUBLIC_SITE_URL` for the
Production environment, and redeploy.

`deploy/dreamhost.md` / `deploy/dreamhost-quickstart.md` cover a
traditional Node-host deployment if you're not using Vercel.

## 6. Log into the Admin Panel

Go to `https://yourdomain.com/admin/login` and sign in with the admin
account (seeded demo account above, or one you create). **Change the
default admin password immediately** — Admin → Users.

## 7. Configure a brand-new website (no code changes)

Everything under **Admin → Settings** is stored in the database `settings`
table and takes effect immediately, site-wide:

- **General** — site name, tagline, description, logo, favicon, footer
  text, copyright, theme colors.
- **Links Manager** — header & footer navigation links.
- **Social Links** — Telegram/WhatsApp/Discord/etc. + floating buttons,
  cookie consent bar.
- **SEO** — Google/Bing/Yandex verification codes, GA/GTM/Clarity IDs,
  IndexNow key.
- **Ads Manager** — 6 independently-toggleable ad slots (header, sidebar,
  in-content, sticky bottom, popup, before-download); paste any ad
  network's code, not locked to one provider.
- **Advanced** — maintenance mode, SMTP, one-click JSON backup/restore.

To relaunch this exact project as a different brand on a different
domain:
1. Deploy a fresh copy (new Vercel project + new/empty Postgres database).
2. Set `NEXT_PUBLIC_SITE_URL` to the new domain in that deployment's
   environment variables (this is a per-deployment config value, not
   something to hand-edit in source — the same reason `DATABASE_URL` and
   `AUTH_SECRET` are env vars too).
3. Log into `/admin`, go to Settings → General, and change the site name,
   logo, favicon, description, social links, etc.
4. Start publishing that brand's games — see below.

No source file needs to change for any of the above.

## 8. Add a new game

Admin → Games → **+ New Game**. Fields include name/slug, short & full
description, version, package name, developer, category, tags, Android
version requirement, featured/published status, an unlimited number of
**download links** (label + URL + version/size — this is where you paste
your own referral/download link), and an FAQ builder.

Publishing a game automatically:
- creates its public page at `/game/your-slug`
- adds it to the sitemap (unless you tick "noindex")
- adds it to its category and to the homepage's "Latest Games"
- generates `SoftwareApplication` structured data from the real fields you
  entered (no fabricated ratings/downloads — see Phase 11 in the original
  brief)
- generates breadcrumbs and related-game internal links

## 9. Add the referral/download URL

On the game editor, scroll to **Download Links**. Each row is `Label +
URL (+ optional version/size)`. The first row is used for the primary
"Download APK" button on the public game page; add more rows for mirrors.
Every click is tracked (hit count) without exposing any admin-only data.

## 10. How SEO defaults work

Every content type (games, blog posts, categories, static pages) has
manual override fields for **SEO title, meta description, focus keyword,
canonical URL**. If you leave a field empty, the system fills in a
sensible automatic value from the actual content (e.g. `"{Game} APK
Download (Latest Version {version}) for Android"`). Manual values, when
present, always win. Every content type also now has a **"Hide from
search engines (noindex)"** checkbox — check it to keep a specific page
out of the sitemap and tell search engines not to index it, without
touching code.

## 11. Submit the sitemap to Google Search Console

1. Verify your domain in Search Console (Admin → Settings → SEO →
   paste the Google verification meta tag value).
2. Sitemaps → Add a new sitemap → enter `sitemap.xml`
   (resolves to `https://yourdomain.com/sitemap.xml`).
3. Optionally also set an IndexNow key in Settings → SEO and use the
   "Ping IndexNow" action in Admin → SEO to push new/changed URLs to
   Bing/Yandex/etc. immediately.

---

## What changed in this pass (summary)

See the chat response for the full audit report. In short:
- Added a per-content **noindex** toggle (games, posts, categories, pages)
  — wired through the schema, migration, admin API, admin UI, public
  metadata, and sitemap exclusion.
- Fixed a bootstrap bug where schema migrations added *after* first
  deploy would never reach an already-running production database.
- Closed several CSRF gaps (missing `checkOrigin` calls) on admin
  mutation routes — most notably user management (role changes/deletion)
  and several DELETE endpoints.
- Confirmed no hardcoded "New Diwa Games" / brand / domain strings exist
  in the source; all identity, SEO, ads, and analytics config is
  database-driven via Admin → Settings.

## V2 SEO & Reusable Site Configuration

The project is designed to be reusable for different game/app brands. The current default identity is New Diwa Games, but normal branding and SEO configuration is database-backed.

### Admin → Site Settings

You can change:

- Site name, site URL/canonical domain, tagline and description
- Logo and favicon
- Homepage hero badge, H1 and introduction
- Homepage section titles and CTA text
- Homepage SEO title, description, focus/secondary keywords
- Homepage canonical, noindex/nofollow
- Homepage Open Graph and Twitter/X metadata
- Google/Bing/Yandex verification
- Analytics, GTM and Clarity
- Ads and navigation

### Per-content SEO

Games, blog posts, categories, tags and static pages support content-specific SEO fields where applicable, including title, description, H1, focus keywords, canonical, index/follow controls and social metadata. Manual values override automatic fallbacks.

### Game publishing workflow

From Admin → Games, publish a game with its actual title, description, version, package name, category, images and **Download/Referral URL**. The public game page uses the configured download link and automatically participates in the site's internal linking and sitemap system.

### Canonical domain

The Admin Site URL controls canonical/absolute SEO URLs, sitemap, robots.txt and structured data. Changing this value does **not** configure DNS or Vercel domains; the real domain still needs to be added/configured in Vercel.

### Sitemap and robots

- `/sitemap.xml` is generated from published/indexable content.
- Draft and noindex content is excluded from the sitemap.
- `/robots.txt` references the configured sitemap and blocks private/admin/API/search routes.

### Database migration

After deploying this V2 update to an existing database, run the project's normal Drizzle migration/bootstrap process so migration `0005_expand_seo_controls.sql` is applied. It uses `ADD COLUMN IF NOT EXISTS` and does not delete existing content.


## V3 SEO & Publishing Improvements

This release adds a reusable SEO audit dashboard and automatic 301 redirects when an existing game's or blog post's slug changes. The old URL is preserved in the Redirect Manager so indexed links can continue to reach the new URL.

The Admin Panel now includes **SEO → SEO Audit**, which checks published games, posts, categories and pages for missing/weak metadata, short content, missing images and noindex status. Scores are advisory rather than a guarantee of search-engine rankings.

The reusable template also ships with blank social-profile defaults. Configure the real profiles under **Admin → Settings → Social Links** before publishing a new brand.
