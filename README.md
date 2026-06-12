# Simple Web Demo — Collaborative Canvas Tutorial

Interactive step-by-step tutorial for building a multiplayer pixel canvas on Crowded Kingdoms, plus a **tank arena** multiplayer demo. Each chapter adds one working piece; launch **Canvas** or **Tanks** from the config bar when your dev environment is connected.

Documentation lives in [cks-docs/docs-build-a-game](../cks-docs/docs-build-a-game/). The demo links to each doc chapter; run `npm run verify` to confirm the docs and dev-tier APIs are sufficient.

## Prerequisites

- Node.js 20+ and a modern browser
- **Monorepo checkout** (optional): fastest local dev when `CrowdyJS/` is a sibling directory
- **Fork-only checkout** (fine): `npm install` auto-clones CrowdyJS and uses vendored GraphQL schemas

## Shareable dev environment URLs

Enter your **env handle** (devbox slug), App ID, and Org ID in the top config bar, then click **Apply**. Values are encoded in the page URL:

```text
/?env=e-zt0psk82q3bi&app=1&org=1
/tanks?env=e-zt0psk82q3bi&app=1&org=1
/canvas?env=e-zt0psk82q3bi&app=1&org=1
```

Use **Copy link** to share with teammates — they land on the same dedicated dev environment without re-entering URLs.

Optional query overrides: `mgmt`, `gh` (game HTTP), `gw` (game WebSocket). By default, auth/register uses the **box-local** management API (`https://api.<env-handle>.dev.cks-env.com/graphql`) so tokens validate on that environment's game-api. Pass `?mgmt=https://api.dev.crowdedkingdoms.com/graphql` only for dedicated environments that use the shared dev management plane.

When `env` is in the URL, HTTP GraphQL calls go through a **same-origin proxy** (`/cks-proxy/mgmt` and `/cks-proxy/game`) so any devbox or dedicated environment works from localhost or a deployed demo without CORS patches. WebSockets still connect directly to `wss://game.{handle}.…`.

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

## Run locally

```bash
cd simple-web-demo
npm install          # builds ../CrowdyJS automatically on first dev/build
npm run dev
```

Open http://127.0.0.1:5180 — enter your env handle in the config bar, work through chapters 1–9, then **Launch Canvas** or **Launch Tanks**.

Local dev proxies management and game HTTP GraphQL through `/cks-proxy/*` for any `?env=` handle. Copy `.env.example` to `.env` to set a default `VITE_ENV_HANDLE` when no query params are present.

## Validate docs + APIs

The Playwright suite exercises every chapter against the live dev tier (with `?env=` query params):

```bash
npm run verify       # unit tests + e2e
npm run test:e2e     # browser tests only
```

From the docs repo you can run the same checks:

```bash
cd cks-docs
npm run demo:verify
```

## Routes

| Route | Description |
| --- | --- |
| `/` | Tutorial home + chapter list |
| `/chapter/1` … `/chapter/9` | Interactive tutorial steps |
| `/canvas` | Full collaborative paint game |
| `/tanks` | Top-down multiplayer tank arena (up to 4 players) |

## Multiplayer testing (tanks / canvas)

Open **one browser tab or window per player** with the same `?env=` and `?app=` URL. Each tab gets its own tank actor id (`sessionStorage`), so two tabs on the same app see each other. If you only see **Players 1**, hard-refresh both tabs after pulling this fix — an old shared `localStorage` tank id can linger until the tab storage is recreated.

For remote dev (Cursor SSH), use the server address (e.g. `http://40.160.10.31:5180/...`) rather than `localhost` in the embedded browser unless ports are forwarded.

## Deploy (Netlify / static fork)

Forks deploy **without** the monorepo. Netlify runs `scripts/netlify-build.sh`, which:

1. Clones CrowdyJS at a pinned commit (`CROWDYJS_REF`, overridable in Netlify env)
2. Copies `vendor/schemas/*.gql` so GraphQL codegen succeeds
3. Builds CrowdyJS, then this app

**Commit `vendor/schemas/`** when you merge updates from upstream — that is what your fork’s Netlify build uses.

Optional Netlify env vars: `CROWDYJS_REPO`, `CROWDYJS_REF`.

### Netlify build defaults

Set `VITE_ENV_HANDLE` in `netlify.toml` for the default env when users open the site without query params. Shared links with `?env=other-handle` use the same dynamic `/cks-proxy/*` Netlify function as local dev.

`Forbidden resource` in the browser console almost always means **management and game APIs point at different CKS environments**, or the app is not linked on that environment.

Confirm in the CKS console that **App 1** is linked to the environment and `runtime_status` is **active**.
