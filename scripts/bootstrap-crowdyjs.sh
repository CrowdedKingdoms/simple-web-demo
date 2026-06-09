#!/usr/bin/env bash
# Clone + schema-sync + build CrowdyJS for fork/Netlify layouts (no monorepo required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MONOREPO_ROOT="$(dirname "$ROOT")"
CROWDY_ROOT="${MONOREPO_ROOT}/CrowdyJS"
VENDOR_SCHEMAS="${ROOT}/vendor/schemas"

install_graphql_schemas() {
  if [[ -f "${MONOREPO_ROOT}/cks-management-api/schema.gql" && -f "${MONOREPO_ROOT}/cks-game-api/schema.gql" ]]; then
    echo "Using monorepo GraphQL schemas..."
    return 0
  fi
  bash "${ROOT}/scripts/install-crowdy-schemas.sh"
}

if [[ ! -f "$CROWDY_ROOT/package.json" ]]; then
  CROWDYJS_REPO="${CROWDYJS_REPO:-https://github.com/CrowdedKingdoms/CrowdyJS.git}"
  CROWDYJS_REF="${CROWDYJS_REF:-12d5cabe58a5b1ce0ae2250123b111fb38881fe4}"
  echo "Cloning CrowdyJS from ${CROWDYJS_REPO} @ ${CROWDYJS_REF}..."
  git clone --filter=blob:none --no-checkout "$CROWDYJS_REPO" "$CROWDY_ROOT"
  git -C "$CROWDY_ROOT" checkout "$CROWDYJS_REF"
fi

install_graphql_schemas

if [[ ! -f "$CROWDY_ROOT/dist/index.js" ]]; then
  echo "Building CrowdyJS..."
  npm ci --prefix "$CROWDY_ROOT"
  npm run build --prefix "$CROWDY_ROOT"
fi
