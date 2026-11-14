# Server deployment

The server is already set up. Day-to-day instructions (settings file, restart, logs, publishing a change, backups, moving to your own domain, upgrading the server) are in [`START_HERE.md`](START_HERE.md) sections 3, 4, 11 and 12.

## What was done on the server (15 Nov 2026)
- `deploy/setup-server.sh hirely.35-226-195-159.sslip.io` installed PostgreSQL 15 with small-memory settings, created the `hirely` database and system user, wrote `/srv/hirely/api/.env`, installed the `hirely-api` service, added the nginx site `hirely`, and scheduled the nightly backup.
- `deploy/push.sh` uploaded and started the app (port 4100, only reachable through nginx).
- `certbot --nginx` issued the HTTPS certificate; it renews automatically.
- The other sites on this server (Signal Hub, Prop Desk, revertx-signal) were not changed.

## Moving to a new server later
1. Create a Debian 12 or Ubuntu VM, install Node 22, nginx and certbot (`sudo apt install -y nginx certbot python3-certbot-nginx`, Node from nodesource).
2. Copy the `deploy/` folder to it and run `sudo bash deploy/setup-server.sh yourdomain.in`.
3. Copy your old `/srv/hirely/api/.env` values into the new file (keep the new `DATABASE_URL`).
4. Restore the latest database backup (START_HERE section 12).
5. On your PC: `HIRELY_SERVER=user@new-ip bash deploy/push.sh`.
6. Point the domain's A record at the new IP, then `sudo certbot --nginx -d yourdomain.in`.
