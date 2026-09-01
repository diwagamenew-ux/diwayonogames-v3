# 🏔 APKVault on DreamHost — The Runbook

*Every plan. Every path. Every footgun I've stepped on so you don't have to.*

This isn't a five-step blog post. DreamHost is a twenty-year-old hosting
company with a control panel that predates React, a Node.js story that
depends on which Tuesday you signed up, and zero managed Postgres. None of
that is a dealbreaker — but each of those facts has a right way and three
wrong ways to handle it, and the wrong ways cost an evening. Read the
section that matches your plan, skip the rest, keep this tab open for the
troubleshooting matrix.

If you already know what Passenger and systemd are and just want the
commands in order, go to **[`dreamhost-quickstart.md`](./dreamhost-quickstart.md)**
instead. This file is the deep reference.

---

## 0. The thirty-second truth

Four facts shape everything else. Write them on a sticky note.

1. **DreamHost can run this app** — but only on plans that give you a
   Node.js runtime. That's *Shared with Passenger*, *VPS*, *Dedicated*,
   and *DreamCompute*. It is **not** *DreamPress*, *Remixer*, or the
   drag-and-drop website builder. §1 tells you which one you own.
2. **DreamHost does not sell managed PostgreSQL.** Their shared DB
   offering is MySQL/MariaDB, which this app cannot use (the schema is
   `pgTable` + `jsonb` + Postgres arrays — porting is a multi-day
   rewrite, not a config change). You bring your own Postgres from a
   provider that's free for a content site. §2 picks one for you.
3. **You never run migrations by hand for a fresh setup.** The app's
   boot routine (`src/instrumentation.ts` → `bootstrapDatabase()`)
   creates all 17 tables and seeds demo content the first time it
   confirms the database is genuinely empty — and only then; it never
   drops or truncates existing tables. If the schema is ever missing
   (wiped DB, botched deploy, restored snapshot without the schema),
   run `npm run db:migrate` explicitly to (re)create it — `/api/health`
   is read-only and will not do this for you automatically. Your job
   ends at "set `DATABASE_URL` and start the process."
4. **Two deployment shapes cover every DreamHost plan.** *Passenger* on
   shared (Apache spawns your Node app on demand, you touch
   `tmp/restart.txt` to reload). *systemd + nginx* on VPS / Dedicated /
   DreamCompute (you own the process, the reverse proxy, the TLS cert).
   §5 and §6 respectively. Everything else in this doc is supporting
   material for one of those two paths.

```
   YOU, with a domain and a credit card
        │
        ▼
   ┌──────────────────────────────────────────────────────┐
   │  DreamHost control panel                             │
   │   • add the domain                                   │
   │   • create a shell user (shared) or provision VM     │
   │   • tick "Passenger Node.js" (shared)                │
   │   • let Let's Encrypt provision the cert             │
   └──────────────────────────────────────────────────────┘
        │
        │  ssh + rsync
        ▼
   ┌──────────────────────────────────────────────────────┐
   │  /home/USER/apks.example.com   (shared)              │
   │  /srv/apkvault                 (VPS)                 │
   │   • your code                                        │
   │   • node_modules (installed on server)               │
   │   • .next        (built on server, or uploaded)      │
   │   • .env         (chmod 600)                         │
   │   • app.js       (shared only — Passenger entry)     │
   └──────────────────────────────────────────────────────┘
        │
        │  TCP/TLS
        ▼
   ┌──────────────────────────────────────────────────────┐
   │  PostgreSQL @ Neon / Supabase / Railway / self-VPS   │
   │   • 17 tables, auto-created on first boot            │
   │   • daily backups handled by the provider            │
   └──────────────────────────────────────────────────────┘
```

---

## 1. What DreamHost plan do you *actually* have?

DreamHost's pricing page rearranges itself every quarter, but the
underlying products are stable. Find your row. The "Verdict" column is
the only one that matters for this app.

| Plan family | Example SKUs (2026) | ~$/mo | Shell? | Passenger? | Root? | Verdict for APKVault |
|---|---|---|---|---|---|---|
| **Shared Starter** | "Shared Starter" | 2.50–4 | ✅ | ⚠ sometimes | ❌ | Works *if* the Passenger toggle appears in the domain editor. Check §1.1. |
| **Shared Unlimited** | "Shared Unlimited" | 4–8 | ✅ | ✅ usually | ❌ | The sweet spot for hobby traffic. Follow §5. |
| **DreamPress** | "DreamPress Plus / Pro / Advanced" | 16–71 | ✅ | ❌ (WP-only stack) | ❌ | **Won't run this app.** It's a managed WordPress product; Node isn't on the menu. Use a different host for the app, keep the domain + mail here if you like. |
| **VPS Basic** | "VPS Basic / Business / Enterprise" | 10–80 | ✅ root | install yourself | ✅ | The grown-up path. Follow §6. Easiest of all once set up. |
| **Dedicated** | "Standard / Enhanced / Enterprise" | 140+ | ✅ root | install yourself | ✅ | Overkill unless you're running a network of sites. Same §6 path. |
| **DreamCompute** | hourly VMs | 4–80 | ✅ root | install yourself | ✅ | Same as VPS; you just provision the VM via the DreamCompute panel instead of a fixed monthly box. |
| **Remixer / Website Builder** | "Remixer" | 0–4 | ❌ | ❌ | ❌ | **Won't run this app.** It's a drag-and-drop static site tool. |

> 🎯 **DECISION** — If the monthly bill is under $10 and you're not sure,
> you're on Shared. If you can `sudo` on the box, you're on VPS /
> Dedicated / Compute. If your dashboard says "DreamPress" or "Remixer"
> anywhere, stop reading this doc and go deploy on Vercel / Render
> instead — DreamHost's managed products don't expose a Node runtime.

### 1.1 The "is Passenger actually on my shared plan?" test

The panel *used* to show Passenger on every shared tier. It doesn't
anymore. Before you invest an hour in §5, confirm it's there:

**From the panel:**

1. *Domains → Manage Domains* → find your domain → *Edit* (pencil icon).
2. Scroll the edit form. Look for a section literally labelled
   **"Passenger Node.js"** or, on some panel versions, **"Web options"
   → "Passenger (Ruby/Node.js/Python)"**.
3. If the section exists and has a checkbox or radio button → ✅ you
   have Passenger. Tick it, save, go to §5.
4. If the section is *missing entirely* → ❌ your plan doesn't include
   it. You have three exits:
   - Upgrade to a tier that does (cheapest if you're already on
     DreamHost; usually a $2–4/mo jump).
   - Move to a DreamHost VPS (§6).
   - Keep the domain + mail on DreamHost, deploy the app on Vercel /
     Render / Fly.io, point the domain's A record at the app host.

**From SSH** (faster, if you already have shell access):

```bash
ssh user@yourdomain.com
passenger-config --version     # prints a version → Passenger is installed
which passenger                # empty → not on this plan
```

> 🪤 **TRAP** — Don't trust forum posts from 2019 that say "all shared
> plans have Passenger." DreamHost's plan matrix has churned three times
> since then. Test on *your* account, today.

---

## 2. Database — the honest options menu

DreamHost will happily sell you MySQL. This app doesn't speak MySQL.
Pick a Postgres provider from the table; they're all free at the scale
of a content site, and they all give you a connection string in under
five minutes.

| Provider | Free tier | Paid from | Pooler? | Avg latency to DH US-West | Best for | The one gotcha |
|---|---|---|---|---|---|---|
| **Neon** | 0.5 GB storage, 1 project | $0 (hobby) then $19/mo | ✅ (built-in) | ~20 ms | Hobby + small prod; branch-per-PR workflows | Free tier scales to zero after 5 min idle → ~250 ms cold-start on the first query. Fine for a content site, annoying for an admin panel you leave open. |
| **Supabase** | 500 MB DB + 1 GB storage + 5 GB egress | $25/mo | ✅ (Supavisor, port 6543) | ~25 ms | Sites that might want auth / storage / realtime later | Use the **Transaction pooler** URI, not the direct one, on any host that opens many short-lived connections (which includes Passenger). |
| **Railway** | $5 credit/mo (effectively free for tiny DBs) | $5/mo + usage | ✅ (via PgBouncer add-on) | ~30 ms | Teams already on Railway for other services | The free credit resets monthly; a quiet DB stays free, a chatty one bills a few dollars. |
| **Fly.io Postgres** | "flex" tier on shared-cpu VM | $1.94/mo + storage | ✅ (built-in) | ~30 ms | People who want their DB on the same provider as their app (if app is also on Fly) | Flex tier is a real VM; you manage OS patches. |
| **Crunchy Bridge** | $0 trial credit | $29/mo | ✅ | ~15 ms | Production with serious SLA needs | No permanent free tier; trial only. |
| **Aiven** | "startup-4" free trial | $19/mo | ✅ (PgBouncer) | ~25 ms | EU data residency | UI is busy; the connection string is under "Connection information → pgBouncer". |
| **Self-hosted on your VPS** | $0 (you pay for the VPS) | $0 | install PgBouncer yourself | 0 ms (same box) | VPS users who want zero external deps | You own backups, patches, WAL tuning. §2.2 below. |

> 💡 **PRO TIP** — For a first deploy, pick **Neon**. Signup is email-only,
> the free tier never expires (just sleeps), and the pooled connection
> string is one click away. You can always migrate to Supabase or
> self-hosted later with `pg_dump` / `pg_restore` — it's standard
> Postgres, no vendor lock-in.

### 2.1 Connection string anatomy

Every provider gives you a URI that looks like one of these. The whole
string — including `?sslmode=require` or `?pgbouncer=true` — is your
`DATABASE_URL`. Don't URL-decode it, don't split it, don't add quotes
inside it.

```
# Neon — pooled (preferred on DreamHost)
postgresql://USER:PASS@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true

# Neon — direct (fine on VPS where connections are long-lived)
postgresql://USER:PASS@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require

# Supabase — transaction pooler (port 6543) — use this one
postgresql://postgres.REF:PASS@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Supabase — direct (port 5432) — DO NOT use on shared/Passenger
postgresql://postgres:PASS@db.REF.supabase.co:5432/postgres

# Railway
postgresql://postgres:PASS@roundhouse.proxy.rlwy.net:12345/railway

# Fly Postgres
postgresql://postgres:PASS@myapp-db.flycast:5432/postgres

# Self-hosted on the same VPS
postgresql://apkvault:PASS@127.0.0.1:5432/apkvault
```

> 🪤 **TRAP** — The single most common deploy failure on DreamHost is
> copying the Supabase *direct* URI (`:5432`) instead of the *pooler*
> URI (`:6543`). Passenger spawns and kills Node workers constantly;
> each spawn opens a fresh Postgres connection; Supabase's free tier
> caps you at ~60 concurrent direct connections; you hit the cap within
> an hour and the site starts returning 503s. The pooler multiplexes
> thousands of client connections over a few server connections. Use
> the pooler. Always.

