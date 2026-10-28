#!/usr/bin/env bash
# Every 5 minutes (cron): checks site, API readiness, disk, memory and queue health; posts to ALERT_WEBHOOK_URL on a
# state change only (no repeated spam). Complements an external uptime monitor (see docs/GO_LIVE.md).
set -uo pipefail
cd "$(dirname "$0")/.."
[ -f .env.production ] && { set -a; . ./.env.production; set +a; }
: "${DOMAIN:?}"
STATE=state/monitor_status
PROBLEMS=()
curl -fsS -m 10 -o /dev/null "https://$DOMAIN/" || PROBLEMS+=("site https://$DOMAIN is not responding")
curl -fsS -m 10 -o /dev/null "https://api.$DOMAIN/ready" || PROBLEMS+=("API /ready failing (database or Redis down?)")
DISK=$(df --output=pcent / | tail -1 | tr -dc '0-9'); [ "${DISK:-0}" -lt 85 ] || PROBLEMS+=("disk ${DISK}% full")
MEM=$(free | awk '/Mem:/ {printf "%d", $3/$2*100}'); [ "${MEM:-0}" -lt 92 ] || PROBLEMS+=("memory ${MEM}% used")
for c in glasswork-edge-redis-1 glasswork-edge-worker-1; do
  [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" = true ] || PROBLEMS+=("container $c is not running")
done
if [ -n "${PROBLEMS[*]:-}" ]; then NOW="DOWN: $(IFS=';'; echo "${PROBLEMS[*]}")"; else NOW="OK"; fi
PREV="$(cat "$STATE" 2>/dev/null || echo OK)"
if [ "$NOW" != "$PREV" ]; then
  echo "$NOW" > "$STATE"
  MSG="$([ "$NOW" = OK ] && echo "✅ Glasswork recovered" || echo "🚨 Glasswork $NOW")"
  [ -n "${ALERT_WEBHOOK_URL:-}" ] && curl -fsS -m 10 -X POST -H 'content-type: application/json' -d "{\"text\":\"$MSG\"}" "$ALERT_WEBHOOK_URL" >/dev/null
  echo "$(date -u +%FT%TZ) $MSG"
fi
