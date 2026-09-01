# YonoDiwaGames

Production-ready Next.js + PostgreSQL/Supabase game and blog platform.

## Deploy to Vercel

1. Import this folder as a new Vercel project.
2. Use Node.js 20+.
3. Add production environment variables from `.env.example`:
   - `DATABASE_URL`
   - `AUTH_SECRET` (32+ random characters)
   - `NEXT_PUBLIC_SITE_URL=https://diwayonogames.xyz`
   - `NODE_ENV=production`
4. Deploy.
5. Add `diwayonogames.xyz` in Vercel and configure the DNS records Vercel provides.
6. Open these URLs before configuring Google Search Console:
   - `/`
   - `/robots.txt`
   - `/sitemap.xml`
   - `/games`
   - `/blog`

## First admin login on a fresh database

The demo seed creates:

- `admin@yonodiwagames.xyz` / `admin123`
- `editor@yonodiwagames.xyz` / `editor123`
- `priya@yonodiwagames.xyz` / `author123`

**Change demo passwords immediately after the first login.**

## SEO / Sitemap

The public sitemap is generated at `/sitemap.xml` and uses the Admin → Settings → Site URL / Canonical Domain value. The sitemap always returns valid XML with core URLs even if the database is temporarily unavailable, then adds published indexable content when the database is ready.

Submit `sitemap.xml` in Google Search Console only after the production URL opens successfully.

## Content editor

Game articles and blog articles accept sanitized HTML. Titles and short descriptions remain plain text. Dangerous HTML and URL schemes are removed when content is saved.

## Homepage hero logos

Admin → Settings → Homepage Hero Logos controls exactly three homepage logo slots. Each slot supports an uploaded image, title and destination URL.
