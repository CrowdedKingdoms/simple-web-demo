/** Game constants for canvas + tank demos. API URLs live in demoConfig.ts. */

/** Paint cell size in world pixels. */
export const TILE_SIZE = 8;

/** Server voxels per chunk axis. */
export const CHUNK_VOXEL_SIZE = 16;

export const ACTOR_SYNC_INTERVAL_MS = 100;
/** Tank pose sync — ~30 Hz. */
export const TANK_ACTOR_SYNC_INTERVAL_MS = 33;
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
