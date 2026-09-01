# YonoDiwaGames — Clean Deployment Checklist

## 1. Vercel

1. Create a **new Vercel project** from this folder.
2. Set the production environment variables before the first production deploy:
   - `DATABASE_URL` — Supabase/Postgres connection string suitable for serverless use.
   - `AUTH_SECRET` — long random secret.
   - `NEXT_PUBLIC_SITE_URL=https://diwayonogames.xyz`
   - `NODE_ENV=production`
3. Deploy.

## 2. Domain

Add `diwayonogames.xyz` to the Vercel project and configure the DNS records Vercel displays.

Do not change the domain in Google Search Console until these URLs work:

- `https://diwayonogames.xyz/`
- `https://diwayonogames.xyz/robots.txt`
- `https://diwayonogames.xyz/sitemap.xml`
- `https://diwayonogames.xyz/games`
- `https://diwayonogames.xyz/blog`

The sitemap endpoint is designed to return valid XML even if the database is temporarily unavailable; once the database is ready it includes published indexable games, posts, categories, tags and pages.

## 3. Admin settings

Open **Admin → Settings → General** and confirm:

- Site name: `YonoDiwaGames`
- Site URL / Canonical Domain: `https://diwayonogames.xyz`

The admin setting controls canonical URLs, sitemap, robots.txt and structured-data base URLs. DNS/domain connection is still controlled by Vercel.

## 4. Homepage logos

Open **Admin → Settings → Homepage Hero Logos**.

There are exactly three editable slots. Each slot supports:

- image upload
- title
- destination URL

## 5. HTML articles

Game article content and blog article content support sanitized HTML. Titles and short descriptions remain plain text.

Unsafe HTML such as scripts and dangerous URL schemes is removed when content is saved.

## 6. Google Search Console

After the production sitemap opens successfully:

1. Verify the `diwayonogames.xyz` property.
2. Open **Sitemaps**.
3. Submit `sitemap.xml`.
4. Confirm Google reports the sitemap as successfully fetched.
5. Request indexing for the homepage and important public pages.

Do not submit a Vercel preview URL as the production sitemap.
