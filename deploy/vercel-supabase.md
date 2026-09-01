# 🚀 Deploy APKVault to **Vercel + Supabase** (direct upload, no GitHub)

End-to-end guide. ~20 minutes, no credit card, no GitHub required. On a
**genuinely fresh, empty database**, the site creates its schema and seeds
demo content automatically on first boot — you don't hand-run migrations
for a first-time setup. It will never drop or truncate existing tables; if
you already have data, boot leaves it untouched. You only provide a
connection string.

> **How it works in one line:** Supabase hosts your PostgreSQL database;
> Vercel runs the Next.js site as serverless functions that connect to
> Supabase on every request. On the very first cold start against an empty
> database, the app creates all tables and seeds demo content — and only
> in that case.

---

## 0. Prerequisites

Install on your computer (one-time):

| Tool | Install | Why |
|---|---|---|
| **Node.js 20+** | https://nodejs.org | runs the build |
| **Vercel CLI** | `npm i -g vercel` | deploy without GitHub |
| A code editor | VS Code recommended | to edit `.env` |

You also need accounts (free) on:
- **Supabase** — https://supabase.com (Sign up with email; no GitHub needed)
- **Vercel** — https://vercel.com/signup (Sign up with email; no GitHub needed)

---

## Part A — Create the Supabase database (5 min)

### A1. New project
1. Go to https://supabase.com/dashboard → **New project**
2. Name: `apkvault` (anything) · Region: closest to your users
3. **Database Password**: pick a *strong* password → save it in a password manager. **You will need it in step A3.**
4. Pricing plan: **Free** · click **Create new project**
5. Wait ~2 minutes for provisioning.

### A2. Get the connection string (the important part)
1. In your project, left sidebar → **Project Settings** (gear icon) → **Database**
2. Scroll to **Connection string** section → switch the tab to **Transaction pooler** ⭐
   - *Why pooler?* Vercel is serverless; the pooler keeps connections fast and within Supabase's limits on the free plan.
3. You will see a URI that looks like:
   ```
   postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the password you set in A1. Keep the rest exactly as-is.
5. Copy the full string — that is your `DATABASE_URL`.

> ℹ️ The `:6543` port = transaction pooler. Do **not** use `:5432` (direct) on Vercel — it will exhaust connections under traffic.

### A3. (Optional but recommended) Allow the connection
Supabase's pooler is public by default — the password is your only protection.
If you want extra safety, leave the default; the strong password is enough for
a content site. No IP allowlist needed (Vercel's egress IPs change).

That's it for Supabase. **You do not create tables** — the app does that on first boot.

> **Prefer not to rely on first-boot auto-setup?** Open the Supabase SQL
> Editor and paste/run `supabase_complete_setup.sql` (project root) before
> your first deploy. It creates every table, index, and foreign key, and
> seeds the default admin account (`admin@apkvault.com` / `admin123`) —
> so login works the instant the site is live, with no dependency on the
> app's own runtime bootstrap succeeding on cold start. It's idempotent
> (safe to run more than once) and works alongside the app's automatic
> migrator, which will simply apply any *future* migrations on top of it.

---

## Part B — Prepare the project locally (3 min)

### B1. Create `.env.local`
In the project root, copy `.env.example` to `.env.local` and fill in:

```env
DATABASE_URL="postgresql://postgres.abcdefg:YourStrongPass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
AUTH_SECRET="paste-the-output-of-openssl-rand-base64-48-here"
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"   # put your Vercel URL here later; for first deploy use "https://placeholder.local"
```

Generate the secret:
- macOS / Linux: `openssl rand -base64 48`
- Windows PowerShell: `[Convert]::ToBase64String((1..48 | % { Get-Random -Max 256 }) -as [byte[]])`

### B2. Install dependencies & test-build locally
```bash
npm install
npm run build
```
If the build finishes with `✓ Compiled successfully`, the code is ready. You can `Ctrl+C` — we don't need to run it locally.

### B3. (Optional) Sanity-check against Supabase from your machine
```bash
npx drizzle-kit push       # creates tables on Supabase right now, so you can verify the string works
node scripts/seed.mjs      # seeds demo data (optional; the app would seed itself anyway)
```
If this prints `✔ Reseed complete.`, your connection string is correct. Skip this step if you want Vercel to do everything on first deploy.

---

## Part C — Deploy to Vercel, direct upload, **no GitHub** (7 min)

### C1. Log in to Vercel CLI
```bash
vercel login
```
Pick **Continue with Email**, enter your email, click the magic link. Done.

### C2. Link the project to Vercel
In the project root:
```bash
vercel link
```
Answer the prompts:
- *Set up and deploy?* → **Y**
- *Which scope?* → your account
- *Link to existing project?* → **N**
- *What's your project's name?* → `apkvault` (or anything)
- *In which directory is your code located?* → `./` (press Enter)
- *Modify settings?* → **N**

This creates a `.vercel/` folder (don't commit it; it's local-only).

### C3. Push the three environment variables
Run these three commands (paste your real values inside the quotes):
```bash
vercel env add DATABASE_URL production       # paste the Supabase pooler string, press Enter, Ctrl+D
vercel env add AUTH_SECRET production        # paste the random secret
vercel env add NEXT_PUBLIC_SITE_URL production   # for now paste https://placeholder.local ; fix in C6
```
*Also add them for `preview` and `development` if you want:*
```bash
vercel env pull .env.vercel   # pulls all envs to a local file for `vercel dev`
```

> 💡 `NEXT_PUBLIC_*` vars are baked into the build, so you must re-deploy after changing them (step C6 will do that).

### C4. First deploy (production)
```bash
vercel --prod
```
What happens:
1. Vercel uploads your whole project folder (direct upload — no git).
2. It runs `npm install` + `npm run build`.
3. It launches serverless functions.
4. On the first request, if (and only if) it confirms the Supabase DB has
   no core tables yet, the app runs `bootstrapDatabase()` — **creating all
   17 tables and seeding demo content**. It will not do this if the tables
   already exist, and it never drops/truncates anything — a connection
   error is treated as "unknown," not "empty." You'll see this in Vercel →
   Deployments → Functions logs as `[bootstrap] database ready in …ms
   (seeded demo content)`.

When the CLI prints a URL like `https://apkvault-xxxx.vercel.app`, open it.
Give it 10–20 seconds on the very first visit (cold start + migration). If
you see a blank page, refresh once — the bootstrap was still running.

