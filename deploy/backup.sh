#!/usr/bin/env bash
# Daily PostgreSQL backup, keeps 14 days. Run as user "hirely" from cron.
set -euo pipefail
DIR=/var/backups/hirely
mkdir -p "$DIR"
FILE="$DIR/hirely-$(date +%F-%H%M).sql.gz"
# Reads DATABASE_URL from the API .env (the file is chmod 600 and owned by hirely)
URL=$(grep '^DATABASE_URL=' /srv/hirely/api/.env | cut -d= -f2-)
pg_dump "$URL" | gzip > "$FILE"
find "$DIR" -name 'hirely-*.sql.gz' -mtime +14 -delete
echo "$(date -Is) backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
