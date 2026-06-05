import {
  BATTLE_ARENA_CENTER_X,
  BATTLE_ARENA_CENTER_Z,
  BATTLE_INITIAL_ZONE_RADIUS,
  BATTLE_SHIP_MAX_HP,
} from '@/config';
import type { ShipState } from '@/game/battle/shipState';

export function randomSpawn(seed: string): ShipState {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const angle = ((hash % 360) * Math.PI) / 180;
  const dist = 28 + (hash % 52);
  return {
    worldX: BATTLE_ARENA_CENTER_X + Math.cos(angle) * dist,
    worldY: ((hash >> 8) % 120) - 60,
    worldZ: BATTLE_ARENA_CENTER_Z + Math.sin(angle) * dist,
    yaw: angle + Math.PI,
    pitch: 0,
    hp: BATTLE_SHIP_MAX_HP,
    alive: true,
    kills: 0,
  };
}

export function isInsideInitialArena(x: number, z: number): boolean {
  return (
    Math.hypot(x - BATTLE_ARENA_CENTER_X, z - BATTLE_ARENA_CENTER_Z) <=
    BATTLE_INITIAL_ZONE_RADIUS
  );
}
