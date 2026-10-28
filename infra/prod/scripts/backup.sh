#!/usr/bin/env bash
# Nightly logical backup: pg_dump → gzip → AES-256 encrypt → upload to the BACKUP bucket (separate from user files).
# Managed-Postgres PITR is the first line of defence; this is the independent second copy.
#   BACKUP_TARGET=s3 (default) | dir   (dir = write to $BACKUP_DIR, used for local tests)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.production ] && { set -a; . ./.env.production; set +a; }
: "${DATABASE_URL:?}" "${BACKUP_PASSPHRASE:?}"
TARGET="${BACKUP_TARGET:-s3}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="glasswork-$STAMP.sql.gz.enc"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
PG_IMAGE="postgres:17-alpine"

notify() { [ -n "${ALERT_WEBHOOK_URL:-}" ] && curl -fsS -m 10 -X POST -H 'content-type: application/json' -d "{\"text\":\"$1\"}" "$ALERT_WEBHOOK_URL" >/dev/null || true; }
trap 'notify "❌ Glasswork backup FAILED ($STAMP)"' ERR

docker run --rm --network "${DOCKER_NETWORK:-host}" "$PG_IMAGE" pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" \
  | gzip -9 | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE > "$TMP/$NAME"
SIZE=$(wc -c < "$TMP/$NAME")
[ "$SIZE" -gt 1024 ] || { echo "✗ backup suspiciously small ($SIZE bytes)"; false; }

if [ "$TARGET" = dir ]; then
  mkdir -p "${BACKUP_DIR:?}"; cp "$TMP/$NAME" "$BACKUP_DIR/$NAME"
else
  : "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_ACCESS_KEY_ID:?}" "${BACKUP_S3_SECRET_ACCESS_KEY:?}"
  docker run --rm -v "$TMP:/b:ro" -e AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID" -e AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY" \
    -e AWS_DEFAULT_REGION=auto amazon/aws-cli --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "/b/$NAME" "s3://$BACKUP_S3_BUCKET/db/$NAME"
fi
echo "✓ backup $NAME ($SIZE bytes)"
