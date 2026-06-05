import * as THREE from 'three';
import type { ShipState } from '@/game/battle/shipState';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _forward = new THREE.Vector3();

/**
 * Unit forward vector — matches playerRig YXZ rotation with nose along local -Z.
 */
export function shipForward(ship: Pick<ShipState, 'yaw' | 'pitch'>): Vec3 {
  _euler.set(ship.pitch, ship.yaw, 0, 'YXZ');
  _forward.set(0, 0, -1).applyEuler(_euler);
  return { x: _forward.x, y: _forward.y, z: _forward.z };
}

export function addScaled(out: Vec3, dir: Vec3, scale: number): Vec3 {
  return {
    x: out.x + dir.x * scale,
    y: out.y + dir.y * scale,
    z: out.z + dir.z * scale,
  };
}

export function clampSpeed(v: Vec3, max: number): Vec3 {
  const speed = Math.hypot(v.x, v.y, v.z);
  if (speed <= max) return v;
  const s = max / speed;
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function distance3(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  return Math.hypot(ax - bx, ay - by, az - bz);
}
