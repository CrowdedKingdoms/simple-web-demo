import {
  BATTLE_ARENA_CENTER_X,
  BATTLE_ARENA_CENTER_Y,
  BATTLE_INITIAL_ZONE_RADIUS,
  BATTLE_MATCH_MS,
  BATTLE_MIN_ZONE_RADIUS,
} from '@/config';

export interface ZoneState {
  centerX: number;
  centerY: number;
  radius: number;
  elapsedMs: number;
  remainingMs: number;
}

/** Shared match clock — all clients shrink the zone on the same timeline. */
export function getMatchStartMs(now = Date.now()): number {
  return Math.floor(now / BATTLE_MATCH_MS) * BATTLE_MATCH_MS;
}

export function getZoneState(now = Date.now()): ZoneState {
  const start = getMatchStartMs(now);
  const elapsed = now - start;
  const t = Math.min(1, elapsed / BATTLE_MATCH_MS);
  const radius =
    BATTLE_INITIAL_ZONE_RADIUS +
    (BATTLE_MIN_ZONE_RADIUS - BATTLE_INITIAL_ZONE_RADIUS) * t;
  return {
    centerX: BATTLE_ARENA_CENTER_X,
    centerY: BATTLE_ARENA_CENTER_Y,
    radius,
    elapsedMs: elapsed,
    remainingMs: Math.max(0, BATTLE_MATCH_MS - elapsed),
  };
}

export function distanceToZoneEdge(
  x: number,
  y: number,
  zone: ZoneState,
): number {
  const dx = x - zone.centerX;
  const dy = y - zone.centerY;
  return zone.radius - Math.hypot(dx, dy);
}
