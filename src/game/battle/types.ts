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
  z: number;
  vx: number;
  vy: number;
  vz: number;
  bornAt: number;
}

export interface FireEventPayload {
  id: string;
  ownerUuid: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface HitEventPayload {
  projectileId: string;
  targetUuid: string;
  damage: number;
}

export interface BattleSceneSnapshot {
  localUuid: string;
  localShip: ShipState;
  remoteShips: RemoteShip[];
  projectiles: Projectile[];
  zone: import('@/game/battle/zone').ZoneState;
  throttle: number;
  tick: number;
}
