# 🏛 APKVault — Complete Site Blueprint

> **One-line pitch:** A production-ready, SEO-first APK / Android game download
> website (dark violet + gold/amber design) with a full admin panel, blog,
> categories, tags, reviews, requests, redirects, ads manager, social links and
> one-click backup — built with Next.js App Router + PostgreSQL (Drizzle ORM).
>
> Share this file with any AI to fully explain what the project is and how it works.

---

## 1. What the site is

An "APK download site" in the style of APKPure / APKMirror, themed for Indian
skill-gaming apps (rummy, slots, teen patti, casino & spin). Visitors browse
games, read blog guides, and download APK files via tracked download buttons.
Everything on the site — name, logo, colors, links, ads, games, pages — is
editable from a role-based admin panel, **no coding required**.

**Default brand:** `APKVault` (rename anytime in Admin → Settings → General).

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, React Server Components, ISR/SSR) |
| Language | TypeScript |
| Database | **PostgreSQL** via **Drizzle ORM** (`drizzle-orm/node-postgres`) |
| Styling | **Tailwind CSS v4** (`@theme` tokens in `globals.css`) |
| Auth | Custom email+password login, **bcryptjs** hashing, JWT session cookie via **jose**, middleware-guarded `/admin/*` |
| Validation/Security | Zod schemas, **DOMPurify** sanitization (server-side), rate limiting, honeypot CAPTCHA on forms |
| Fonts | Bebas Neue (display) + DM Sans (body) via `next/font` |
| Runtime | Node.js (server-rendered, no static export) |

## 3. Design system

- Theme colors are **CSS variables** set at runtime from DB settings
  (`--primary` violet, `--accent` gold) so the admin color pickers restyle the
  whole site instantly.
- Utility classes defined in `src/app/globals.css`:
  `btn-gold` (yellow CTA), `btn-violet`, `btn-ghost`, **`btn-telegram`** (Telegram
  brand blue `#229ed9`), `card`, `card-gold`, `gold-text`, `section-title`,
  `chip`, `gold-frame`, `animate-glow`, `animate-floaty`, etc.
- Dark theme by default; light theme toggle persisted in localStorage.
- Telegram-related UI (buttons, icons, floating widget) uses **Telegram blue**.

## 4. Public routes (SEO-optimized, all server-rendered)

| Route | Purpose |
|---|---|
| `/` | Homepage: hero + stats, top rated rows, latest grid, trending scroller, blog excerpt, Telegram join CTA |
| `/games` | Full games catalog with search + sort (latest / rating / downloads / trending) + pagination |
| `/game/[slug]` | Game detail: icon banner, rating/reviews, description, FAQ accordion, **tracked download buttons**, related games, sticky sidebar |
| `/category/[slug]` | Category landing page (SEO meta + game grid + pagination) |
| `/tag/[slug]` | Tag landing page |
| `/blog` | Blog index |
| `/blog/[slug]` | Article page (author box, share buttons, views) |
| `/page/[slug]` | Static pages (Privacy Policy, Terms, DMCA, Disclaimer — editable in admin) |
| `/search` | Site-wide search results |
| `/contact` | Contact form (honeypot + rate limited) + social links |
| `/request` | "Request a game" form |
| `/sitemap.xml` | Auto-generated XML sitemap (all games/posts/categories/tags/pages) |
| `/robots.txt` | Robots rules |
| `/rss.xml` | RSS feed |
| `/manifest.webmanifest` | PWA manifest |

Every page sets canonical URLs, OpenGraph/Twitter cards and JSON-LD structured
data (Organization, WebSite, SoftwareApplication, Article, FAQPage, BreadcrumbList).

## 5. Admin panel — `/admin` (protected by middleware)

Login: `admin@apkvault.com / admin123` (change in production!).

| Section (`/admin/…`) | Capabilities |
|---|---|
| Dashboard | Stats cards + "Manage Everything" quick-action grid |
| Games | List/search/publish/draft/delete; editor with icon & APK upload, download links (multi-mirror, hit counts), FAQ builder, tags, auto-complete SEO meta, **real-time SEO score checklist** |
| Posts | Same rich editor for blog articles |
| Categories | Add / **rename** / delete with SEO fields |
| Tags | Add / rename / delete |
| Pages | Edit Privacy/Terms/DMCA/Disclaimer or add custom pages |
| Reviews | Approve / reject / delete user ratings |
| Inbox | Contact messages + game requests |
| Redirects | 301/302 manager + **404 monitor** (auto-logs broken URLs, one-click fix) |
| Users | Role management: admin / editor / author / moderator (role-permission matrix enforced in every API) |
| Settings | Tabs: General (site name, logo, favicon, tagline, colors, footer) · **Links Manager** (header & footer nav links) · Social Links (Telegram… + floating buttons + cookie bar) · SEO (verification codes, GA/GTM/Clarity, IndexNow) · Ads Manager (6 positions with on/off) · Advanced (maintenance mode, SMTP, **one-click backup/restore**) |

## 6. Database schema (17 tables — `src/db/schema.ts`)

`users` · `categories` · `games` (with jsonb `faqs`) · `download_links`
(tracked hits) · `tags` + `game_tags` + `post_tags` · `posts` · `reviews`
· `pages` · `settings` (key/value jsonb) · `redirects` · `not_found_logs`
· `newsletter_subs` · `game_requests` · `reports` · `contact_messages`

## 7. API routes (`/api/…`)

- **Auth:** `POST /auth/login` (rate-limited, bcrypt), `POST /auth/logout`, `GET /auth/me`
- **Admin CRUD:** `/admin/games`, `/admin/posts`, `/admin/categories`, `/admin/tags`,
  `/admin/pages`, `/admin/reviews`, `/admin/users`, `/admin/settings`,
  `/admin/redirects`, `/admin/inbox`, `/admin/stats`, `/admin/backup` (JSON
  export/import), `/admin/indexnow` (SEO ping) — all role-checked
