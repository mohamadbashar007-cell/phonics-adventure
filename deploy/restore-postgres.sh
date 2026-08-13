#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Usage: deploy/restore-postgres.sh path/to/backup.sql.gz"
  exit 1
fi

gunzip -c "$1" | docker compose exec -T db psql \
  -U "${POSTGRES_USER:-phonics_app}" \
  -d "${POSTGRES_DB:-phonics_adventure}"

echo "Restore completed from $1"
