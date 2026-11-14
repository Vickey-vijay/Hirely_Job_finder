#!/usr/bin/env bash
# Build on your computer and put the new version live. Run from the repo root in Git Bash:
#   bash deploy/push.sh
# Change SERVER / KEY below (or set HIRELY_SERVER / HIRELY_KEY) if your server or key file changes.
set -euo pipefail
SERVER="${HIRELY_SERVER:-ubuntu@35.226.195.159}"
KEY="${HIRELY_KEY:-$HOME/.ssh/ssh-key.key}"

echo "== Test and build"
(cd api && npm test >/dev/null && npm run build)
(cd web && npm run build)

echo "== Upload"
tar czf hirely-release.tgz api/dist api/migrations api/seed api/package.json api/package-lock.json web/dist deploy
scp -q -i "$KEY" hirely-release.tgz "$SERVER:/tmp/hirely-release.tgz"
rm -f hirely-release.tgz

echo "== Install on the server"
ssh -o BatchMode=yes -i "$KEY" "$SERVER" "bash -s" <<'REMOTE'
set -e
rm -rf /tmp/hirely-release && mkdir /tmp/hirely-release && tar xzf /tmp/hirely-release.tgz -C /tmp/hirely-release
cd /tmp/hirely-release
sudo rm -rf /srv/hirely/api/dist /srv/hirely/api/migrations /srv/hirely/api/seed /srv/hirely/web/dist
sudo cp -r api/dist api/migrations api/seed api/package.json api/package-lock.json /srv/hirely/api/
sudo cp -r web/dist /srv/hirely/web/dist
sudo chown -R hirely:hirely /srv/hirely
cd /srv/hirely/api && sudo -u hirely env HOME=/srv/hirely npm ci --omit=dev --no-audit --no-fund --loglevel=error
sudo systemctl restart hirely-api
sleep 8
curl -fsS http://127.0.0.1:4100/api/health && echo " <- API healthy"
rm -rf /tmp/hirely-release /tmp/hirely-release.tgz
REMOTE
echo "Live."
