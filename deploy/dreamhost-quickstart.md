# ⚡ APKVault on DreamHost — 15-Minute Quickstart

*For people who already know what Passenger and systemd are and just
want the commands in order. If anything here doesn't match what you
see on screen, or a step errors out, jump to the matching section of
**[`dreamhost.md`](./dreamhost.md)** — the deep runbook.*

---

## Pick your path

```
   ┌──────────────────────┐         ┌──────────────────────┐
   │  Shared + Passenger  │         │  VPS / Dedicated /   │
   │  (Shared Unlimited,  │         │  DreamCompute        │
   │   some Shared        │         │  (you can sudo)      │
   │   Starter plans)     │         │                      │
   └──────────┬───────────┘         └──────────┬───────────┘
              │                                │
      follow §A below                  follow §B below
```

> 🎯 **Not sure which?** SSH in and run `sudo -v`. If it asks for a
> password and accepts it, you're on §B. If it says "you are not in
> the sudoers file", you're on §A.

---

## Prep (both paths)

Run these on your **laptop**, once:

```bash
# 1. toolchain check
node -v          # want v20+ ; install via nvm if not
npm  -v

# 2. SSH key (skip if you already have one)
ls ~/.ssh/id_ed25519.pub 2>/dev/null || ssh-keygen -t ed25519 -C "you@example.com"
cat ~/.ssh/id_ed25519.pub      # add this to DreamHost panel → Users → SSH Keys

# 3. auth secret
openssl rand -base64 48        # copy the output; you'll paste it as AUTH_SECRET

# 4. draft .env.local so the values are ready
cp .env.example .env.local
# edit .env.local and fill in DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_SITE_URL
```

Then pick a Postgres provider (3-minute signup, free tier) and grab the
**pooled** connection string:

- **Neon** — https://neon.tech → new project → Connection string → "Pooled" tab
- **Supabase** — https://supabase.com → new project → Settings → Database → "Transaction pooler" tab (port 6543)

Paste that URI as `DATABASE_URL` in `.env.local`. **Use the pooler, not
the direct one** — on Passenger the direct URI exhausts the connection
cap within an hour.

Test the string from your laptop before touching the server:

```bash
npx drizzle-kit push          # creates the 17 tables on the remote DB
```

Silent success = good. Error = fix the URI now, not after upload.

---

## §A — Shared + Passenger (8 steps)

### A1. Panel — create the app user

*Users → Manage Users → Add New User* → name `apkvault` → shell
**`/bin/bash`** → assign to your domain → save. Wait 2–5 min.

### A2. Panel — enable Passenger on the domain

*Domains → Manage Domains → your domain → Edit* → tick **Passenger
Node.js** + **Secure with Let's Encrypt** → save.

> If the Passenger toggle isn't there, your plan doesn't include it —
> go to §B (upgrade to VPS) or deploy on Vercel instead. See §1.1 of
> the runbook.

### A3. SSH in + install Node 20 via nvm

```bash
ssh apkvault@yourdomain.com

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm alias default 20

# Passenger uses a non-interactive shell; add nvm to ~/.profile too
LINE='export PATH="$HOME/.nvm/versions/node/$(cat $HOME/.nvm/alias/default 2>/dev/null)/bin:$PATH"'
grep -qF '.nvm/versions/node' ~/.profile || echo "$LINE" >> ~/.profile
grep -qF '.nvm/versions/node' ~/.bashrc  || echo "$LINE" >> ~/.bashrc
source ~/.profile
which node       # must be inside ~/.nvm/…/bin, not /usr/bin
```

### A4. Upload the project (from laptop)

```bash
rsync -avz --delete \
  --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  --exclude '.env' --exclude '.env.local' --exclude '.vercel' \
  --exclude 'public/uploads' --exclude 'deploy/' \
  ./ apkvault@yourdomain.com:~/yourdomain.com/
```

### A5. Server — install + build + write `.env`

```bash
ssh apkvault@yourdomain.com
cd ~/yourdomain.com

npm install --omit=dev                    # if OOM-killed, retry with --maxsockets=1
npm run build                             # if OOM-killed, build locally + rsync .next/

cat > .env <<EOF
NODE_ENV=production
DATABASE_URL=postgresql://…pooler URI…
AUTH_SECRET=…openssl output…
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
EOF
chmod 600 .env
```