### 2.2 Self-hosted Postgres on a DreamHost VPS

If you're on §6 anyway and want zero external dependencies:

```bash
# as root
apt update && apt install -y postgresql postgresql-contrib

# as postgres user
sudo -u postgres psql <<'SQL'
CREATE USER apkvault WITH PASSWORD 'REPLACE_WITH_32_RANDOM_CHARS';
CREATE DATABASE apkvault OWNER apkvault;
ALTER USER apkvault SET default_transaction_isolation = 'read committed';
SQL

# listen only on loopback (the Node app is on the same box)
PG_CONF=$(ls /etc/postgresql/*/main/postgresql.conf)
sed -i "s/^#*listen_addresses.*/listen_addresses = 'localhost'/" "$PG_CONF"
systemctl restart postgresql

# sanity check
sudo -u postgres psql -c "\l" | grep apkvault
```

Your `DATABASE_URL` is then
`postgresql://apkvault:REPLACE_WITH_32_RANDOM_CHARS@127.0.0.1:5432/apkvault`
— no `sslmode` needed (loopback), no pooler needed (one app, long-lived
connections).

Backups are now your problem. §11.3 covers it.

---

## 3. Before you touch the panel — prep on your laptop

Twenty minutes of prep saves two hours of "why isn't this working" on
the server. Do all of this *before* logging into DreamHost.

### 3.1 Local toolchain check

```bash
node -v        # want v20.x or v22.x. v18 works, v16 doesn't.
npm  -v        # 10+
rsync --version | head -1   # any recent version
git  --version
ssh  -V        # OpenSSH 8+
```

