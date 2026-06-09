#!/usr/bin/env bash
# Place management + game schemas where CrowdyJS sync-schema expects them (CI / fork layouts).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_ROOT="$(dirname "$ROOT")"
VENDOR="${ROOT}/vendor/schemas"
MGMT_DEST="${WORKSPACE_ROOT}/cks-management-api/schema.gql"
GAME_DEST="${WORKSPACE_ROOT}/cks-game-api/schema.gql"

if [[ ! -f "${VENDOR}/management.gql" || ! -f "${VENDOR}/game.gql" ]]; then
  echo "Missing vendor/schemas/{management,game}.gql" >&2
  exit 1
fi

mkdir -p "$(dirname "$MGMT_DEST")" "$(dirname "$GAME_DEST")"
cp "${VENDOR}/management.gql" "$MGMT_DEST"
cp "${VENDOR}/game.gql" "$GAME_DEST"
echo "Installed GraphQL schemas for CrowdyJS codegen:"
echo "  ${MGMT_DEST}"
echo "  ${GAME_DEST}"