### A6. Drop in the Passenger entry + restart sentinel

```bash
cp deploy/app.js ./app.js
mkdir -p tmp && touch tmp/restart.txt

# useful aliases for later
cat >> ~/.bashrc <<'EOF'
alias avk-restart='touch ~/yourdomain.com/tmp/restart.txt && echo restarted'
alias avk-log='tail -f ~/logs/yourdomain.com/passenger.log 2>/dev/null || tail -f ~/logs/passenger.*.log'
EOF
```

### A7. First visit + health probe

```bash
avk-log &               # watch in this session
# in a browser, open https://yourdomain.com   (first hit takes 10–30 s)
# in another terminal:
curl -sS https://yourdomain.com/api/health
# expect: {"ok":true}
```

In the log you want to see:
```
[bootstrap] database ready in …ms (seeded demo content)
```

### A8. Log in + change the default password

Browser → `https://yourdomain.com/admin/login` →
`admin@apkvault.com` / `admin123` → **Admin → Users → edit admin →
change password.**

Done. Future deploys = `rsync … && ssh … 'cd ~/yourdomain.com && npm i
--omit=dev && npm run build && touch tmp/restart.txt'`.

---

## §B — VPS / Dedicated / DreamCompute (10 steps)

### B1. As root — update + firewall + fail2ban + sudo user

```bash
apt update && apt upgrade -y
apt install -y curl git ca-certificates gnupg ufw fail2ban nginx unzip

ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
systemctl enable --now fail2ban

adduser deploy && usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys

# lock root out (only AFTER confirming `ssh deploy@…` works from another terminal)
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd
```

### B2. Install Node 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

### B3. Create the app user + dir

```bash
sudo useradd -m -s /bin/bash apkvault
sudo mkdir -p /srv/apkvault
sudo chown apkvault:apkvault /srv/apkvault
```

### B4. Upload (from laptop)

```bash
rsync -avz --delete \
  --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  --exclude '.env' --exclude '.env.local' --exclude 'public/uploads' \
  ./ apkvault@your-vps-ip:/srv/apkvault/
```

### B5. Install + build + `.env`

```bash
ssh apkvault@your-vps-ip
cd /srv/apkvault
npm install --omit=dev
npm run build

cat > .env <<EOF
NODE_ENV=production
DATABASE_URL=postgresql://…pooler URI…
AUTH_SECRET=…openssl output…
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
EOF
chmod 600 .env
```

### B6. systemd unit

```bash
sudo tee /etc/systemd/system/apkvault.service >/dev/null <<'EOF'
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
EOF

sudo mkdir -p /var/log/apkvault && sudo chown apkvault:apkvault /var/log/apkvault
sudo systemctl daemon-reload
sudo systemctl enable --now apkvault
sudo systemctl status apkvault          # want: active (running)
```

### B7. nginx server block

```bash
sudo tee /etc/nginx/sites-available/apkvault >/dev/null <<'EOF'
server {
    listen 80; listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl http2; listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=15768000; includeSubDomains" always;

    client_max_body_size 50M;
    proxy_read_timeout 120s; proxy_send_timeout 120s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_buffering off;
    }
    location /uploads/ {
        alias /srv/apkvault/public/uploads/;
        expires 30d; add_header Cache-Control "public, immutable"; access_log off;
    }
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 1y; add_header Cache-Control "public, immutable"; access_log off;
    }
    location ~ /\.(env|git|next|vercel) { deny all; return 404; }
}
EOF

sudo ln -s /etc/nginx/sites-available/apkvault /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### B8. certbot — free TLS + auto-renew

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# answer prompts; pick "Redirect" when asked
sudo certbot renew --dry-run             # confirm auto-renewal works
```

### B9. logrotate + a nightly backup cron