If `node -v` is old, install via [nvm](https://github.com/nvm-sh/nvm) or
[fnm](https://github.com/Schniz/fnm) — don't fight your system package
manager.

### 3.2 SSH key, if you don't have one

```bash
ls ~/.ssh/id_ed25519.pub 2>/dev/null || ssh-keygen -t ed25519 -C "you@example.com"
cat ~/.ssh/id_ed25519.pub           # copy the whole line
```

Add the public key at **DreamHost panel → Users → SSH Keys → Add Key**.
Paste, save. From now on, `ssh user@yourdomain.com` won't ask for a
password.

### 3.3 Generate the auth secret

The session cookie is signed with this. 32+ random bytes, base64.

```bash
# macOS / Linux
openssl rand -base64 48

# Windows PowerShell
[Convert]::ToBase64String((1..48 | %{ Get-Random -Max 256 }) -as [byte[]])
```

Paste the output somewhere safe (password manager). You'll put it in
`.env` as `AUTH_SECRET`. **If you ever lose it, generating a new one
logs every user out** — that's the point, not a bug.

### 3.4 Decide the canonical URL

The app bakes this into the build (it's a `NEXT_PUBLIC_*` var). It
drives sitemaps, canonical tags, OpenGraph images, IndexNow pings, RSS
feed URLs. Changing it later requires a rebuild + redeploy.

Pick one of:

- `https://apks.example.com` (subdomain — cleanest if the apex runs
  something else)
- `https://example.com` (apex — fine if the whole site is the APK
  catalog)
- `https://www.example.com` (only if you've decided `www` is canonical
  and the apex 301-redirects to it)

Write it down **without** a trailing slash.

### 3.5 Draft `.env.local` locally

In the project root:

```bash
cp .env.example .env.local
```

Fill in the three required vars. `NEXT_PUBLIC_SITE_URL` can be a
placeholder for the first deploy; you'll fix it in §12 once the site is
live and you know its final URL.

```env
NODE_ENV=production
DATABASE_URL=postgresql://...from §2...
AUTH_SECRET=...from §3.3...
NEXT_PUBLIC_SITE_URL=https://placeholder.local
```

Test the DB connection from your laptop *now*, before uploading
anything:

```bash
npx drizzle-kit push         # creates the 17 tables on the remote DB
node scripts/seed.mjs        # optional — seeds demo content
```

If both succeed silently, your connection string is correct and the DB
is reachable from the public internet. If `drizzle-kit push` hangs or
errors, fix the URI *now* — it's ten times easier to debug from your
laptop than from inside a Passenger log.

---

## 4. DreamHost panel tour — what you'll actually click

The panel is at **`panel.dreamhost.com`**. Once logged in, the left
sidebar has ~15 sections. You'll touch six of them. Here's what each
looks like and what it's for, so the words in §5 and §6 aren't
abstract.

| Section | Icon looks like | What it does | Touch it when… |
|---|---|---|---|
| **Home** | house | Dashboard, recent tickets, plan summary | Never, really. |
| **Users** | person | Unix accounts, SSH keys, panel users | §5.1 (create app user), §3.2 (SSH key) |
| **Domains** | globe | Add / edit / delete domains, DNS, Passenger toggle, SSL | §5.2 (enable Passenger), §7 (DNS) |
| **Mail** | envelope | Mailboxes, forwarding, MX records | §8 (contact-form SMTP) |
| **Goodies** | star | Cron jobs, Htaccess/WebDAV, block spam | §9 (cron) |
| **Billing** | card | Invoices, plan changes | when you upgrade |

Two things the panel does *automatically* that catch people out:

- **DNS propagation** after adding a domain takes 1–60 minutes. Don't
  refresh every 30 seconds; go make tea.
- **Let's Encrypt SSL** is provisioned in the background after you add
  a domain with the "Secure this domain with Let's Encrypt" box
  ticked. It can take up to an hour. Until then, `https://` will
  error; `http://` works. Don't panic.

---

## 5. Shared + Passenger — the full path, A to Z

This is the path for Shared Starter / Shared Unlimited plans where
§1.1 confirmed Passenger is present. Budget an hour the first time,
fifteen minutes for every deploy after.

### 5.1 Create a dedicated Unix user

Don't run the app under your main DreamHost user. Mixing the app's
files with your personal mail/web folders makes cleanup painful and
leaks permissions in weird ways.

1. Panel → **Users → Manage Users → Add New User**.
2. Form fields:
   - **User name**: `apkvault` (lowercase, no spaces; this becomes
     `/home/apkvault/`).
   - **Email**: any address you read.
   - **Shell**: pick **`/bin/bash`** from the dropdown. *Not*
     `/bin/false`, *not* `/usr/libexec/sftp-server`. Bash is what lets
     you SSH in and run `npm`.
   - **Domain**: pick the domain you'll run the site on. This ties the
     user to a web root at `/home/apkvault/<domain>/`.
   - **Password**: let the panel generate one; save it in your password
     manager even though you'll mostly use SSH keys.
3. Submit. DreamHost provisions the Unix account in **2–5 minutes**.
   Don't try to SSH in before then; you'll get "permission denied"
   and assume something's broken.

> 🔧 **UNDER THE HOOD** — Passenger runs your Node process *as this
> Unix user*. File ownership, env-var visibility, log paths, cron
> context — all derive from it. A dedicated user is a one-time
> five-minute cost that pays for itself the first time you want to
> delete the app without nuking your email.

### 5.2 Add (or edit) the domain with Passenger enabled

1. Panel → **Domains → Manage Domains**.
2. If the domain isn't added yet: **Add a Domain** → enter
   `apks.example.com` → assign it to the `apkvault` user you just
   created → tick **"Secure this domain with Let's Encrypt"** → tick
   **"Passenger Node.js"** in the *Web options* section → **Add**.
3. If the domain already exists: click the **pencil (Edit)** on its
   row → scroll to *Web options* → tick **Passenger Node.js** →
   **Save**. If the section doesn't exist, see §1.1.
4. Note the **web root directory** the panel shows (usually
   `/home/apkvault/apks.example.com/`). That's where code goes.

### 5.3 First SSH session

```bash
ssh apkvault@apks.example.com
# or, if DreamHost gave you a different SSH host:
# ssh apkvault@ssh.yourdomain.com
pwd                # /home/apkvault
ls -la             # you should see apks.example.com/, Maildir/, etc.
```

If this fails with "permission denied (publickey)", your SSH key isn't
attached to the `apkvault` user. Panel → **Users → SSH Keys** → make
sure the key is associated with *this* user, not just your main user.

### 5.4 Install Node 20 via nvm

DreamHost's system Node is often v14 or v16 — too old for Next.js 16.
Install your own:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc

nvm install 20
nvm alias default 20
node -v            # v20.x.x
npm  -v            # 10.x
```

Now the critical bit: Passenger spawns your app in a **non-interactive
non-login shell**, which does *not* source `~/.bashrc`. It does source
`~/.profile` (or `~/.bash_profile`). Add the nvm path to **both** so
Passenger sees the right Node:

```bash
LINE='export PATH="$HOME/.nvm/versions/node/$(cat $HOME/.nvm/alias/default 2>/dev/null)/bin:$PATH"'
grep -qF '.nvm/versions/node' ~/.profile    || echo "$LINE" >> ~/.profile
grep -qF '.nvm/versions/node' ~/.bashrc     || echo "$LINE" >> ~/.bashrc
source ~/.profile
which node         # MUST print /home/apkvault/.nvm/versions/node/v20.../bin/node
                   # If it prints /usr/bin/node, Passenger will use the wrong one.
```

### 5.5 Upload the project (rsync — preferred)

From your laptop, in the project root:

```bash
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.vercel' \
  --exclude 'public/uploads' \
  --exclude 'deploy/' \
  ./ apkvault@apks.example.com:~/apks.example.com/
```

What each exclude is doing, because people delete the wrong things:

| Exclude | Why |
|---|---|
| `node_modules` | Rebuilt on server; uploading is slow and can carry wrong-OS native binaries. |
| `.next` | Rebuilt on server (or uploaded prebuilt — §5.9). Stale caches cause weird 500s. |
| `.git` | Huge, server doesn't need it. |
| `.env`, `.env.local` | **Secrets stay on the server.** Uploading them over rsync is a leak vector and overwrites the server's values. |
| `.vercel` | Vercel CLI state; meaningless on DreamHost. |
| `public/uploads` | Runtime-writable folder. `--delete` would wipe user uploads on every deploy. |
| `deploy/` | Docs and helper scripts; not needed at runtime. |

### 5.6 Upload via SFTP (if you hate the terminal)

FileZilla / Transmit / Cyberduck settings:

- **Host**: `apks.example.com` (or the SSH hostname DreamHost gave you)
- **Port**: 22
- **Protocol**: SFTP (not FTP, not FTPS)
- **User**: `apkvault`
- **Auth**: SSH key (point at `~/.ssh/id_ed25519`) or password
- **Remote dir**: `/home/apkvault/apks.example.com/`

Drag the project contents in, *skipping* the same folders as the rsync
exclude list. FileZilla lets you set "skip these filenames" under
*Settings → Transfers → Filter*.

### 5.7 `npm install` on shared — surviving the memory wall

Shared accounts have a per-process memory cap (usually 1–2 GB; varies
by plan). A cold `npm install` on a Next.js project briefly spikes
above that and the kernel OOM-kills it, leaving a half-written
`node_modules` that subsequent installs can't heal.

**Tier 1 — try the normal command first:**

```bash
cd ~/apks.example.com
npm install --omit=dev
```

If it finishes with `added N packages` and no `Killed` message, great,
skip to §5.8.

**Tier 2 — if it died, retry with throttled concurrency:**

```bash
rm -rf node_modules package-lock.json
npm install --omit=dev --maxsockets=1 --fetch-retries=5 --fetch-retry-mintimeout=20000
```

`--maxsockets=1` serialises downloads so the npm process's RSS stays
low. Slower, but it finishes.

**Tier 3 — if even that OOMs, install in chunks:**

```bash
rm -rf node_modules
mkdir -p node_modules
# install the big natives first, in isolation
npm install --omit=dev --no-save sharp bcryptjs
# then the rest
npm install --omit=dev --maxsockets=1
```

**Tier 4 — give up on server-side install; prebuild locally** (§5.9).

> 🧯 **RESCUE** — If you see `Killed` in the output, *always* `rm -rf
> node_modules` before retrying. A half-written tree poisons future
> installs in ways that look like random module errors.

### 5.8 `npm run build` on shared

```bash
npm run build
```

Next's build also spikes memory. Same escalation ladder applies:

**Tier 1** — plain `npm run build`. Works on Unlimited plans most of
the time.

**Tier 2** — limit Next's worker count:

```bash
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--max-old-space-size=1536" npm run build
```

**Tier 3** — prebuild locally and upload `.next/` (§5.9).

A successful build ends with `✓ Compiled successfully` and creates a
`.next/` directory roughly 100–400 MB in size.

### 5.9 The prebuild-locally rescue path

When the shared box simply can't build, build on your laptop and
upload the artifact. **Caveat**: the local Node major version must
match the server's (both v20, or both v22). `.next/` contains compiled
server bundles keyed to the Node ABI.

```bash
# laptop
nvm use 20                   # match the server
rm -rf .next
npm run build

rsync -avz --delete \
  --exclude 'node_modules' --exclude '.git' --exclude '.env' \
  --exclude 'public/uploads' \
  ./ apkvault@apks.example.com:~/apks.example.com/

# server — install prod deps without running any postinstall scripts
# (postinstalls sometimes try to recompile natives for the wrong arch)
ssh apkvault@apks.example.com 'cd ~/apks.example.com && npm install --omit=dev --ignore-scripts'
```

If a dependency *needs* a native build on Linux (rare; `sharp` and
`bcrypt` usually have prebuilt binaries), install just that one on the
server:

```bash
ssh apkvault@apks.example.com 'cd ~/apks.example.com && npm install --omit=dev sharp'
```

### 5.10 Write `.env` on the server

```bash
cd ~/apks.example.com
nano .env          # or vim, mcedit, ed, whatever you suffer with
```

Paste exactly (no quotes around values unless the value contains
spaces, which none of these do):

```env
NODE_ENV=production
DATABASE_URL=postgresql://...from §2...
AUTH_SECRET=...from §3.3...
NEXT_PUBLIC_SITE_URL=https://apks.example.com
```

Save (`Ctrl+O`, `Enter`, `Ctrl+X` in nano). Lock it down:

```bash
chmod 600 .env
ls -la .env        # should show -rw-------  1 apkvault apkvault
```

> ⚠️ **STOP** — If `ls -la` shows the file is world-readable
> (`-rw-r--r--`), your `DATABASE_URL` and `AUTH_SECRET` are exposed to
> every other user on the shared box. Shared hosting is
> multi-tenant; treat it that way. `chmod 600` is not optional.

### 5.11 Drop in the Passenger entry file

The project ships `deploy/app.js` — a 25-line loader that boots Next
in production mode on whatever port Passenger injects via
`process.env.PORT`. Copy it to the app root as `app.js` (Passenger's
default entry-point name):

```bash
cp deploy/app.js ./app.js
chmod 644 app.js
```

What each line of `app.js` does, because you'll be tempted to edit it
(don't):

```js
process.env.NODE_ENV = process.env.NODE_ENV || "production";
// ↑ belt-and-suspenders; .env already sets it, but if Passenger ever
//   spawns the app without loading .env, this keeps Next in prod mode.

const http = require("http");
const path = require("path");
const PORT = process.env.PORT || 3000;
// ↑ Passenger sets PORT to a random high port and proxies to it.
//   Hardcoding 3000 here would conflict on shared boxes running
//   multiple Passenger apps.

const dir = path.resolve(__dirname);
const next = require(path.join(dir, "node_modules", "next"));
const app = next({ dev: false, dir });
const handle = app.getRequestHandler();
// ↑ standard Next custom-server bootstrap. dev:false is load-bearing;
//   dev:true would try to watch files and crash under Passenger.

app.prepare().then(() => {
  http.createServer((req, res) => handle(req, res)).listen(PORT);
});
// ↑ plain http server; Passenger speaks HTTP to it. No HTTPS here —
//   Apache terminates TLS in front of Passenger on shared hosting.
```

### 5.12 The `tmp/restart.txt` ritual

Passenger watches one file: `<app-root>/tmp/restart.txt`. Every time
its mtime changes, Passenger gracefully drains in-flight requests and
spawns fresh workers. This is how you reload after a deploy, an
env-var change, or a code push. Memorise the command:

```bash
mkdir -p ~/apks.example.com/tmp
touch ~/apks.example.com/tmp/restart.txt
```

Aliases worth adding to `~/.bashrc`:

```bash
alias avk-restart='touch ~/apks.example.com/tmp/restart.txt && echo "restarting…"'
alias avk-log='tail -f ~/logs/apks.example.com/passenger.log 2>/dev/null || tail -f ~/logs/passenger.*.log'
```

### 5.13 First request — what to tail, what to expect

Open two SSH sessions. In one:

```bash
avk-log
```

In the other, leave the terminal alone and open
`https://apks.example.com` in a browser. **The first request takes
5–30 seconds.** Passenger is cold-starting Node, Node is loading
`.next/`, the instrumentation hook is opening a DB connection, running
migrations, and seeding demo content. All of that happens before the
first byte of HTML goes out.

In the log you want to see, in roughly this order:

```
App 12345 stdout: [bootstrap] database ready in 4127ms (seeded demo content)
[ N 2026-… ] Passenger: spawning worker for app apks.example.com (production)
```

If you see those two lines, the deploy worked. If you see a stack
trace instead, jump to §19 with the exact error message.

### 5.14 Confirm with the health probe + admin login

```bash
curl -sS https://apks.example.com/api/health
# expect: {"ok":true}
```

Then in the browser: `https://apks.example.com/admin/login` → log in
with `admin@apkvault.com` / `admin123` → **immediately** go to *Admin
→ Users → edit admin → change password*. The default creds are
public; leaving them is a compromise waiting to happen.

### 5.15 `.htaccess` extras for the Apache layer

On shared, Apache sits in front of Passenger. You can use `.htaccess`
in the web root for things that don't need Node: long-lived caching
on static assets, www ↔ apex redirects, blocking nosy bots. Drop this
into `~/apks.example.com/.htaccess` (create if missing):

```apache
# --- long cache on Next's hashed static bundles (filenames change on rebuild) ---
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css                  "access plus 1 year"
  ExpiresByType application/javascript    "access plus 1 year"
  ExpiresByType image/webp                "access plus 6 months"
  ExpiresByType image/png                 "access plus 6 months"
  ExpiresByType image/jpeg                "access plus 6 months"
  ExpiresByType image/svg+xml             "access plus 6 months"
  ExpiresByType font/woff2                "access plus 1 year"
</IfModule>

# --- uploads: immutable, 30 days ---
<IfModule mod_expires.c>
  <FilesMatch "^/uploads/">
    ExpiresDefault "access plus 30 days"
  </FilesMatch>
</IfModule>

# --- www → apex (pick ONE direction; comment the other out) ---
# RewriteEngine On
# RewriteCond %{HTTP_HOST} ^www\.([a-z0-9.-]+)$ [NC]
# RewriteRule ^(.*)$ https://%1/$1 [R=301,L]

# --- block a few aggressive scrapers that hammer /wp-login etc. ---
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^wp-(admin|login|content) - [F,L]
  RewriteRule ^\.env - [F,L]
  RewriteRule ^\.git - [F,L]
</IfModule>

# --- gzip ---
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>
```

> 🔧 **UNDER THE HOOD** — Passenger apps on DreamHost run under Apache's
> `mod_passenger`. `.htaccess` directives for *rewrites that hit the
> Node app* get evaluated by Apache first; if a rule matches and
> rewrites to a file that doesn't exist on disk, Apache falls through
> to Passenger. If a rule rewrites to a file that *does* exist (like
> `/uploads/foo.png`), Apache serves it directly — which is exactly
> what you want for cache headers to apply without Node in the loop.

### 5.16 Shared-only gotchas — the ones that aren't in §19 yet

- **"500 Internal Server Error" with an empty body on the very first
  hit after deploy**: almost always Passenger still spinning up. Wait
  30 s, refresh. If it persists, check `passenger.log`.
- **Disk quota exceeded during build**: shared plans have byte *and*
  inode quotas. `node_modules` on a Next app is ~30k inodes. Run
  `npm prune --omit=dev` after every build, and delete
  `.next/cache/` periodically.
- **"Passenger encountered the following error: Could not spawn
  process"**: usually means `app.js` threw on load. Run
  `node app.js` manually in the app dir to see the stack trace
  without Passenger's wrapping.
- **Email from the contact form bounces**: shared accounts share IP
  reputation with every other tenant. If your mail's going to spam,
  it's not your fault; route mail through a transactional provider
  (Resend, Postmark, Mailgun) instead of DreamHost's SMTP. §8.5.
- **Cron jobs don't see `node`**: cron runs with a near-empty PATH.
  Use the full path: `/home/apkvault/.nvm/versions/node/v20.*/bin/node
  /home/apkvault/apks.example.com/scripts/foo.mjs`.

---

## 6. VPS / Dedicated / DreamCompute — the root path

Root access changes everything. Forget Passenger. You run Next as a
**systemd service** behind **nginx**, with **Let's Encrypt** via
**certbot**. It's actually simpler than §5 once the box is set up,
because you're not fighting a multi-tenant control panel.

### 6.1 Pick the OS

At provisioning, choose **Ubuntu 24.04 LTS** (or 22.04 if 24.04 isn't
offered yet on your plan). Avoid CentOS / Rocky / Alma unless you
already know them; all the commands below are Debian-flavoured.

### 6.2 First ten minutes as root

```bash
# update + the essentials
apt update && apt upgrade -y
apt install -y curl git ca-certificates gnupg ufw fail2ban nginx unzip

# firewall: SSH + HTTP + HTTPS only
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status verbose         # sanity check

# fail2ban: defaults are fine for SSH
systemctl enable --now fail2ban

# create a sudo user so you stop living as root
adduser deploy
usermod -aG sudo deploy
# copy your SSH key across
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# now lock root out of SSH (do this ONLY after confirming `ssh deploy@…` works)
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd
```

From here on, `ssh deploy@your-vps-ip` and `sudo …` when you need
root.

### 6.3 Node 20 from NodeSource

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

### 6.4 App user + directory

```bash
sudo useradd -m -s /bin/bash apkvault
sudo mkdir -p /srv/apkvault
sudo chown apkvault:apkvault /srv/apkvault
```

### 6.5 Upload (from your laptop)

```bash
rsync -avz --delete \
  --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  --exclude '.env' --exclude '.env.local' --exclude 'public/uploads' \
  ./ apkvault@your-vps-ip:/srv/apkvault/
```

If `rsync` complains about permissions, you uploaded as the wrong
user; `sudo chown -R apkvault:apkvault /srv/apkvault` and retry.

### 6.6 Install + build (VPS RAM is fine — no tricks)

```bash
ssh apkvault@your-vps-ip
cd /srv/apkvault
npm install --omit=dev
npm run build
```

A 1 GB VPS builds Next in ~90 s. A 2 GB box in ~45 s. No OOM dances.

### 6.7 `.env`

```bash
nano /srv/apkvault/.env
# paste the four vars from §3.5
chmod 600 /srv/apkvault/.env
```

### 6.8 systemd unit — annotated

`sudo nano /etc/systemd/system/apkvault.service`:

```ini
[Unit]
Description=APKVault Next.js app
After=network.target postgresql.service     # postgresql.service only if self-hosted DB
# ↑ ordering hint; doesn't create a hard dependency

[Service]
Type=simple
User=apkvault
Group=apkvault
WorkingDirectory=/srv/apkvault
# ↑ the app reads .next/ and public/ relative to this dir

Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/srv/apkvault/.env
# ↑ systemd loads the file and injects each KEY=VALUE as an env var.
#   The file MUST be chmod 600 and owned by apkvault, or systemd
#   refuses to start the unit (with a clear error in journalctl).

ExecStart=/usr/bin/node /srv/apkvault/node_modules/next/dist/bin/next start -p 3000
# ↑ call next's binary directly; don't go through `npm start` — npm
#   adds ~80 MB of RSS for no reason and complicates signal handling.

Restart=always
RestartSec=3
# ↑ if the process crashes, systemd brings it back in 3 s. Your
#   uptime monitor should still alert on repeated restarts.

StandardOutput=append:/var/log/apkvault/stdout.log
StandardError=append:/var/log/apkvault/stderr.log
# ↑ separate files so a noisy stdout doesn't bury stack traces.

# --- hardening: every line below is a tiny wall against a compromised app ---
NoNewPrivileges=true          # the process can't gain privs via setuid binaries
PrivateTmp=true               # its /tmp is a private mount namespace
ProtectSystem=full            # /usr, /boot, /efi are read-only to the app
ProtectHome=read-only         # /home/* is read-only (your .env is in /srv anyway)
ReadWritePaths=/srv/apkvault/public/uploads
# ↑ the ONLY writable path the app needs at runtime. Everything else
#   is read-only, which limits blast radius if a dep gets owned.

[Install]
WantedBy=multi-user.target
```

Enable + start:

```bash
sudo mkdir -p /var/log/apkvault
sudo chown apkvault:apkvault /var/log/apkvault
sudo systemctl daemon-reload
sudo systemctl enable --now apkvault
sudo systemctl status apkvault       # want: active (running)
sudo journalctl -u apkvault -f       # live log stream; Ctrl+C to detach
```

### 6.9 nginx server block — annotated

`sudo nano /etc/nginx/sites-available/apkvault`:

```nginx
# --- plain-HTTP block: just redirects to HTTPS after certbot runs ---
server {
    listen 80;
    listen [::]:80;
    server_name apks.example.com www.apks.example.com;

    # certbot's HTTP-01 challenge needs this path served as static files
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# --- HTTPS block: the real one ---
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name apks.example.com www.apkvault.com;   # ⚠ fix the second name to your www domain

    # certbot fills these in after the first run
    ssl_certificate     /etc/letsencrypt/live/apks.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/apks.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    # HSTS — tell browsers to never talk to us over HTTP again.
    # Only enable AFTER you're sure HTTPS works; it's sticky for 6 months.
    add_header Strict-Transport-Security "max-age=15768000; includeSubDomains" always;

    # Request body ceiling for admin uploads (icons mostly; APKs should
    # go via external URLs on Vercel-style hosts, but VPS can take them)
    client_max_body_size 50M;

    # Don't let slow clients hold a worker forever
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;

    # --- Next.js itself ---
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # These five headers are load-bearing. Without them the app
        # sees the wrong host / proto and sets cookies incorrectly.
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;

        # WebSocket support (Next HMR in dev, harmless in prod)
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";

        # Don't buffer responses; stream them
        proxy_buffering off;
    }

    # --- serve uploads straight from disk; Node never sees them ---
    location /uploads/ {
        alias /srv/apkvault/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # --- Next's hashed static bundles: 1-year cache, they're content-addressed ---
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # --- images and fonts: 6 months ---
    location ~* \.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|eot)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 6M;
        add_header Cache-Control "public";
        access_log off;
    }

    # --- deny a few things that should never be public ---
    location ~ /\.(env|git|next|vercel) { deny all; return 404; }
}
```

> 🪤 **TRAP** — That second `server_name` in the HTTPS block in the
> snippet above has a typo on purpose (`www.apkvault.com` instead of
> `www.apks.example.com`) to make you read it. Fix it before saving.
> I've seen this exact typo ship to production twice.

Enable + test + reload:

```bash
sudo ln -s /etc/nginx/sites-available/apkvault /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default        # remove the welcome page
sudo nginx -t                                       # syntax check; MUST say "syntax is ok"
sudo systemctl reload nginx
```

### 6.10 certbot + auto-renew

```bash
sudo apt install -y certbot python3-certbot-nginx

# first-time: get the cert AND let certbot edit the nginx file to wire it up
sudo certbot --nginx -d apks.example.com -d www.apks.example.com
# answer the email + ToS prompts; pick "Redirect" when asked

# verify auto-renewal timer is installed
sudo systemctl list-timers | grep certbot
# should show: certbot.timer   …   activates next…

# dry-run the renewal to be sure it'll actually work in 60 days
sudo certbot renew --dry-run
```

### 6.11 Multi-site on one VPS

Running this alongside another Node app on the same box: give each a
different port (3000, 3001, …) and a different systemd unit, then add
another `server { … }` block to nginx with its own `server_name` and
`proxy_pass http://127.0.0.1:3001;`. Certbot handles multiple domains
in one invocation: `certbot --nginx -d a.com -d b.com -d c.com`.

### 6.12 Optional: Node cluster mode for multi-core

A single `next start` process uses one CPU core. On a 4-core VPS
you're leaving 75% of the box idle. Two reasonable options:

**Option A — run N systemd units behind nginx's upstream:**

```nginx
upstream apkvault {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
    keepalive 32;
}
server {
    …
    location / { proxy_pass http://apkvault; … }
}
```

with four systemd units `apkvault@1.service` … `apkvault@4.service`
using a template (`/etc/systemd/system/apkvault@.service` with
`Environment=PORT=300%i`). More moving parts; genuinely better
throughput.

**Option B — use `next start` with `--keepAliveTimeout` and let the OS
schedule threads.** Good enough up to a few hundred concurrent users.
Don't bother with cluster mode until you've measured a problem.

### 6.13 Optional: PM2 instead of systemd

You'll see tutorials recommending PM2. On a VPS where you already have
systemd, **PM2 is a worse systemd**. It adds a daemon that duplicates
systemd's job, complicates log rotation, and survives reboots via its
own fragile `pm2 startup` hook. Use systemd. The only time PM2 wins is
on shared hosting without systemd — which is §5's problem, and
Passenger already solves it.

---

## 7. DreamHost DNS & domains, in depth

### 7.1 Add a brand-new domain

Panel → **Domains → Manage Domains → Add a Domain**.

- **Domain**: `apks.example.com` (or the apex, or `www.example.com` —
  one row per hostname you want Passenger to answer for).
- **Hosting**: "Host this domain" → pick the `apkvault` user.
- **Web options**: tick **Passenger Node.js** + **Secure with Let's
  Encrypt**.
- **PHP version**: irrelevant (Passenger overrides), leave default.
- Submit.

DNS records are auto-created on DreamHost's nameservers. If your
domain's NS records point at DreamHost (the usual case when you
registered the domain with them), propagation is ~5 minutes. If your
domain's NS records point elsewhere (Cloudflare, Namecheap, etc.), you
need to add the records manually — §7.3.

### 7.2 Add a subdomain to an existing domain

Same screen. Just type `apks.example.com` in the domain field even
though `example.com` is already listed. DreamHost treats subdomains as
independent web roots.

### 7.3 Point an external domain at DreamHost

If the domain's nameservers live at Cloudflare / Namecheap / GoDaddy
and you only want DreamHost to host the *site*, add these records at
the registrar:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | (DreamHost shared IP — find it in panel → *Domains → Manage Domains → your domain → DNS details*) | 3600 |
| A | `www` | (same IP) | 3600 |
| CNAME | (any other subdomain) | `apks.example.com` | 3600 |

Or, simpler, change the domain's NS records at the registrar to
DreamHost's nameservers (shown in the panel under *Domains →
Registrations*). Then DreamHost manages the whole zone.

> 🎯 **DECISION** — If you're already using Cloudflare for DNS + WAF +
> CDN, keep NS at Cloudflare and add the A records pointing at
> DreamHost. If you don't have an opinion, move NS to DreamHost — one
> less place to keep in sync.

### 7.4 Force HTTPS + HSTS via the panel

On shared, the panel has two relevant checkboxes when you edit a
domain:

- **"Secure this domain with a free Let's Encrypt SSL certificate"** —
  tick. Without it, no cert, no HTTPS.
- **"Force HTTPS"** (some panel versions) — tick. Adds a server-level
  301 from `http://` to `https://` so you don't have to do it in
  `.htaccess`.

On VPS, both are handled by §6.9 + §6.10 (certbot writes the redirect
for you).

### 7.5 When the cert is automatic vs when you click

- **Shared, new domain, box ticked at creation**: auto-provisioned
  within 60 minutes. No click needed.
- **Shared, existing domain, box ticked later**: panel shows
  "Certificate pending" for up to an hour; refresh, don't re-tick.
- **VPS**: never automatic; you run `certbot` once, then it
  auto-renews via the timer.

### 7.6 Wildcard certs

Shared: not included on cheap plans; DreamHost sells them as an add-on
(~$30/yr). On VPS: `certbot certonly --manual --preferred-challenges
dns -d "*.example.com" -d example.com` — requires adding a TXT record
at the registrar each renewal, *or* using the
`certbot-dns-cloudflare` / `certbot-dns-route53` plugin for automatic
DNS-01.

---

## 8. Email via DreamHost

The contact / request-a-game / report-broken-link forms **do not send
email by default**. They store submissions in the DB (Admin → Inbox).
That's deliberate — shared-IP mail reputation is a coin flip, and a
coin-flip contact form is worse than no contact form. If you *want*
email notifications too, point the app at SMTP.

### 8.1 Create a mailbox

Panel → **Mail → Manage Addresses → Add New Address**.

- **Address**: `contact@apks.example.com` (or `noreply@`, or
  `hello@` — pick one and stick with it).
- **Mailbox**: create a new mailbox (not a forwarder).
- **Password**: strong, unique, password-managered.

### 8.2 SMTP settings for the app

Add to `/srv/apkvault/.env` (or `~/apks.example.com/.env`):

```env
SMTP_HOST=mail.apks.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contact@apks.example.com
SMTP_PASS=the-mailbox-password
SMTP_FROM="APKVault <contact@apks.example.com>"
```

Restart the app (`touch tmp/restart.txt` on shared, `sudo systemctl
restart apkvault` on VPS).

### 8.3 SPF / DKIM / DMARC — what's already set

DreamHost auto-provisions **SPF** and **DKIM** for every mailbox on a
domain they host. You can verify by sending a test mail to
`check-auth@verifier.port25.com` or using
[Gmail's "show original"](https://support.google.com/mail/answer/22454?hl=en).

**DMARC** is *not* auto-provisioned. Add this TXT record at your DNS
provider (start permissive; tighten after a week of clean reports):

```
_dmarc.apks.example.com.   TXT   "v=DMARC1; p=none; rua=mailto:you@example.com"
```

After a week of `p=none` with no legitimate mail failing, bump to
`p=quarantine`, then `p=reject`.

### 8.4 Test send

Easiest test: submit the contact form on your own site with your own
email address. The message should land in Inbox (admin) *and* in your
mailbox (SMTP). If only the admin side works, SMTP creds are wrong;
check `journalctl -u apkvault` (VPS) or `passenger.log` (shared) for
the exact SMTP error.

### 8.5 If DreamHost's shared IP is on a blacklist

It happens. Shared IPs inherit the reputation of every tenant. If your
outbound mail is going to spam or bouncing with `550 … blocked`, you
have two exits:

1. **Route mail through a transactional provider**: Resend (free 100
   emails/day), Postmark ($10/mo for 10k), Mailgun (free 100/day).
   Change `SMTP_HOST` etc. to theirs. Deliverability is dramatically
   better because you get a dedicated sending IP or a well-managed
   shared pool.
2. **Ask DreamHost support to check the IP** — they'll sometimes
   rotate you to a cleaner one, no guarantees.

---

## 9. Cron — panel vs crontab

### 9.1 Shared: the Goodies → Cron Jobs screen

Panel → **Goodies → Cron Jobs → Add a New Cron Job**.

- **Command**: the full command, with absolute paths. Cron's PATH is
  empty; nothing is where you expect.
- **When**: pick from the dropdown or use "custom" for raw cron
  syntax.
- **Email output to**: your address, so failures don't go to
  `/dev/null`.

Example — nightly JSON backup of the app's data via the admin API
(assuming you've stored a long-lived session cookie in
`~/.av_session`):

```
0 4 * * * /usr/bin/curl -sS -b /home/apkvault/.av_session -o /home/apkvault/backups/apkvault-$(date +\%F).json https://apks.example.com/api/admin/backup
```

(The `\%` is cron syntax — a bare `%` in a cron command is treated as
a newline.)

### 9.2 VPS: `crontab -e` as the app user

```bash
sudo -u apkvault crontab -e
# pick nano when asked
```

Paste:

```cron
# m h dom mon dow   command
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# nightly app-level backup
0 4 * * *  /usr/bin/curl -sS -b /srv/apkvault/.av_session -o /srv/apkvault/backups/apkvault-$(date +\%F).json https://apks.example.com/api/admin/backup

# if self-hosted Postgres: nightly pg_dump with 7-day retention
0 3 * * *  /usr/bin/pg_dump -Fc apkvault > /srv/apkvault/backups/db-$(date +\%F).dump && /bin/ls -t /srv/apkvault/backups/db-*.dump | /usr/bin/tail -n +8 | /usr/bin/xargs -r /bin/rm

# weekly log rotation safety net (logrotate usually handles this)
0 5 * * 0  /usr/bin/find /var/log/apkvault -name '*.log' -size +100M -exec gzip {} \;
```

### 9.3 Useful recipes

| What | Schedule | Why |
|---|---|---|
| IndexNow ping after new publishes | every 6 h | tells Bing / Yandex to re-crawl without waiting for sitemap poll |
| `pg_dump` rotation (self-hosted) | daily 03:00 | your only line of defence against "oops I deleted the table" |
| App-level JSON backup | daily 04:00 | survives a total DB loss; restorable from the admin panel |
| Log gzip for files > 100 MB | weekly | prevents a chatty dep from eating the disk |
| Cert expiry alert | daily | `certbot certificates | grep -A1 "apks.example.com" | grep "Expiry"` piped to mail |

---

## 10. File permissions — the reference card

Wrong permissions are the #2 cause of "it worked yesterday" on
DreamHost (after env-var typos). Here's exactly what each path should
look like on the server.

| Path | chmod | chown | Why |
|---|---|---|---|
| `.env` | `600` | `apkvault:apkvault` | Secrets. World-readable = leaked to other tenants on shared. |
| `app.js` | `644` | `apkvault:apkvault` | Readable by Passenger (runs as you, but Apache reads it too on some configs). |
| `package.json`, `package-lock.json` | `644` | `apkvault:apkvault` | Read-only at runtime. |
| `node_modules/` (tree) | dirs `755`, files `644` | `apkvault:apkvault` | npm sets this; don't touch. |
| `.next/` (tree) | dirs `755`, files `644` | `apkvault:apkvault` | Build output; same. |
| `.next/cache/` | `755` | `apkvault:apkvault` | Next writes here at runtime; needs write. |
| `public/` (tree) | dirs `755`, files `644` | `apkvault:apkvault` | Static assets; readable by Apache + Node. |
| `public/uploads/` | `755` | `apkvault:apkvault` | Runtime-writable for admin uploads. On VPS the systemd unit's `ReadWritePaths` enforces this is the *only* writable path. |
| `tmp/` | `755` | `apkvault:apkvault` | Passenger's restart sentinel lives here. |
| `tmp/restart.txt` | `644` | `apkvault:apkvault` | `touch`ed on every deploy. |
| `/var/log/apkvault/` (VPS) | `755` | `apkvault:apkvault` | systemd's `StandardOutput=append:` needs the dir writable by the app user. |
| `/srv/apkvault/` (VPS top dir) | `755` | `apkvault:apkvault` | Readable by nginx (for the `/uploads/` alias) and by the app. |

Quick audit:

```bash
# shared
find ~/apks.example.com -maxdepth 2 -name '.env' -exec ls -la {} \;
# expect: -rw------- 1 apkvault apkvault … .env

# VPS
sudo find /srv/apkvault -maxdepth 2 -name '.env' -exec stat -c '%a %U:%G %n' {} \;
# expect: 600 apkvault:apkvault /srv/apkvault/.env
```

---

## 11. Backups — three layers, in detail

A site with one backup layer has zero backup layers. Backups fail
silently; you only find out when you need them. Aim for two layers
minimum, three if the site makes money.

### 11.1 DreamHost's own snapshots

- **Shared**: weekly server-level snapshots, kept ~7 days. You don't
  see them in the panel. To restore, **open a support ticket** —
  there's no self-service UI. Response time: a few hours on
  business-day chat, up to 24 h on ticket.
- **VPS**: block-level snapshots *if* you enabled them at
  provisioning (it's a checkbox; easy to miss). If enabled, you can
  self-restore from the panel in ~10 minutes. If not enabled, you
  have nothing at this layer.
- **Dedicated**: depends on the SKU; some include daily snapshots,
  some don't. Read your plan's spec sheet.

> 🪤 **TRAP** — DreamHost's shared snapshots do *not* include your
> external DB (Neon / Supabase / etc.). They only cover files on the
> web server. If you wipe your Neon project, DreamHost's snapshot
> won't save you.

### 11.2 DB-provider backups

- **Neon**: point-in-time recovery on paid plans; free tier gets
  daily snapshots with 1-day retention (check current terms — they
  tighten occasionally).
- **Supabase**: daily automated backups, 7-day retention on free,
  longer on paid. Restore from the dashboard in ~5 minutes.
- **Railway / Fly / Aiven**: similar; check each provider's
  "Backups" page.
- **Self-hosted**: *you* are the provider. §11.3.

### 11.3 Self-hosted `pg_dump` rotation + off-box copy

The cron recipe from §9.3 keeps 7 dailies on the VPS. That's not
enough — if the VPS disk dies, the backups die with it. Add a second
copy off-box. Cheapest options:

- **Backblaze B2**: free 10 GB, $0.005/GB/mo after. A 50 MB daily
  dump costs ~$0.003/month to store.
- **Cloudflare R2**: free 10 GB, $0.015/GB/mo, *zero egress fees* —
  great if you ever need to download a backup in a hurry.
- **AWS S3 Glacier**: dirt cheap, slow retrieval. Good for "keep 1
  year of monthlies just in case."
- **A home NAS / another VPS**: `rsync` over SSH.

Example — nightly push to B2 using the official CLI:

```bash
# install once
curl -sL https://github.com/Backblaze/B2_Command_Line_Tool/releases/latest/download/b2-linux -o /usr/local/bin/b2
chmod +x /usr/local/bin/b2
b2 authorize-account "$B2_KEY_ID" "$B2_APP_KEY"

# in the cron job, after pg_dump
b2 upload-file --quiet my-bucket /srv/apkvault/backups/db-$(date +%F).dump db-$(date +%F).dump
```

### 11.4 App-level JSON export

Admin → Settings → Advanced → **Download backup**. Exports every
table as a single JSON file. Do this monthly; store the file
somewhere that *isn't* the server (Dropbox, Google Drive, an
encrypted USB stick in a drawer). It's your "the DB and the VPS both
exploded at the same time" insurance.

### 11.5 The restore drill — do it once before you need it

A backup you've never restored is a hope, not a backup. Once, on a
quiet weekend:

1. Spin up a throwaway VPS or a local Docker Postgres.
2. Restore the latest `pg_dump` into it.
3. Point a local `.env` at it, run the app, click around the admin.
4. Confirm games, posts, settings, users all came back.
5. Tear it down.

Takes 20 minutes. Catches the "the dump was actually empty because
the cron's PATH was wrong" class of bug *before* 3 AM on a Tuesday.

---

## 12. Updating and rolling back

### 12.1 Shared update ritual

```bash
# laptop
rsync -avz --delete \
  --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  --exclude '.env' --exclude 'public/uploads' \
  ./ apkvault@apks.example.com:~/apks.example.com/

ssh apkvault@apks.example.com 'bash -lc "
  cd ~/apks.example.com &&
  npm install --omit=dev --silent &&
  npm run build --silent &&
  touch tmp/restart.txt &&
  echo done
"'
```

### 12.2 VPS update ritual — `deploy.sh`

Save this on your laptop as `~/deploy.sh`, `chmod +x`:

```bash
#!/usr/bin/env bash
set -euo pipefail
HOST="${1:?usage: deploy.sh user@vps-ip}"
APP_DIR=/srv/apkvault

echo "→ syncing code"
rsync -avz --delete \
  --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  --exclude '.env' --exclude 'public/uploads' \
  ./ "$HOST:$APP_DIR/"

echo "→ install + build + restart on server"
ssh "$HOST" "bash -lc '
  set -euo pipefail
  cd $APP_DIR
  # snapshot the current build for rollback
  [ -d .next ] && rm -rf .next.prev && mv .next .next.prev
  npm install --omit=dev --silent
  npm run build --silent
  sudo systemctl restart apkvault
  sleep 2
  if ! curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
    echo \"✗ health check failed; rolling back\"
    rm -rf .next
    mv .next.prev .next
    sudo systemctl restart apkvault
    exit 1
  fi
  rm -rf .next.prev
  echo ✓ deployed
'"
```

Usage: `~/deploy.sh apkvault@your-vps-ip`. The script auto-rolls-back
if the new build's health check fails within 2 seconds of restart.

### 12.3 Zero-downtime on VPS

`systemctl restart` is *not* zero-downtime — there's a ~1–3 s window
where the port isn't listening and nginx returns 502. For a content
site that's fine; users retry. If you truly need zero-downtime, run
two systemd units on ports 3000 + 3001 behind an nginx upstream
(§6.12 Option A), deploy to the inactive one, then swap the upstream
with `nginx -s reload`. Overkill for 99% of catalog sites.

### 12.4 Rollback procedure

**Shared**: keep the previous `.next/` one level up before each
deploy; on trouble, `mv .next .next.bad && mv .next.prev .next &&
touch tmp/restart.txt`.

**VPS**: the `deploy.sh` above handles the common case automatically.
For a manual rollback: `ssh … 'cd /srv/apkvault && rm -rf .next && mv
.next.prev .next && sudo systemctl restart apkvault'`.

### 12.5 Migrating the DB between providers

Moving from Neon to Supabase, or self-hosted to Railway, etc.:

```bash
# dump from the old provider
pg_dump -Fc "$OLD_DATABASE_URL" -f db.dump

# restore into the new provider (empty DB)
pg_restore -d "$NEW_DATABASE_URL" --no-owner --no-privileges db.dump

# update .env on the server, restart the app
```

The app's schema is standard Postgres; no Drizzle-specific weirdness
survives the round-trip. `--no-owner --no-privileges` avoids errors
when the user names differ between providers.

---

## 13. Performance tuning

### 13.1 Passenger pool tuning on shared

Limited knobs, but a few exist via `.htaccess` or per-user config
files. The most useful:

```apache
# in .htaccess at the app root (shared only)
PassengerMinInstances 1
PassengerMaxPoolSize 4
PassengerPoolIdleTime 300
```

`MinInstances 1` keeps one worker warm so the first visitor after a
quiet period doesn't pay the cold-start tax. `MaxPoolSize 4` caps
memory use. `PoolIdleTime 300` kills idle workers after 5 minutes to
free RAM for other tenants. **Not all shared plans honour these
directives** — if Passenger ignores them, you'll see no effect and no
error.

### 13.2 systemd + Node cluster on VPS

Covered in §6.12. The single biggest win on a multi-core VPS.

### 13.3 nginx static caching + gzip/brotli

Already in §6.9. To add Brotli on VPS:

```bash
sudo apt install -y libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static
# in the http {} block of /etc/nginx/nginx.conf:
#   brotli on;
#   brotli_comp_level 6;
#   brotli_types text/css application/javascript application/json image/svg+xml font/woff2;
sudo nginx -t && sudo systemctl reload nginx
```

Brotli shaves ~15% off gzip for text assets. Worth the one-line
install.

### 13.4 Images — next/image + external CDN

The app uses `next/image` where it can, which gives you WebP/AVIF
transcoding + lazy loading + size attributes for free. On DreamHost
shared, the image optimiser runs inside your Node process — fine for
modest traffic, a CPU hog at scale. On VPS, same story.

If image delivery becomes a bottleneck, put **Cloudflare** in front
(§13.5) and let their image CDN cache the optimised variants at the
edge.

### 13.5 Cloudflare in front of DreamHost — yes, no, how

**Yes, if** you want: free CDN, DDoS protection, image optimisation,
brotli-at-edge, automatic HTTP/3.

**No, if** you want the simplest possible stack and your traffic is
under ~10k visits/day. Cloudflare adds a layer that can mask origin
errors in confusing ways ("why is my admin cookie not setting?" →
because Cloudflare's "Always Use HTTPS" + "Automatic HTTPS Rewrites"
are fighting your app's cookie logic).

**How**: sign up at Cloudflare, change the domain's NS records at the
registrar to Cloudflare's, add an A record pointing at DreamHost's
IP, set SSL mode to **"Full (strict)"** (not "Flexible" — Flexible
breaks cookie `Secure` flags and causes the exact blank-admin bug
we fixed in this codebase). Purge cache after every deploy via the
API or the dashboard.

---

## 14. Security hardening — the fifteen-minute pass

Tick each one. Each has a one-line *why*.

- [ ] `chmod 600 .env` — other tenants on shared can read world-readable files.
- [ ] Default admin password changed on first login — the defaults are in this doc and on GitHub.
- [ ] `AUTH_SECRET` is 32+ random bytes, not "my-site-123" — weak secret = forged cookies.
- [ ] SSH: keys only, no password auth — password auth gets brute-forced within hours of opening a VPS.
- [ ] SSH: no root login — one compromised key shouldn't be game over.
- [ ] VPS: `ufw` enabled with only 22/80/443 — every open port is a future CVE.
- [ ] VPS: `fail2ban` running — bans brute-force IPs after 5 failures.
- [ ] VPS: systemd hardening lines from §6.8 — limits blast radius of a compromised dep.
- [ ] HTTPS everywhere, HSTS on — cookies without `Secure` get stripped in previews and modern browsers.
- [ ] `NEXT_PUBLIC_SITE_URL` matches the real domain — wrong value leaks the canonical URL to a placeholder in sitemaps and OG tags.
- [ ] Admin panel not indexed — confirm `robots.txt` disallows `/admin` (the app ships this default; verify after deploy).
- [ ] `public/uploads/` is the only runtime-writable path — limits what an RCE in a dep can touch.
- [ ] Node updated to current LTS quarterly — `nvm install --lts` on shared; `apt upgrade nodejs` on VPS.
- [ ] DB password rotated yearly — and immediately if anyone with access leaves.
- [ ] `AUTH_SECRET` rotated every ~6 months — logs everyone out, which is the point.

---

## 15. Logs & observability

### 15.1 Where logs live

| Plan | Path(s) |
|---|---|
| Shared | `~/logs/<domain>/passenger.log`, `error.log`, `access.log`. Sometimes `~/.passenger/standalone.*.log`. |
| VPS — app | `/var/log/apkvault/stdout.log`, `/var/log/apkvault/stderr.log`, plus `journalctl -u apkvault` |
| VPS — nginx | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |
| VPS — ssh | `/var/log/auth.log` |
| VPS — certbot | `/var/log/letsencrypt/letsencrypt.log` |

### 15.2 logrotate config for VPS

`/etc/logrotate.d/apkvault`:

```
/var/log/apkvault/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
    su apkvault apkvault
}
```

`copytruncate` is important: the running Node process holds the file
descriptor open, so a normal "move + signal" rotation would lose
lines. `copytruncate` copies the current contents to the rotated
file, then truncates the original in place — no signal needed.

### 15.3 `/api/health` as your uptime check

The endpoint is read-only — it never writes to the database. It
returns `{"ok":true}` when the DB is reachable and core tables are
present, and `{"ok":false}` with a 503 status if a table is missing or
the DB is unreachable. Point any uptime monitor at it directly; a 503
here means "go look," not "the app is fixing it for you" — if tables
are genuinely missing, run `npm run db:migrate` explicitly.

### 15.4 Uptime monitor setup

[UptimeRobot](https://uptimerobot.com) — free, 50 monitors, 5-min
interval. Add an "HTTP(s)" monitor pointing at
`https://apks.example.com/api/health`, keyword `ok`, alert on
missing keyword or non-2xx. Wire notifications to email + Telegram
(the app already has a Telegram button; reuse the channel).

[Better Stack](https://betterstack.com) — free tier, nicer UI,
includes an on-call schedule. Worth it once the site matters.

### 15.5 Optional: error tracking

[Sentry](https://sentry.io) free tier or self-hosted
[GlitchTip](https://glitchtip.com). Wire it into `next.config.ts`:

```ts
// next.config.ts
const nextConfig = {
  // …
  sentry: { /* if using @sentry/nextjs */ },
};
```

Or, lighter, just grep the logs:

```bash
# on the VPS, live tail of errors only
journalctl -u apkvault -f | grep -iE 'error|exception|fail' --color=always
```

---

## 16. Migration cutover from another host

Moving from Vercel / Hostinger / Bluehost / a friend's Raspberry Pi
to DreamHost without downtime:

### 16.1 48 hours before

Lower the DNS TTL on every record you'll change to **300** (5 min) at
the current DNS provider. Old TTLs can be 24 h; if you don't lower
them first, the cutover takes a day to propagate instead of ten
minutes.

### 16.2 24 hours before

Deploy the app to DreamHost on a **temporary hostname** — e.g.
`staging.apks.example.com` (a subdomain that doesn't conflict with
the live site). Smoke-test it end-to-end: homepage, a game page,
login, admin dashboard, contact form submission. Fix any issues
*before* the cutover window.

If you're also moving the DB, do the initial `pg_dump` / `pg_restore`
now, while the live site is still writing to the old DB. You'll do a
second, smaller "delta" dump at cutover time.

### 16.3 Cutover window (pick a quiet hour)

1. Put the live site in maintenance mode (Admin → Settings → Advanced
   → Maintenance toggle). This stops writes to the old DB.
2. Final delta `pg_dump` / `pg_restore` into the new DB.
3. Update DNS: change the A / CNAME records to point at DreamHost.
4. Wait for TTL (5 min if you did §16.1).
5. Hit `https://apks.example.com/api/health` from three different
   networks (your phone on LTE, a friend's Wi-Fi, a web-based
   checker). All should return 200.
6. Turn maintenance mode off.
7. Watch logs + uptime monitor for 30 minutes.

### 16.4 Post-cutover watch list

- 404 rate on the new host — did any URLs change? Check nginx /
  Apache access log: `awk '$9==404 {print $7}' access.log | sort |
  uniq -c | sort -rn | head`.
- 500 rate — `awk '$9==500' error.log | tail -50`.
- Mail deliverability — send yourself a test from the contact form.
- Search Console — re-submit the sitemap; coverage report will flag
  any canonical-URL mismatches within 24 h.

Keep the old host alive for 7 days as a fallback. Cancel after.

---

## 17. DreamHost support — how to use it well

### 17.1 Chat vs ticket, response times

- **Live chat** (panel → *Support → Contact Support → Chat*): fastest
  path. Business-hours response ~5 min; off-hours can be 30+ min or
  "chat unavailable, please ticket".
- **Ticket**: 2–8 h on shared; 1–4 h on VPS / Dedicated.
- **Phone**: VPS / Dedicated only, and the number is in the panel
  under *Support*. Shared plans don't get phone.

### 17.2 The ticket template that gets a fast answer

Support's first reply is almost always "please provide more
information". Pre-empt it:

```
Subject: Passenger app returning 502 on apks.example.com

Plan: Shared Unlimited, user apkvault
Domain: apks.example.com
When it started: 2026-01-15 ~14:30 UTC
What I changed right before: pushed commit abc1234 which added a new
  dependency "foo"; ran `npm install --omit=dev && npm run build &&
  touch tmp/restart.txt`.

What I see:
  • https://apks.example.com returns 502 Bad Gateway
  • https://apks.example.com/api/health times out
  • /home/apkvault/logs/apks.example.com/passenger.log tail:
    [paste 30 lines here]

What I've already tried:
  • touch tmp/restart.txt — no change
  • node app.js run manually — prints "Error: cannot find module 'foo'"
  • npm install foo --omit=dev — succeeded, but 502 persists

Question: is there a Passenger-level cache I need to clear, or is
the install incomplete?
```

A ticket like that gets a one-reply fix. A ticket that says "my site
is down please help" gets three rounds of "can you share the error
log?" before anyone looks at it.

### 17.3 What they CAN fix vs CAN'T

**Can**: restart Passenger on their side, check Apache config,
provision SSL, rotate a shared IP if it's blacklisted, restore from
their weekly snapshot, fix panel bugs.

**Can't**: debug your Node code, tune your DB queries, fix a
misconfigured `.env`, read your `node_modules` to figure out why a
dep is broken, override plan-level resource limits on shared.

### 17.4 Status page

**`status.dreamhost.com`** — subscribe to the RSS or email feed. When
something's on fire, the status page usually knows before Twitter
does.

---

## 18. Legal / AUP / content policy

Short version: this app is an APK catalog for skill-gaming apps.
DreamHost's AUP prohibits a few categories; skill-gaming-with-disclaimer
is generally fine; real-money-gambling-without-license is not.

### 18.1 What the app already does right

The seed content includes a **Disclaimer** page (`/page/disclaimer`)
that states: the site is independent, not affiliated with any gaming
company; users must be 18+; financial risk warning; play responsibly.
**Keep that page.** It's the difference between "informational
catalog" and "unlicensed gambling affiliate" in most jurisdictions'
eyes, and DreamHost's abuse team reads it the same way.

### 18.2 What would get you suspended

- Hosting the actual real-money gambling *platform* (the app where
  money changes hands) without a licence in the jurisdiction you
  operate from. The catalog site that *links* to licensed apps is a
  different legal animal in most places, but check with a lawyer if
  you're unsure.
- Copyright-infringing APK redistribution. The seed content's
  download links point to `/uploads/sample-game.apk` (a placeholder);
  in production, link to the official developer's download page or
  host files you have the right to distribute. The DMCA page
  (`/page/dmca`) is there for a reason — if a takedown notice
  arrives, respond within 48 h or DreamHost will suspend the domain
  first and ask later.
- Adult content, malware distribution, phishing — the usual AUP
  stuff. Not relevant to this app, listed for completeness.

### 18.3 GDPR / privacy

The site collects email (contact form, newsletter), name (contact
form, reviews), and IP (logs). The seed **Privacy Policy** page
covers the basics. If you run ads via Google AdSense, you also need
a cookie-consent banner for EU visitors — the app ships one
(`src/components/cookie-consent.tsx`); enable it in Admin → Settings
→ Social Links → "Cookie consent banner".

---

## 19. Troubleshooting matrix — thirty entries

The first ten are the ones you'll actually hit. The rest are the
ones you'll hit at 3 AM six months from now and be grateful this
table exists.

| # | Symptom | Most likely cause | Fix |
|---|---|---|---|
| 1 | `500 Internal Server Error`, empty body | `.env` missing or unreadable | `ls -la .env`; should be `-rw-------`; `chmod 600 .env` |
| 2 | Passenger log: `Cannot find module 'next'` | `node_modules` incomplete | `rm -rf node_modules package-lock.json && npm install --omit=dev --maxsockets=1` |
| 3 | Passenger log: `node: not found` | Passenger using system Node, not nvm's | §5.4 — fix PATH in both `~/.bashrc` *and* `~/.profile` |
| 4 | `password authentication failed for user "postgres"` | Wrong password in `DATABASE_URL`, or copied the URI with a placeholder still in it | Re-copy from the provider's dashboard; paste carefully |
| 5 | `relation "users" does not exist` on first hit | Bootstrap still running (cold start in progress) | Hit `/api/health`; wait 10 s; refresh |
| 6 | `too many connections` / `53300` | Using the direct `:5432` URL on a busy site | Switch to the pooled URL (`:6543` Supabase, `?pgbouncer=true` Neon) |
| 7 | `ECONNRESET` to DB during build | Build ran with no DB env var | Ensure `.env` exists *before* `npm run build` |
| 8 | Admin login redirects back to login (looks like nothing happened) | Old cookie from a previous `AUTH_SECRET` | Clear cookies for the domain; log in again |
| 9 | Admin login shows "Bad origin" | Old build; current code is topology-aware | Redeploy |
| 10 | `/admin` is blank after login | JS bundle 404 — usually `/_next/static/...` blocked by stale cache or wrong base path | Hard-refresh (Ctrl+Shift+R); check DevTools Network tab |
| 11 | Images 404 after deploy | `rsync --delete` wiped `public/uploads/` | Add `--exclude 'public/uploads'`; or move uploads to object storage |
| 12 | APK upload via admin returns 501 | Read-only FS (Vercel / serverless only) | On DreamHost this shouldn't happen; check ownership of `public/uploads/` |
| 13 | Build OOM-killed on shared | Memory cap | §5.9 — build locally and upload `.next/` |
| 14 | `npm install` hangs forever | Registry blocked / DNS issue on the box | `npm config set registry https://registry.npmjs.org/`; check `/etc/resolv.conf` |
| 15 | Site works on `http://` but not `https://` | Cert not provisioned | Shared: panel → *Domains → Edit → tick Let's Encrypt*. VPS: §6.10 |
| 16 | `https://` shows DreamHost's default page | DNS not pointing at this server, or domain not added to this user | Panel → *Manage Domains* → confirm the domain lists `apkvault` as its user |
| 17 | Contact form says "sent" but no mail arrives | SMTP creds wrong, or mailbox doesn't exist | Panel → *Mail → Manage Addresses*; test SMTP with `openssl s_client -connect mail.yourdomain.com:465` |
| 18 | Cron job does nothing | Cron uses a minimal PATH; `node` not found | Use the full path: `/home/apkvault/.nvm/versions/node/v20.*/bin/node …` |
| 19 | `passenger.log` empty | Logs rotated or going elsewhere | `find ~ -name '*.log' -mtime -1` to see what's been written today |
| 20 | Sudden 502 after a deploy | New build crashed on startup | `journalctl -u apkvault -n 100` (VPS) or tail `passenger.log` (shared); usually a missing env var |
| 21 | DB migrations half-applied | Deploy interrupted mid-bootstrap | Hit `/api/health` to trigger the safety-net heal; idempotent |
| 22 | "Disk quota exceeded" on shared | Inode + byte quotas; `node_modules` + `.next` can hit them | `npm prune --omit=dev`, delete old `.next/cache`, move uploads to object storage |
| 23 | First visit after deploy takes 60+ seconds | Cold start + migrations + seed on a tiny shared worker | Normal; subsequent visits are fast. If it's *every* visit, `PassengerMinInstances 1` in `.htaccess` (§13.1) |
| 24 | `EADDRINUSE :::3000` on VPS | Another process grabbed the port | `sudo ss -ltnp \| grep 3000`; kill the offender or change `PORT` in the systemd unit + nginx upstream |
| 25 | nginx 502 with "connect() failed (111: Connection refused)" | The Node app isn't running | `sudo systemctl status apkvault`; if failed, `journalctl -u apkvault -n 50` |
| 26 | nginx 403 on `/uploads/foo.png` | Permissions on the uploads dir | `sudo chmod 755 /srv/apkvault/public/uploads && sudo -u apkvault chmod -R a+r /srv/apkvault/public/uploads` |
| 27 | certbot renewal failing in the dry-run | nginx config has a syntax error or the `.well-known` path isn't served | `sudo nginx -t`; ensure the `location /.well-known/acme-challenge/` block from §6.9 is present |
| 28 | Mail from contact form going to spam | Shared IP reputation | §8.5 — route via Resend / Postmark |
| 29 | Admin file upload works locally, fails on DreamHost shared | `public/uploads/` owned by root after a bad rsync | `chown -R apkvault:apkvault ~/apks.example.com/public/uploads && chmod 755 ~/apks.example.com/public/uploads` |
| 30 | `next start` on VPS uses 100% of one core | Single-process mode on a multi-core box | §6.12 — cluster via systemd template + nginx upstream |

---

## 20. Go-live checklist — the 25-point version

Tick every box before pointing real traffic at the domain.

- [ ] §1 — plan type identified; Passenger confirmed (shared) or systemd unit running (VPS)
- [ ] §2 — Postgres provider chosen, `DATABASE_URL` tested with `psql "$DATABASE_URL"` from the server
- [ ] §3 — all prerequisites gathered (SSH key, nvm or NodeSource Node, `openssl` secret, canonical URL)
- [ ] §4 — panel tour done; you know where every screen lives
- [ ] §5 or §6 — code uploaded, deps installed, build succeeded
- [ ] §5.10 / §6.7 — `.env` present with `chmod 600`
- [ ] §5.11 / §6.8 — entry file / systemd unit in place
- [ ] §5.13 / §6.9 — first request loaded; Passenger log / journalctl shows the `[bootstrap]` line
- [ ] §5.14 — `/api/health` returns `{"ok":true}`; admin login works
- [ ] Default admin password changed
- [ ] §7 — DNS records correct; `https://` shows a valid cert (no browser warning)
- [ ] §8 — SMTP configured (or consciously skipped)
- [ ] §9 — at least one cron job running (even just the JSON backup)
- [ ] §10 — permissions audit passed
- [ ] §11 — at least two backup layers in place; one restore drill done
- [ ] §12 — `deploy.sh` (VPS) or rsync one-liner (shared) saved on your laptop
- [ ] §13 — Brotli on (VPS), PassengerMinInstances 1 (shared)
- [ ] §14 — hardening tick list complete
- [ ] §15 — uptime monitor pointing at `/api/health`, alerts wired to your phone
- [ ] `NEXT_PUBLIC_SITE_URL` set to the final domain; app rebuilt
- [ ] Google Search Console: sitemap `https://apks.example.com/sitemap.xml` submitted
- [ ] Admin → Settings: site name, logo, Telegram, social, SEO verification codes
- [ ] SSL cert auto-renewing (VPS: `systemctl list-timers \| grep certbot`; shared: panel shows "auto-renew")
- [ ] `robots.txt` disallows `/admin` (default; verify after deploy)
- [ ] Disclaimer + Privacy + DMCA + Terms pages present and linked in footer (seeded by default)

---

## Appendix A — what actually lives on the server

A clean deploy directory, shared or VPS:

```
~/apks.example.com/                  (or /srv/apkvault/)
├── app.js                           ← Passenger entry (shared only)
├── .env                             ← chmod 600; never in git
├── package.json
├── package-lock.json
├── next.config.ts
├── drizzle.config.json
├── drizzle/                         ← SQL migrations; bundled into .next on build
│   └── 0000_*.sql
├── src/                             ← source; needed at build time only
├── public/
│   ├── uploads/                     ← runtime-writable; exclude from rsync --delete
│   ├── images/
│   └── …
├── node_modules/                    ← installed on server
├── .next/                           ← built on server (or prebuilt & uploaded)
├── .next.prev/                      ← kept one deploy deep for rollback (VPS)
├── tmp/
│   └── restart.txt                  ← touch this to reload (shared/Passenger)
└── .htaccess                        ← shared only; caching + redirects
```

Everything else (`.git/`, `.vercel/`, `deploy/`, `BLUEPRINT.md`, this
file, the quickstart) can stay off the server — docs and tooling, not
runtime.

---

## Appendix B — environment variable reference

| Var | Required | Example | Notes |
|---|---|---|---|
| `NODE_ENV` | ✅ | `production` | Always `production` on the server. |
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:6543/db?sslmode=require` | Pooled variant wherever offered. |
| `AUTH_SECRET` | ✅ | 48-byte base64 string | Signs session cookies; rotate every ~6 months. |
| `NEXT_PUBLIC_SITE_URL` | ✅ | `https://apks.example.com` | No trailing slash; baked into the build. |
| `PORT` | ✅ on VPS | `3000` | Passenger sets it on shared; systemd unit sets it on VPS. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | optional | see §8 | Only if you want contact-form emails via DreamHost SMTP. |

---

## Appendix C — systemd unit (copy-paste)

```ini
[Unit]
Description=APKVault Next.js app
After=network.target

[Service]
Type=simple
User=apkvault
Group=apkvault
WorkingDirectory=/srv/apkvault
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/srv/apkvault/.env
ExecStart=/usr/bin/node /srv/apkvault/node_modules/next/dist/bin/next start -p 3000
Restart=always
RestartSec=3
StandardOutput=append:/var/log/apkvault/stdout.log
StandardError=append:/var/log/apkvault/stderr.log
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=read-only
ReadWritePaths=/srv/apkvault/public/uploads

[Install]
WantedBy=multi-user.target
```

---

## Appendix D — nginx config (copy-paste)

See §6.9. The two lines that, if missing, cause the most pain:

- `proxy_set_header X-Forwarded-Proto $scheme;` — without it the app
  thinks every request is HTTP, sets cookies without `Secure`, login
  breaks in iframe previews and triggers mixed-content warnings.
- `location /uploads/ { alias …; }` — serves user files straight from
  disk with cache headers, bypassing Node entirely. Big win on a
  content site.

---

## Appendix E — `.htaccess` for shared (copy-paste)

See §5.15. Drop it in the web root. Safe defaults; edit the www ↔
apex block to match your canonical choice.

---

## Appendix F — `deploy.sh` for VPS (copy-paste)

See §12.2. `chmod +x ~/deploy.sh`, run as `~/deploy.sh
apkvault@your-vps-ip`. Auto-rolls-back on failed health check.

---

## Appendix G — logrotate config for VPS (copy-paste)

```
/var/log/apkvault/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
    su apkvault apkvault
}
```

Save as `/etc/logrotate.d/apkvault`. Test with `sudo logrotate -d
/etc/logrotate.d/apkvault` (dry run).

---

## Appendix H — cron recipes (copy-paste)

```cron
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# nightly app-level backup
0 4 * * *  /usr/bin/curl -sS -b /srv/apkvault/.av_session -o /srv/apkvault/backups/apkvault-$(date +\%F).json https://apks.example.com/api/admin/backup

# nightly pg_dump with 7-day retention (self-hosted DB only)
0 3 * * *  /usr/bin/pg_dump -Fc apkvault > /srv/apkvault/backups/db-$(date +\%F).dump && /bin/ls -t /srv/apkvault/backups/db-*.dump | /usr/bin/tail -n +8 | /usr/bin/xargs -r /bin/rm

# weekly log gzip safety net
0 5 * * 0  /usr/bin/find /var/log/apkvault -name '*.log' -size +100M -exec gzip {} \;

# daily cert expiry alert
0 9 * * *  /usr/bin/certbot certificates 2>/dev/null | /usr/bin/grep -A1 apks.example.com | /usr/bin/grep -q "INVALID\|EXPIRED" && echo "cert problem" | /usr/bin/mail -s "cert alert" you@example.com
```

---

## Appendix I — DreamHost panel paths cheat-sheet

| I want to… | Path |
|---|---|
| Create a Unix user | Users → Manage Users → Add New User |
| Add my SSH key | Users → SSH Keys → Add Key |
| Add a domain | Domains → Manage Domains → Add a Domain |
| Enable Passenger on a domain | Domains → Manage Domains → Edit → Web options → Passenger Node.js |
| Tick Let's Encrypt | Domains → Manage Domains → Edit → Secure this domain with a free Let's Encrypt SSL certificate |
| Force HTTPS | Domains → Manage Domains → Edit → Force HTTPS (if shown) |
| Create a mailbox | Mail → Manage Addresses → Add New Address |
| Add a cron job | Goodies → Cron Jobs → Add a New Cron Job |
| See my server IP | Domains → Manage Domains → your domain → DNS details |
| View my plan | Billing → Current Plan |
| Open a ticket | Support → Contact Support |
| Live chat | Support → Contact Support → Chat |
| Status page | status.dreamhost.com (external) |

---

## Appendix J — what the safe boot sequence actually does

So you trust it when you see the log line, and you know what to do
when you don't.

On every cold start, `src/instrumentation.ts` fires once, in the
Node runtime only (not the edge runtime, not the browser). It calls
`bootstrapDatabase()`, which:

1. Reads the `drizzle/` folder (bundled into the serverless function
   on Vercel via `outputFileTracingIncludes`, present on disk on
   DreamHost).
2. Runs a schema check — a single `SELECT to_regclass(...)` query —
   and classifies the result as one of three states: **present**,
   **missing**, or **unknown** (query failed — connection blip,
   timeout, permissions). This distinction matters: only a
   *positively confirmed* "missing" leads to step 3. "Unknown" does
   nothing except log an error and stop — it never guesses.
3. If (and only if) the tables are confirmed missing, it runs every
   `drizzle/0000_*.sql` in order — creating the tables with indexes
   and foreign keys. **It never drops or truncates anything.** There
   is no code path left in this app that runs `DROP SCHEMA` or
   `TRUNCATE` automatically — an earlier version of this bootstrap
   did, and that was the cause of real data loss; it's gone now.
4. Runs `seedIfEmpty()` — checks `SELECT id FROM users LIMIT 1`; if
   zero rows, inserts the demo catalog (3 users, 4 categories, 10
   tags, 6 games with download links + FAQs + reviews + tag
   relations, 4 blog posts, 4 static pages, 1 sample newsletter
   subscriber). If users already exist, *does nothing* — your real
   data is never touched.
5. The whole thing is wrapped in a 4-attempt retry with exponential
   backoff (0 ms, 800 ms, 2.5 s, 6 s) so a slow DB handshake on a
   cold VPS doesn't fail the boot. A retry here just means "check
   again," never "wipe and rebuild."

`/api/health` is now purely read-only: it reports `{"ok":true}` or
`{"ok":false}` and never mutates the database, so your uptime
monitor polling it every 30–60s can't ever trigger a schema change.
If the schema is genuinely missing, use `npm run db:migrate`
explicitly to create it — see Appendix K.

The single log line that summarises all of this:

```
[bootstrap] database ready in 3812ms (seeded demo content)
```

Read "seeded demo content" as "this was a brand-new, empty
database." If you ever see it on a database that should already have
your real data, that's a signal to investigate — but the app itself
will not have deleted anything to get there (the instrumentation hook
doesn't re-fire on warm workers). If you *don't* see it on a fresh
deploy and the site is blank, the instrumentation hook didn't run —
hit `/api/health` to trigger the safety net, then read
`passenger.log` / `journalctl -u apkvault` for the underlying error.

---

## One last thing

DreamHost is a perfectly good home for this app — *if* you match the
plan to the workload. A hobby catalog with a few hundred visits a
day runs happily on Shared Unlimited + Neon free tier for ~$5/month.
A site with real download traffic and admin activity wants a VPS +
a $5/month managed Postgres, and at that point you've outgrown the
quirks of shared hosting entirely and §6 is actually *simpler* than
§5.

Whatever you pick, the app creates its own schema on first boot
against a genuinely empty database, so you never have to "set up the
database" by hand for a fresh install — point it at a connection
string and walk away. It will not touch an existing, non-empty
database at boot; use `npm run db:migrate` explicitly for schema
changes later. The rest is files on disk and a process that runs.

Ship it. 🚢

*Companion doc: [`dreamhost-quickstart.md`](./dreamhost-quickstart.md)
— the 15-minute, commands-only version for people who already know
what Passenger and systemd are.*
