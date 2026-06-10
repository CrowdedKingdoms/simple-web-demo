import { ACTOR_STATE_BYTES } from '@/config';
import type { ActorPose } from '@/game/world/actorState';

export interface TankState {
  x: number;
  y: number;
  angle: number;
  hp: number;
  alive: boolean;
  kills: number;
  colorId?: string;
}

const COLOR_ID_BYTES = 36;
const COLOR_ID_OFFSET = 23;
const WIRE_BYTES = COLOR_ID_OFFSET + COLOR_ID_BYTES;

function writeColorId(view: DataView, offset: number, colorId?: string): void {
  const raw = (colorId ?? '').slice(0, COLOR_ID_BYTES);
  for (let i = 0; i < COLOR_ID_BYTES; i++) {
    view.setUint8(offset + i, i < raw.length ? raw.charCodeAt(i) : 0);
  }
}

function readColorId(bytes: Uint8Array, offset: number): string | undefined {
  if (bytes.length < offset + COLOR_ID_BYTES) return undefined;
  let end = offset + COLOR_ID_BYTES;
  while (end > offset && bytes[end - 1] === 0) end--;
  if (end <= offset) return undefined;
  return String.fromCharCode(...bytes.slice(offset, end));
}

export function tankStateToPose(tank: TankState): ActorPose {
  return {
    worldX: tank.x,
    worldY: tank.y,
    pushFlags: tank.alive ? 1 : 0,
  };
}

export function encodeTankState(tank: TankState, colorId?: string): string {
  const buf = new ArrayBuffer(ACTOR_STATE_BYTES);
  const view = new DataView(buf);
  view.setFloat64(0, tank.x, true);
  view.setFloat64(8, tank.y, true);
  view.setFloat32(16, tank.angle, true);
  view.setUint8(20, Math.max(0, Math.min(255, Math.round(tank.hp))));
  view.setUint8(21, tank.alive ? 1 : 0);
  view.setUint8(22, Math.max(0, Math.min(255, tank.kills)));
  writeColorId(view, COLOR_ID_OFFSET, colorId ?? tank.colorId);
  const bytes = new Uint8Array(buf, 0, WIRE_BYTES);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function decodeTankState(stateBase64: string): TankState | null {
  try {
    const binary = atob(stateBase64);
    if (binary.length < 23) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const view = new DataView(bytes.buffer);
    return {
      x: view.getFloat64(0, true),
      y: view.getFloat64(8, true),
      angle: view.getFloat32(16, true),
      hp: view.getUint8(20),
      alive: view.getUint8(21) === 1,
      kills: view.getUint8(22),
      colorId: readColorId(bytes, COLOR_ID_OFFSET),
    };
  } catch {
    return null;
  }
}
