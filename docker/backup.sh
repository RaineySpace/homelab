#!/bin/sh
set -eu
mkdir -p /data/backups
if [ ! -f /data/app.db ]; then
  echo "app.db not found yet, skip backup"
  exit 0
fi
stamp=$(date -u +%Y%m%dT%H%M%SZ)
dest="/data/backups/app-$stamp.db"
sqlite3 /data/app.db "VACUUM INTO '$dest'"
echo "wrote $dest"
