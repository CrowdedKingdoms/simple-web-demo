# Simple Web Demo — Collaborative Canvas Tutorial

Interactive step-by-step tutorial for building a multiplayer pixel canvas on Crowded Kingdoms. Each chapter adds one working piece; at the end `/play` is the full collaborative game.

Documentation lives in [cks-docs/docs-build-a-game](../cks-docs/docs-build-a-game/). The demo links to each doc chapter; run `npm run verify` to confirm the docs and dev-tier APIs are sufficient.

## Prerequisites

- Node.js 20+ and a modern browser
- **Monorepo checkout** (optional): fastest local dev when `CrowdyJS/` is a sibling directory
- **Fork-only checkout** (fine): `npm install` auto-clones CrowdyJS and uses vendored GraphQL schemas

## Layout options

**Monorepo (CKS internal)**

```
cks-project-root/
  CrowdyJS/           ← SDK (file: dependency)
  simple-web-demo/    ← this app
  cks-docs/           ← tutorial docs
```

**Fork / standalone** — only `simple-web-demo/` is required. Netlify and `npm install` use:

- `vendor/schemas/` — committed copies of management + game API GraphQL SDL
- `scripts/bootstrap-crowdyjs.sh` — clones a pinned CrowdyJS commit and builds the SDK

## Dev tier config

```text
ManagementApiUrl=https://api.dev.crowdedkingdoms.com   (proxied as /mgmt-api in local dev)
GameApiHttpUrl=https://game.dev1.dev.cks-env.com/graphql
GameApiWsUrl=wss://game.dev1.dev.cks-env.com/graphql
AppId=1
OrgId=1
```

## Run locally

```bash
cd simple-web-demo
npm install          # builds ../CrowdyJS automatically on first dev/build
npm run dev
```

Open http://127.0.0.1:5173 — work through chapters 1–9, then `/play` for the full game.

Local dev proxies the Management API through `/mgmt-api` to avoid CORS (same pattern as [edge-of-epoch](../edge-of-epoch/)).

Optional: copy `.env.example` to `.env` to override endpoints.

## Validate docs + APIs

The Playwright suite exercises every chapter against the live dev tier:

```bash
npm run verify       # unit tests + e2e
npm run test:e2e     # browser tests only
```

From the docs repo you can run the same checks:

```bash
cd cks-docs
npm run demo:verify
```

## Chapter routes

| Chapter | Demo | Doc |
| --- | --- | --- |
| 1 — Project setup | `/chapter/1` | [01-project-setup](https://docs.crowdedkingdoms.com/build-a-game/01-project-setup) |
| 2 — Auto guest auth | `/chapter/2` | [02-auto-guest-auth](https://docs.crowdedkingdoms.com/build-a-game/02-auto-guest-auth) |
| 3 — Connect & bootstrap | `/chapter/3` | [03-connect-and-bootstrap](https://docs.crowdedkingdoms.com/build-a-game/03-connect-and-bootstrap) |
| 4 — Canvas coordinates | `/chapter/4` | [04-canvas-coordinates](https://docs.crowdedkingdoms.com/build-a-game/04-canvas-coordinates) |
| 5 — Actor presence | `/chapter/5` | [05-actor-presence](https://docs.crowdedkingdoms.com/build-a-game/05-actor-presence) |
| 6 — Painting voxels | `/chapter/6` | [06-painting-voxels](https://docs.crowdedkingdoms.com/build-a-game/06-painting-voxels) |
| 7 — Viewport edge scroll | `/chapter/7` | [07-viewport-edge-scroll](https://docs.crowdedkingdoms.com/build-a-game/07-viewport-edge-scroll) |
| 8 — Collaborative viewport | `/chapter/8` | [08-collaborative-viewport](https://docs.crowdedkingdoms.com/build-a-game/08-collaborative-viewport) |
| 9 — Full game | `/chapter/9` | [09-full-game](https://docs.crowdedkingdoms.com/build-a-game/09-full-game) |
| Play | `/play` | — |

## Deploy (Netlify / static fork)

Forks deploy **without** the monorepo. Netlify runs `scripts/netlify-build.sh`, which:

1. Clones CrowdyJS at a pinned commit (`CROWDYJS_REF`, overridable in Netlify env)
2. Copies `vendor/schemas/*.gql` so GraphQL codegen succeeds
3. Builds CrowdyJS, then this app

**Commit `vendor/schemas/`** when you merge updates from upstream — that is what your fork’s Netlify build uses.

CKS maintainers with the monorepo can refresh vendored schemas:

```bash
./scripts/sync-vendor-schemas.sh   # copies from ../cks-*-api/schema.gql
```

Optional Netlify env vars: `CROWDYJS_REPO`, `CROWDYJS_REF`.

### Netlify multiplayer (required env vars)

`Forbidden resource` in the browser console almost always means **management and game APIs point at different CKS environments**, or the app is not linked on that environment.

In **Site configuration → Environment variables** (scoped to **Build**), set all of these to the same devbox (from your CKS environment page):

| Variable | Example |
| --- | --- |
| `VITE_ENV_HANDLE` | `e-zt0psk82q3bi` |
| `VITE_GAME_API_HTTP_URL` | `https://game.e-zt0psk82q3bi.dev.cks-env.com/graphql` |
| `VITE_GAME_API_WS_URL` | `wss://game.e-zt0psk82q3bi.dev.cks-env.com/graphql` |
| `VITE_APP_ID` | `1` (sandbox app id from that env) |
| `VITE_ORG_ID` | `1` |

`netlify.toml` already sets `VITE_MANAGEMENT_API_URL=/mgmt-api`. The build generates `public/_redirects` so `/mgmt-api` proxies to `https://api.<VITE_ENV_HANDLE>.dev.cks-env.com`. Override with `MANAGEMENT_API_PROXY_TARGET` if needed.

After changing env vars: **Clear cache and deploy site**, then hard-refresh the browser (or clear site localStorage) so guest auth re-runs against the correct env.

Confirm in the CKS console that **App 1** is linked to the environment and `runtime_status` is **active**.

For non-Netlify static hosts, build with direct API URLs (no `/mgmt-api` proxy):

```bash
cp .env.example .env
npm run build
```

The host must either allow your origin on the dev Management API CORS list, or reverse-proxy `/mgmt-api` → `https://api.dev.crowdedkingdoms.com` (see `netlify.toml`).