```bash
sudo tee /etc/logrotate.d/apkvault >/dev/null <<'EOF'
/var/log/apkvault/*.log {
    daily missingok rotate 14 compress delaycompress notifempty copytruncate
    su apkvault apkvault
}
EOF

sudo -u apkvault bash -c 'mkdir -p ~/backups && crontab -l 2>/dev/null > /tmp/c && cat >> /tmp/c <<EOF
0 4 * * * /usr/bin/curl -sS -b /srv/apkvault/.av_session -o /srv/apkvault/backups/apkvault-\$(date +\\%F).json https://yourdomain.com/api/admin/backup
EOF
crontab /tmp/c && rm /tmp/c'
```

(The `.av_session` cookie file you create once by logging in via
`curl -c /srv/apkvault/.av_session …` from the server; see §9 of the
runbook for details.)

### B10. Smoke test + change the default password

```bash
curl -sS https://yourdomain.com/api/health     # expect {"ok":true}
```

Browser → `https://yourdomain.com/admin/login` →
`admin@apkvault.com` / `admin123` → **change the password.**

Done. Save this on your laptop as `~/deploy.sh` for future deploys
(copy from §12.2 of the runbook — it includes auto-rollback on a
failed health check):

```bash
chmod +x ~/deploy.sh
~/deploy.sh apkvault@your-vps-ip
```

---

## First-visit sanity checks (both paths)

Run these in order; all should pass before you share the URL with
anyone.

```bash
URL=https://yourdomain.com

curl -sS $URL/api/health              # {"ok":true}
curl -sS -o /dev/null -w "%{http_code}\n" $URL/                            # 200
curl -sS -o /dev/null -w "%{http_code}\n" $URL/games                       # 200
curl -sS -o /dev/null -w "%{http_code}\n" $URL/game/diwa-win-apk           # 200
curl -sS -o /dev/null -w "%{http_code}\n" $URL/blog                        # 200
curl -sS -o /dev/null -w "%{http_code}\n" $URL/sitemap.xml                 # 200
curl -sS -o /dev/null -w "%{http_code}\n" $URL/admin/login                 # 200
curl -sS -I $URL | grep -i strict-transport      # want: max-age=… (VPS only; shared sets it via panel)
```

In a browser, confirm:

- [ ] Homepage loads in light theme by default
- [ ] A game page's yellow "DOWNLOAD APK" button fits inside its card on mobile width
- [ ] Telegram buttons + floating widget render in Telegram blue
- [ ] Admin login works with the default creds
- [ ] After login, the dashboard shows non-zero stats (6 games, 4 posts, …)
- [ ] The footer links to Privacy / Terms / DMCA / Disclaimer and they all 200

---

## When something breaks

Don't guess. Look up the symptom in §19 of **[`dreamhost.md`](./dreamhost.md)**
— 30 entries, each with the exact fix. The top five you'll actually hit:

| Symptom | Jump to |
|---|---|
| `500` with empty body on first hit | wait 30 s; cold start in progress |
| `Cannot find module 'next'` in Passenger log | `rm -rf node_modules && npm install --omit=dev` |
| `node: not found` in Passenger log | nvm PATH missing from `~/.profile` (§A3) |
| Admin login loops back to login | clear cookies; old `AUTH_SECRET` mismatch |
| `too many connections` from Postgres | you used the direct URI; switch to pooler |

If the symptom isn't in the matrix, hit `/api/health` — it's read-only
and returns `{"ok":true}` when the DB is reachable and the core tables
are present, `{"ok":false}` (with a 503 status) if a table is missing
or the DB is unreachable. It never modifies the database itself; if you
get `{"ok":false}` because tables are missing, run `npm run db:migrate`
explicitly.

---

## The one-paragraph mental model

DreamHost runs your code (Passenger on shared, systemd on VPS). A
free-tier Postgres provider runs your data (Neon or Supabase — pick
one, both work). The app wires them together on first request and,
if it finds a genuinely empty database, creates the schema and seeds
it — once. Your ongoing job is: edit code →
`rsync` → `npm i && npm run build` → restart (touch `restart.txt` on
shared, `systemctl restart apkvault` on VPS). Health checks are
read-only and never touch the schema; if you add new migrations
later, apply them explicitly with `npm run db:migrate` rather than
relying on a restart to do it.

That's it. Go ship. 🚢
