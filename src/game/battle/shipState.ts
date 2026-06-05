import { ACTOR_STATE_BYTES } from '@/config';
import type { ActorPose } from '@/game/world/actorState';

export interface ShipState {
  worldX: number;
  worldY: number;
  angle: number;
  hp: number;
  alive: boolean;
  kills: number;
}

export function shipStateToPose(ship: ShipState): ActorPose {
  return { worldX: ship.worldX, worldY: ship.worldY, pushFlags: ship.alive ? 1 : 0 };
}

export function encodeShipState(ship: ShipState): string {
  const buf = new ArrayBuffer(ACTOR_STATE_BYTES);
  const view = new DataView(buf);
  view.setFloat64(0, ship.worldX, true);
  view.setFloat64(8, ship.worldY, true);
  view.setFloat32(16, ship.angle, true);
  view.setUint8(20, Math.max(0, Math.min(255, Math.round(ship.hp))));
  view.setUint8(21, ship.alive ? 1 : 0);
  view.setUint8(22, Math.max(0, Math.min(255, ship.kills)));
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function decodeShipState(stateBase64: string): ShipState | null {
  try {
    const binary = atob(stateBase64);
    if (binary.length < 23) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const view = new DataView(bytes.buffer);
    return {
      worldX: view.getFloat64(0, true),
      worldY: view.getFloat64(8, true),
      angle: view.getFloat32(16, true),
      hp: view.getUint8(20),
      alive: view.getUint8(21) === 1,
      kills: view.getUint8(22),
    };
  } catch {
    return null;
  }
}
