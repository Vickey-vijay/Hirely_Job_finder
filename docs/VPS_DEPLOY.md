# Deploy to your VPS — step by step

Target: one Ubuntu 22.04 or 24.04 VPS running Nginx (HTTPS, serves the React app, proxies `/api`), the Node API (systemd) and PostgreSQL. Replace `app.example.com` everywhere with your real domain.

Do the steps in order. Anything marked **YOU** needs your accounts; the rest are copy-paste.

## 0. Before you touch the server (YOU)
- [ ] **Domain** bought (any registrar). Example: `hirely.in`. Use `app.hirely.in` or the root.
- [ ] **DNS A record**: `app.example.com` → your VPS public IP. Wait until `ping app.example.com` shows the IP.
- [ ] **Google OAuth client** (see `docs/GOOGLE_LOGIN.md`): add `https://app.example.com` to *Authorized JavaScript origins*.
- [ ] **SMTP account** for email codes. Free tiers work: Brevo (300/day), Amazon SES, Zoho ZeptoMail, Resend. Verify your sending domain and add the **SPF, DKIM and DMARC** DNS records the provider gives you, otherwise login emails land in spam.
- [ ] A **second secret**: generate `JWT_SECRET` on any machine with Node: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## 1. Secure the server (once)
```bash
ssh root@YOUR_VPS_IP
apt update && apt -y upgrade
adduser hirely                       # a normal user; the app never runs as root
usermod -aG sudo hirely
# copy your SSH key to the new user, then disable password login:
rsync --archive --chown=hirely:hirely ~/.ssh /home/hirely
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
apt -y install fail2ban unattended-upgrades
```
Open a **second** terminal and confirm `ssh hirely@YOUR_VPS_IP` works before closing the first one.

## 2. Install software
```bash
ssh hirely@YOUR_VPS_IP
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs nginx postgresql git certbot python3-certbot-nginx
node -v    # v22.x
```

## 3. Database
```bash
sudo -u postgres psql <<'SQL'
create user hirely with password 'CHOOSE_A_LONG_RANDOM_PASSWORD';
create database hirely owner hirely;
SQL
```
PostgreSQL listens on localhost only by default. Do **not** open port 5432 in the firewall. Tables are created automatically by the API on first start (migrations in `api/migrations`).

## 4. Get the code
```bash
sudo mkdir -p /srv/hirely && sudo chown hirely:hirely /srv/hirely
cd /srv/hirely
git clone https://github.com/Vickey-vijay/Hirely_Job_finder.git .
git checkout main        # after you merge the pull requests; until then use feat/google-login
```

## 5. Configure the API
```bash
cd /srv/hirely/api
cp .env.example .env
nano .env
```
Set:
```
DATABASE_URL=postgres://hirely:YOUR_DB_PASSWORD@localhost:5432/hirely
JWT_SECRET=<the 96-character hex string>
ALLOWED_ORIGINS=https://app.example.com
NODE_ENV=production
PORT=4000
GOOGLE_CLIENT_ID=<your client id>.apps.googleusercontent.com
SMTP_HOST=smtp-relay.brevo.com        # whatever your provider says
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="Hirely <login@example.com>"
```
`chmod 600 .env`. In production the API refuses to start if SMTP is missing, so mistakes show up immediately.

## 6. Build
```bash
cd /srv/hirely/api && npm ci && npm run build
cd /srv/hirely/web
echo "VITE_GOOGLE_CLIENT_ID=<your client id>.apps.googleusercontent.com" > .env
npm ci && npm run build            # output: /srv/hirely/web/dist
```
The web build bakes the client ID in, so rebuild after changing it.

## 7. Run the API as a service
```bash
sudo cp /srv/hirely/deploy/hirely-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hirely-api
sudo systemctl status hirely-api          # should say "active (running)"
journalctl -u hirely-api -f               # live logs; look for "migration applied" and "listening"
curl http://127.0.0.1:4000/api/health     # {"ok":true}
```

## 8. Nginx and HTTPS
```bash
sudo cp /srv/hirely/deploy/nginx-hirely.conf /etc/nginx/sites-available/hirely
sudo sed -i 's/app.example.com/YOUR.DOMAIN/g' /etc/nginx/sites-available/hirely
sudo ln -s /etc/nginx/sites-available/hirely /etc/nginx/sites-enabled/hirely
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d YOUR.DOMAIN      # adds HTTPS and auto-renewal
```
Open `https://YOUR.DOMAIN`. You should see the Hirely landing page.

## 9. Verify login end to end
1. **Email:** open the login page, enter your email, check your inbox (and spam) for the code, sign in.
2. **Google:** click *Continue with Google*. If you see "origin_mismatch", the exact `https://YOUR.DOMAIN` is missing in Google Cloud → Credentials → Authorized JavaScript origins (wait a few minutes after saving).
3. Refresh the page; you should stay signed in. Sign out and in again.
4. Check the DB: `sudo -u postgres psql hirely -c "select email, google_sub is not null as google, created_at from users;"`

## 10. Backups (do not skip)
```bash
sudo mkdir -p /var/backups/hirely && sudo chown hirely /var/backups/hirely
chmod +x /srv/hirely/deploy/backup.sh
crontab -e
# add:  0 3 * * * /srv/hirely/deploy/backup.sh >> /var/backups/hirely/backup.log 2>&1
```
This writes a compressed dump daily at 03:00 and keeps 14 days. Also copy the folder off the server weekly (another VPS, object storage, or your laptop). Test a restore once: `gunzip -c file.sql.gz | psql hirely`.

## 11. Updating later
```bash
sudo bash /srv/hirely/deploy/deploy.sh
```
Pulls, installs, builds both apps, restarts the API (migrations run on start).

## 12. Go-live checklist for login
- [ ] `NODE_ENV=production` and HTTPS working (cookies are `Secure`)
- [ ] Google consent screen moved from *Testing* to *In production* (otherwise only listed test users can sign in)
- [ ] Privacy Policy and Terms pages live and linked on the consent screen
- [ ] SPF/DKIM/DMARC passing (test by sending yourself a code and viewing "original" headers)
- [ ] Backups running and one restore tested
- [ ] `ufw status` shows only 22, 80, 443; `ss -tlnp` shows Postgres and the API on 127.0.0.1 only

## Troubleshooting
| Symptom | Fix |
|---|---|
| API won't start | `journalctl -u hirely-api -n 50`. Config errors are printed in plain words. |
| `origin_not_allowed` (403) | `ALLOWED_ORIGINS` must exactly equal the browser origin, including `https://` and no trailing slash. Restart the API. |
| Google button missing | `VITE_GOOGLE_CLIENT_ID` was empty at build time. Set it and rebuild the web app. |
| Google `origin_mismatch` | Add the exact origin in Google Cloud and wait a few minutes. |
| Email code never arrives | Check `journalctl` for "email send failed"; verify SMTP credentials and DNS records; check spam. |
| Everyone shares one rate limit | `trust proxy` is on in production; make sure Nginx sends `X-Forwarded-For` (the provided config does). |
