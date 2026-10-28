#!/usr/bin/env bash
# Roll back to the previously deployed image tag (zero downtime, same blue/green switch).
#   ./scripts/rollback.sh            # previous tag
#   ./scripts/rollback.sh <tag>      # a specific tag
# NOTE: database migrations are NOT reversed. Migrations are written expand/contract so the previous version still
# runs on the newer schema. For data problems use scripts/restore.sh (point-in-time recovery in docs/RUNBOOKS.md).
set -euo pipefail
cd "$(dirname "$0")/.."
TAG="${1:-$(cat state/previous_tag 2>/dev/null || true)}"
[ -n "$TAG" ] && [ "$TAG" != none ] || { echo "✗ no previous tag recorded; pass one explicitly"; exit 1; }
echo "▶ rolling back to $TAG"
exec ./scripts/deploy.sh "$TAG"