- **Public:** `GET /download/[id]` (counts hit + 302 redirect),
  `POST /forms` (contact/request/review/newsletter/report with honeypot),
  `GET /search`, `POST /track` (view counters), `POST /upload` (admin file
  upload → `public/uploads`), `GET /health`

## 8. Safe boot sequence (`src/instrumentation.ts`)

On server start the app checks whether the core DB tables exist, using a
three-way result: **present** / **missing** / **unknown** (query failed —
connection blip, timeout, permissions). Only a *positively confirmed*
"missing" leads to applying the SQL migrations from `drizzle/`; an
"unknown" result does nothing destructive and just logs an error — it is
never treated as "missing." After the schema is confirmed present, it
seeds demo content **only if the `users` table is empty**. A fresh hosting
environment therefore boots into a fully working site — including a
brand-new Supabase project or a Vercel cold start. The boot routine has
built-in retries (to ride out transient connection races on serverless),
but a retry only means "check again," never "rebuild the schema again."
**The app never runs `DROP SCHEMA`, `DROP TABLE`, or `TRUNCATE`
automatically** — `/api/health` is read-only and cannot trigger schema
changes; it only reports status.
Manual full reseed (destructive, CLI-only, blocked in production unless
`CONFIRM_DESTRUCTIVE_RESEED=yes` is set): `node scripts/seed.mjs`.
Manual migration-only run: `npm run db:migrate`.

> **Serverless note:** on Vercel / other read-only-filesystem hosts the admin
> file-upload API returns 501 with a helpful message; admins paste external
> URLs (Supabase Storage / R2 / S3) into the icon / banner / download fields,
> which already accept any `https://…` URL. The SQL migrations folder is
> bundled into every serverless function via `outputFileTracingIncludes` in
> `next.config.ts`, so runtime migrations work without any extra setup.
>
> **Preview / iframe note:** the CSRF origin check (`checkOrigin` in
> `src/lib/api.ts`) and the session cookie flags (`createSession` in
> `src/lib/auth.ts`) are both topology-aware. `checkOrigin` accepts the
> request when the origin matches `host`, `x-forwarded-host`,
> `x-original-host`, the configured `siteUrl()`, *or* when proxy headers
> (`x-forwarded-for` / `x-forwarded-proto`) indicate we're behind a reverse
> proxy / sandboxed preview whose public origin we can't enumerate from
> inside. The session cookie picks `SameSite=None; Secure` on HTTPS requests
> (so the admin panel keeps working when a preview sandbox embeds it in a
> cross-origin iframe) and falls back to `SameSite=Lax` without `Secure` on
> plain-HTTP localhost dev. This is why admin login "just works" on every
> host we target: localhost, Vercel, DreamHost/Passenger, DreamHost VPS +
> nginx, and sandboxed previews.

## 9. SEO systems (built-in, no plugins)

Auto meta title/description per game (keyword + version + year patterns),
canonical tags, OG images, JSON-LD everywhere, XML sitemap, robots.txt, RSS,
IndexNow ping, search-engine verification fields, cookie consent, maintenance
mode, 404 logging with redirect repair.

## 10. Project structure

```
src/
  app/            public routes + /admin + /api
  components/     shared UI (header, footer, cards, forms, icons…)
    admin/        admin client components (game form, seo panel…)
  db/             schema.ts · seed.ts (bootstrap) · reseed.ts · index.ts
  lib/            auth.ts · roles.ts · settings.ts · data.ts · seo.ts
                  sanitize.ts · slug.ts · util.ts · api.ts
  middleware.ts   /admin guard + session cookie check
drizzle/          SQL migrations (auto-applied at boot)
scripts/seed.mjs  manual full reseed
public/uploads/   uploaded icons/APKs (persist this folder!)
deploy/           DreamHost deployment files & guide
```

## 11. Environment variables

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ (prod) | JWT session signing secret |
| `NEXT_PUBLIC_SITE_URL` | ✅ (prod) | Canonical/sitemap base URL |

## 12. Running

```bash
npm install
npm run build      # prod build (migrations+seed run automatically at start)
npm run start      # or: npm run dev for development
```

Deployment guides (in `deploy/`):

- **`vercel-supabase.md`** ⭐ — step-by-step **Vercel + Supabase** deploy with
  direct folder upload (no GitHub), Supabase Storage for icons/APKs, custom
  domain, update workflow and troubleshooting.
- **`dreamhost-quickstart.md`** — the 15-minute, commands-only DreamHost
  deploy (shared + Passenger *or* VPS + systemd + nginx). Start here if you
  already know what Passenger and systemd are.
- **`dreamhost.md`** — the full DreamHost **runbook**: every plan type
  (Shared / Shared Unlimited / DreamPress / VPS / Dedicated / DreamCompute /
  Remixer), every database option (Neon / Supabase / Railway / Fly /
  self-hosted), panel-by-panel walkthroughs, SSH + nvm setup, the memory-wall
  rescue path for shared builds, systemd + nginx + certbot in annotated
  detail, DNS / email / cron / permissions / backups / observability, a
  30-entry troubleshooting matrix, a 25-point go-live checklist, and ten
  copy-paste appendices (systemd unit, nginx config, `.htaccess`,
  `deploy.sh`, logrotate, cron recipes, panel paths cheat-sheet, self-heal
  explainer).

Any Node-capable host works the same way because the app creates its own
schema on first boot against a genuinely empty database — never against
one that already has data.