### C5. First login
- Visit `https://apkvault-xxxx.vercel.app/admin/login`
- Log in with `admin@apkvault.com` / `admin123`
- **Immediately change the password** (Admin → Users → edit admin).

### C6. Set the real canonical URL + redeploy
1. In the Vercel dashboard, your project → **Settings → Domains**. Note your
   assigned domain (e.g. `apkvault-xxxx.vercel.app`) or your custom domain.
2. Update the env var:
   ```bash
   vercel env rm NEXT_PUBLIC_SITE_URL production
   vercel env add NEXT_PUBLIC_SITE_URL production
   # paste https://apkvault-xxxx.vercel.app  (no trailing slash)
   ```
3. Redeploy:
   ```bash
   vercel --prod
   ```

🎉 Done. Your site is live on Vercel with a real Supabase database.

---

## Part D — Host icons & APK files (important on Vercel)

Vercel's serverless filesystem is **read-only** at runtime, so the admin
panel's *Upload file* button is disabled there (the API returns a helpful
501 message). Instead, host files on **Supabase Storage** and paste the
public URL into the admin fields (the icon / banner / download-link inputs
already accept any `https://…` URL).

### D1. Create a public bucket
1. Supabase dashboard → **Storage** → **New bucket**
2. Name: `assets` · toggle **Public bucket** ON · Create.

### D2. Upload files
- Drag-and-drop your icon PNGs and APK files into the `assets` bucket
  (organise in folders like `icons/`, `apks/`).
- Click a file → **Copy public URL**. It looks like:
  `https://[PROJECT_REF].supabase.co/storage/v1/object/public/assets/icons/diwa-win.png`

### D3. Use the URL in the admin panel
- Admin → Games → edit a game → **App icon** field → paste the URL.
- **Download links** → paste the APK's public URL.

> Tip: if an APK is >100 MB, Supabase Storage free tier still handles it fine;
> Vercel's own upload limit is the reason we bypass it. Supabase Storage free
> = 1 GB — plenty for icons + a few APKs. For big catalogs, use Cloudflare R2
> (free egress) or Backblaze B2 instead; any public URL works.

---

## Part E — Custom domain (optional)

