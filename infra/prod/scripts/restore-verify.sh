#!/usr/bin/env bash
# Restore the newest backup into a THROWAWAY Postgres container and run sanity queries. Run nightly after backup.sh.
# Never touches the real database. Alerts via ALERT_WEBHOOK_URL on failure.
#   BACKUP_TARGET=s3 (default) | dir
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.production ] && { set -a; . ./.env.production; set +a; }
: "${BACKUP_PASSPHRASE:?}"
TARGET="${BACKUP_TARGET:-s3}"
TMP="$(mktemp -d)"; CT="gw-restore-verify-$$"
cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
notify() { [ -n "${ALERT_WEBHOOK_URL:-}" ] && curl -fsS -m 10 -X POST -H 'content-type: application/json' -d "{\"text\":\"$1\"}" "$ALERT_WEBHOOK_URL" >/dev/null || true; }
trap 'notify "❌ Glasswork restore verification FAILED"; cleanup' ERR

if [ "$TARGET" = dir ]; then
  FILE="$(ls -1t "${BACKUP_DIR:?}"/glasswork-*.sql.gz.enc | head -1)"
else
  KEY="$(docker run --rm -e AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID" -e AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY" -e AWS_DEFAULT_REGION=auto \
    amazon/aws-cli --endpoint-url "$BACKUP_S3_ENDPOINT" s3 ls "s3://$BACKUP_S3_BUCKET/db/" | awk '{print $4}' | sort | tail -1)"
  docker run --rm -v "$TMP:/b" -e AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID" -e AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY" -e AWS_DEFAULT_REGION=auto \
    amazon/aws-cli --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "s3://$BACKUP_S3_BUCKET/db/$KEY" "/b/$KEY"
  FILE="$TMP/$KEY"
fi
echo "▶ verifying $(basename "$FILE")"

docker run -d --name "$CT" -e POSTGRES_PASSWORD=verify -e POSTGRES_DB=verify postgres:17-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$CT" pg_isready -U postgres -d verify >/dev/null 2>&1 && break; sleep 1; done
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE < "$FILE" | gunzip \
  | docker exec -i "$CT" psql -U postgres -d verify -v ON_ERROR_STOP=1 -q >/dev/null

q() { docker exec "$CT" psql -U postgres -d verify -Atc "$1"; }
USERS=$(q "select count(*) from users")
MIGS=$(q "select count(*) from drizzle.__drizzle_migrations")
LEDGER=$(q "select count(*) from ledger_entries")
[ "$MIGS" -gt 0 ] || { echo "✗ no migrations recorded in restored DB"; false; }
echo "✓ restore verified: users=$USERS migrations=$MIGS ledger_entries=$LEDGER"
