import {
  BATTLE_ARENA_CENTER_X,
  BATTLE_ARENA_CENTER_Y,
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
  const dist = 200 + (hash % 500);
  return {
    worldX: BATTLE_ARENA_CENTER_X + Math.cos(angle) * dist,
    worldY: BATTLE_ARENA_CENTER_Y + Math.sin(angle) * dist,
    angle: angle + Math.PI,
    hp: BATTLE_SHIP_MAX_HP,
    alive: true,
    kills: 0,
  };
}

export function isInsideInitialArena(x: number, y: number): boolean {
  return (
    Math.hypot(x - BATTLE_ARENA_CENTER_X, y - BATTLE_ARENA_CENTER_Y) <=
    BATTLE_INITIAL_ZONE_RADIUS
  );
}