1. Vercel dashboard → **Settings → Domains → Add** → enter `yourdomain.com`
2. Follow the DNS instructions (add an A record + CNAME, or nameservers).
3. Wait 1–60 min for propagation.
4. Update the env var again and redeploy:
   ```bash
   vercel env rm NEXT_PUBLIC_SITE_URL production
   vercel env add NEXT_PUBLIC_SITE_URL production   # https://yourdomain.com
   vercel --prod
   ```
5. In Google Search Console, submit `https://yourdomain.com/sitemap.xml`.

---

## Part F — Update the site later (no git needed)

Anytime you edit code locally and want to push:
```bash
npm run build              # sanity check locally (optional)
vercel --prod              # re-uploads the folder and redeploys
```
That's it. The database is untouched — Vercel only replaces the code.

To change env vars: `vercel env rm NAME production` then `vercel env add NAME production`, then `vercel --prod` (required for `NEXT_PUBLIC_*`).

---

## Part G — Backups

- **Supabase** auto-backs up the database daily on the free tier (7-day retention). Restore from **Project Settings → Database → Backups**.
- For an extra application-level backup, use the admin panel: **Settings → Advanced → Download backup** (exports everything as JSON).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| First visit shows a blank page / "Application error" | Wait 30 s and refresh. The cold start + migration was still running. Check Vercel → Functions logs for `[bootstrap]`. |
| Logs show `DATABASE_URL is required` | You forgot `vercel env add DATABASE_URL production`. Add it and redeploy. |
| Logs show `password authentication failed` | The password in your connection string is wrong, or you used the direct URL instead of the pooler URL. Re-copy from Supabase → Database → *Transaction pooler* tab and replace the password placeholder. |
| Logs show `too many connections` / `53300` | You used the `:5432` direct URL. Switch to the `:6543` pooler URL. |
| `relation "users" does not exist` after deploy | Bootstrap didn't run yet. Hit `https://yoursite.vercel.app/api/health` once — it will trigger the heal, then refresh the homepage. |
| Image / APK 404 | Vercel has no `public/uploads` at runtime. Host the file on Supabase Storage and paste the public URL into the admin form. |
| Admin upload button returns 501 | Expected on Vercel. Use Supabase Storage URLs instead (see Part D). |
| `next dev` works but `vercel --prod` fails | Usually a missing env var. Run `vercel env ls` and compare with `.env.example`. |
| "Build exceeded 15 minutes" on Hobby plan | Rare; usually npm cache issue. Retry once. If persistent, split install from build is not needed — the default `next build` works. |
| Site works but canonical / OG URLs are wrong | Update `NEXT_PUBLIC_SITE_URL` and redeploy (Part C6). |

---

## Final go-live checklist

- [ ] Supabase project created; pooler connection string saved
- [ ] `.env.local` has `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`
- [ ] `vercel env add` run for all three vars in `production`
- [ ] `vercel --prod` deployed and homepage loads
- [ ] Admin password changed
- [ ] Supabase Storage `assets` bucket created; icons + APKs uploaded
- [ ] Game icons / download URLs replaced with Supabase public URLs
- [ ] `NEXT_PUBLIC_SITE_URL` set to final domain; redeployed
- [ ] Google Search Console + sitemap submitted
- [ ] Admin → Settings: site name, logo, Telegram link, social links filled
- [ ] Admin → Settings → SEO: Google verification + Analytics/Clarity IDs
- [ ] Monthly: Admin → Settings → Advanced → Download backup (and rely on Supabase daily backups)

---

## What you end up with

- **Vercel**: globally edge-cached, auto-scaling serverless Next.js — free tier handles a content site easily (100 GB bandwidth/mo, 100 GB-hrs function time).
- **Supabase**: managed Postgres with daily backups, free tier = 500 MB DB + 1 GB storage + 5 GB bandwidth — plenty for a catalog site.
- **Zero DevOps for a first-time setup**: no servers, no SSH, no cron jobs. The app creates its schema and seeds itself the first time it finds a genuinely empty database — after that, boot leaves your data alone. Run `npm run db:migrate` explicitly if you ever need to apply new migrations to an existing database.

If anything goes wrong, the single most useful debugging page is
`https://yoursite.vercel.app/api/health` — it's read-only and returns
`{"ok":true}` when the DB is reachable and core tables are present, or
`{"ok":false}` (503) if a table is missing or the DB is unreachable.
It will never modify the database; if tables are missing, run
`npm run db:migrate` explicitly.
