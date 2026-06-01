#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CROWDY_ROOT="$(dirname "$ROOT")/CrowdyJS"

if [[ ! -f "$CROWDY_ROOT/package.json" ]]; then
  CROWDYJS_REPO="${CROWDYJS_REPO:-https://github.com/CrowdedKingdoms/CrowdyJS.git}"
  echo "Cloning CrowdyJS from ${CROWDYJS_REPO} (file: dependency)..."
  git clone --depth 1 "$CROWDYJS_REPO" "$CROWDY_ROOT"
fi

echo "Building CrowdyJS..."
npm ci --prefix "$CROWDY_ROOT"
npm run build --prefix "$CROWDY_ROOT"

echo "Building simple-web-demo..."
npm ci --prefix "$ROOT"
npm run build --prefix "$ROOT"
