#!/usr/bin/env bash
# ONE-TIME server setup for Hirely on Debian/Ubuntu. Safe to run again: it skips what already exists.
# Usage on the server:  sudo bash setup-server.sh hirely.example.in
# It installs PostgreSQL (tuned for a small server), creates the database, a "hirely" system user,
# the .env file, the systemd service, the nginx site and a nightly backup. It does not touch other sites.
set -euo pipefail
DOMAIN="${1:?usage: sudo bash setup-server.sh <domain>}"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "== PostgreSQL"
if ! command -v psql >/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql
fi
PGVER=$(ls /etc/postgresql | sort -n | tail -1)
cat > "/etc/postgresql/$PGVER/main/conf.d/hirely-small.conf" <<CONF
# Small-memory settings for a 1 GB server shared with other apps. Raise shared_buffers to 128MB on 2 GB+.
listen_addresses = 'localhost'
max_connections = 20
shared_buffers = 32MB
work_mem = 2MB
maintenance_work_mem = 32MB
effective_cache_size = 128MB
wal_buffers = 1MB
max_wal_size = 256MB
CONF
systemctl restart postgresql

echo "== App user and folders"
id hirely >/dev/null 2>&1 || useradd --system --home /srv/hirely --shell /usr/sbin/nologin hirely
mkdir -p /srv/hirely/api /srv/hirely/web/dist /var/backups/hirely
chown -R hirely:hirely /srv/hirely /var/backups/hirely

echo "== Database and .env"
if [ ! -f /srv/hirely/api/.env ]; then
  DBPASS=$(openssl rand -hex 24)
  if sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='hirely'" | grep -q 1; then
    sudo -u postgres psql -q -c "alter role hirely password '$DBPASS'"
  else
    sudo -u postgres psql -q -c "create role hirely login password '$DBPASS'"
  fi
  sudo -u postgres psql -tAc "select 1 from pg_database where datname='hirely'" | grep -q 1 || sudo -u postgres createdb -O hirely hirely
  cat > /srv/hirely/api/.env <<ENV
# Hirely production settings. After any change:  sudo systemctl restart hirely-api
# Every value that is empty simply leaves that feature off until you fill it in.
NODE_ENV=production
PORT=4100
DATABASE_URL=postgres://hirely:$DBPASS@127.0.0.1:5432/hirely
JWT_SECRET=$(openssl rand -hex 48)
APP_URL=https://$DOMAIN
ALLOWED_ORIGINS=https://$DOMAIN

# Your own email(s), comma separated. These accounts see the /admin page.
ADMIN_EMAILS=

# ---- Sign-in (set at least one) ----
GOOGLE_CLIENT_ID=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Hirely <alerts@$DOMAIN>"

# ---- Payments (Razorpay). Until RAZORPAY_KEY_ID is set, ALLOW_MOCK_PAYMENTS=true gives a no-money test mode. ----
ALLOW_MOCK_PAYMENTS=true
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_PLAN_STARTER=
RAZORPAY_PLAN_PLUS=
RAZORPAY_PLAN_PRO=

# ---- WhatsApp Cloud API ----
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=$(openssl rand -hex 16)
WHATSAPP_TEMPLATE=job_digest
WHATSAPP_TEMPLATE_LANG=en

# ---- AI (Claude) for smarter scores and Pro tailored resumes ----
ANTHROPIC_API_KEY=
LLM_MODEL=claude-haiku-5-5

# ---- Adzuna India job search (free keys; the main source for non-tech jobs) ----
ADZUNA_APP_ID=
ADZUNA_APP_KEY=

# ---- Shown on the policy and contact pages ----
BUSINESS_NAME=Hirely
CONTACT_EMAIL=
BUSINESS_ADDRESS=
GRIEVANCE_NAME=
SUPPORT_UPI=
ENV
  chown hirely:hirely /srv/hirely/api/.env
  chmod 600 /srv/hirely/api/.env
else
  echo "   .env already exists, left as it is"
fi

echo "== Service"
cp "$HERE/hirely-api.service" /etc/systemd/system/hirely-api.service
systemctl daemon-reload
systemctl enable hirely-api >/dev/null 2>&1

echo "== nginx site"
if [ ! -f /etc/nginx/sites-available/hirely ]; then
  sed "s/__DOMAIN__/$DOMAIN/" "$HERE/nginx-hirely.conf" > /etc/nginx/sites-available/hirely
  ln -sf /etc/nginx/sites-available/hirely /etc/nginx/sites-enabled/hirely
fi
nginx -t && systemctl reload nginx

echo "== Nightly backup (02:40)"
install -m 755 "$HERE/backup.sh" /srv/hirely/backup.sh
echo "40 2 * * * hirely /srv/hirely/backup.sh >> /var/backups/hirely/backup.log 2>&1" > /etc/cron.d/hirely-backup

echo "Done. Next: upload the app with deploy/push.sh, then:  sudo certbot --nginx -d $DOMAIN"
