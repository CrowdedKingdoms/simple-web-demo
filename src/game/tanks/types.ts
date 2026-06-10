import type { TankState } from '@/game/tanks/tankState';

export const EVENT_TANK_FIRE = 41;
export const EVENT_TANK_HIT = 42;

export interface TankBullet {
  id: string;
  ownerUuid: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornAt: number;
}

export interface RemoteTank {
  uuid: string;
  tank: TankState;
  color: string;
  lastSeenAt: number;
  lastSequence?: number;
}

export interface FirePayload {
  id: string;
  ownerUuid: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface HitPayload {
  targetUuid: string;
  damage: number;
  projectileId: string;
}

export interface TankArenaSnapshot {
  localTank: TankState;
  localColor: string;
  localUuid: string;
  remoteTanks: RemoteTank[];
  bullets: TankBullet[];
  playerCount: number;
  tick: number;
}
