#!/usr/bin/env bash
# Zero-downtime blue/green deploy, run ON THE SERVER from /opt/glasswork/infra/prod:
#   ./scripts/deploy.sh <image-tag>
# Steps: pull → migrate → start idle slot → health-check → switch Caddy → drain → stop old slot.
# If anything fails before the switch, the live slot is untouched. If the post-switch check fails, it switches back.
set -euo pipefail
cd "$(dirname "$0")/.."

TAG="${1:?usage: deploy.sh <image-tag>}"
ENV_FILE=".env.production"
[ -f "$ENV_FILE" ] || { echo "✗ $ENV_FILE missing"; exit 1; }
set -a; . "./$ENV_FILE"; set +a
: "${DOMAIN:?}" "${GHCR_OWNER:?}"
export IMAGE_TAG="$TAG" GHCR_OWNER

STATE=state
mkdir -p "$STATE/caddy"
ACTIVE="$(cat "$STATE/active_slot" 2>/dev/null || echo none)"
case "$ACTIVE" in blue) NEW=green ;; *) NEW=blue ;; esac
PREV_TAG="$(cat "$STATE/current_tag" 2>/dev/null || echo none)"
echo "▶ deploying $TAG → slot $NEW (live: $ACTIVE, previous tag: $PREV_TAG)"

compose_app() { SLOT="$1" docker compose -p "glasswork-$1" -f docker-compose.app.yml --env-file "$ENV_FILE" "${@:2}"; }

write_upstream() { # $1 = slot
  cat > "$STATE/caddy/upstreams.caddy" <<EOF
(web_upstream) {
	reverse_proxy web-$1:3000 {
		health_uri /
		health_interval 10s
		lb_try_duration 5s
	}
}
(api_upstream) {
	reverse_proxy api-$1:4000 {
		health_uri /health
		health_interval 10s
		lb_try_duration 5s
	}
}
EOF
  docker compose -p glasswork-edge -f docker-compose.edge.yml --env-file "$ENV_FILE" exec -T caddy caddy reload --config /etc/caddy/Caddyfile
}

# 0. Edge services (Caddy, Redis, ClamAV) — idempotent, never restarted by a deploy.
[ -f "$STATE/caddy/upstreams.caddy" ] || cp "$STATE/caddy/upstreams.caddy.example" "$STATE/caddy/upstreams.caddy"
SLOT="${ACTIVE/none/blue}" docker compose -p glasswork-edge -f docker-compose.edge.yml --env-file "$ENV_FILE" up -d caddy redis clamav

# 1. Pull images (fails here if the tag does not exist; nothing has changed yet).
compose_app "$NEW" pull

# 2. Migrations with the migration role. Must be backward compatible with the live version (expand/contract).
echo "▶ running migrations"
docker run --rm --network glasswork_edge -e DATABASE_URL="${DATABASE_MIGRATION_URL:-$DATABASE_URL}" \
  "ghcr.io/$GHCR_OWNER/glasswork-api:$TAG" node node_modules/@glasswork/db/dist/migrate.js

# 3. Start the idle slot and wait until healthy.
if ! compose_app "$NEW" up -d --wait --wait-timeout 180; then
  echo "✗ new slot did not become healthy; live slot untouched"
  compose_app "$NEW" logs --tail 80 || true
  compose_app "$NEW" down || true
  exit 1
fi

# 4. Worker follows the new image (jobs are durable in Redis, so a restart is safe).
SLOT="$NEW" docker compose -p glasswork-edge -f docker-compose.edge.yml --env-file "$ENV_FILE" up -d worker

# 5. Switch traffic, then verify through the public front door.
write_upstream "$NEW"
sleep 3
if ! curl -fsS --max-time 10 --resolve "api.$DOMAIN:443:127.0.0.1" "https://api.$DOMAIN/ready" >/dev/null \
  || ! curl -fsS --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" >/dev/null; then
  echo "✗ post-switch check failed; switching back"
  [ "$ACTIVE" != none ] && write_upstream "$ACTIVE"
  compose_app "$NEW" down || true
  exit 1
fi

# 6. Record state, drain the old slot, stop it.
echo "$NEW" > "$STATE/active_slot"
[ "$PREV_TAG" != "$TAG" ] && echo "$PREV_TAG" > "$STATE/previous_tag"
echo "$TAG" > "$STATE/current_tag"
if [ "$ACTIVE" != none ]; then
  echo "▶ draining $ACTIVE for 30s"
  sleep 30
  compose_app "$ACTIVE" down
fi
docker image prune -f --filter "until=168h" >/dev/null
echo "✓ $TAG is live on slot $NEW"
