#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/phonics_adventure-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

docker compose exec -T db pg_dump \
  -U "${POSTGRES_USER:-phonics_app}" \
  -d "${POSTGRES_DB:-phonics_adventure}" \
  | gzip > "$FILE"

echo "Backup written to $FILE"
