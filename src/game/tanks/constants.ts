export const TANK_ARENA_SIZE = 560;
export const TANK_BODY_SIZE = 36;
export const TANK_SPEED = 2.8;
/** Turn rate at the start of a steer (rad / frame @ 60fps). */
export const TANK_ROT_SPEED_MIN = 0.018;
/** Turn rate plateau after ramping (original max). */
export const TANK_ROT_SPEED_MAX = 0.055;
/** How fast turn speed ramps up per frame @ 60fps (0→1 over ~0.5s). */
export const TANK_ROT_RAMP_UP = 0.035;
/** How fast turn speed decays when keys released. */
export const TANK_ROT_RAMP_DOWN = 0.06;
export const TANK_BULLET_SPEED = 9;
export const TANK_FIRE_COOLDOWN_MS = 450;
export const TANK_MAX_HP = 100;
export const TANK_SHOT_DAMAGE = 30;
export const TANK_HIT_RADIUS = 18;
export const TANK_BULLET_RADIUS = 6;
export const TANK_MAX_PLAYERS = 4;
export const TANK_REMOTE_TIMEOUT_MS = 5_000;
export const TANK_BULLET_LIFETIME_MS = 2_000;

export const TANK_SPAWN_POINTS = [
  { x: 80, y: 80, angle: Math.PI / 4 },
  { x: TANK_ARENA_SIZE - 80, y: 80, angle: (3 * Math.PI) / 4 },
  { x: 80, y: TANK_ARENA_SIZE - 80, angle: -Math.PI / 4 },
  { x: TANK_ARENA_SIZE - 80, y: TANK_ARENA_SIZE - 80, angle: (-3 * Math.PI) / 4 },
] as const;
