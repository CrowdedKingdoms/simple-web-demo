/** Fixed dev-tier configuration for the collaborative canvas tutorial. */
/** Proxied by Vite (local) or Netlify `_redirects` (production). */
export const MANAGEMENT_URL =
  import.meta.env.VITE_MANAGEMENT_API_URL ?? '/mgmt-api';

/** Always set explicitly — older CrowdyJS on GitHub does not append /graphql. */
export const MANAGEMENT_GRAPHQL_URL =
  import.meta.env.VITE_MANAGEMENT_GRAPHQL_URL ??
  `${MANAGEMENT_URL.replace(/\/$/, '')}/graphql`;

export const GAME_HTTP_URL =
  import.meta.env.VITE_GAME_API_HTTP_URL ??
  'https://game.dev1.dev.cks-env.com/graphql';

export const GAME_WS_URL =
  import.meta.env.VITE_GAME_API_WS_URL ??
  'wss://game.dev1.dev.cks-env.com/graphql';

export const APP_ID = import.meta.env.VITE_APP_ID ?? '1';
export const ORG_ID = import.meta.env.VITE_ORG_ID ?? '1';

/** Paint cell size in world pixels. */
export const TILE_SIZE = 8;

/** Server voxels per chunk axis. */
export const CHUNK_VOXEL_SIZE = 16;

export const ACTOR_SYNC_INTERVAL_MS = 100;
export const ACTOR_STATE_BYTES = 96;

/** Viewport dimensions in world pixels. */
export const VIEWPORT_WIDTH = 640;
export const VIEWPORT_HEIGHT = 480;

/** Edge margin (px) before viewport scroll / push activates. */
export const VIEWPORT_EDGE_MARGIN = 24;

/** Single-player edge scroll speed (world px / frame at 60fps baseline). */
export const VIEWPORT_SCROLL_SPEED = 4;

/** Collaborative push speed multiplier. */
export const VIEWPORT_PUSH_SPEED = 3;

export const DOCS_BASE = 'https://docs.crowdedkingdoms.com/build-a-game';

export const CONFIG_DISPLAY = {
  ManagementApiUrl: MANAGEMENT_URL,
  GameApiHttpUrl: GAME_HTTP_URL,
  GameApiWsUrl: GAME_WS_URL,
  AppId: APP_ID,
  OrgId: ORG_ID,
} as const;
