#!/usr/bin/env bash
# Update the running site. Usage on the VPS:  sudo bash /srv/hirely/deploy/deploy.sh
set -euo pipefail
cd /srv/hirely
sudo -u hirely git pull --ff-only
sudo -u hirely bash -c 'cd api && npm ci && npm run build'
sudo -u hirely bash -c 'cd web && npm ci && npm run build'
systemctl restart hirely-api
sleep 2
curl -fsS http://127.0.0.1:4000/api/health && echo " <- API healthy"
