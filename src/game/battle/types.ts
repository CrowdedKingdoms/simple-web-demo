import type { ShipState } from '@/game/battle/shipState';

export const EVENT_FIRE = 1;
export const EVENT_HIT = 2;

export interface RemoteShip {
  uuid: string;
  ship: ShipState;
  color: string;
}

export interface Projectile {
  id: string;
  ownerUuid: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornAt: number;
}

export interface FireEventPayload {
  id: string;
  ownerUuid: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface HitEventPayload {
  projectileId: string;
  targetUuid: string;
  damage: number;
}
