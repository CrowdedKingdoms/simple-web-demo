import type { FireEventPayload } from '@/game/battle/types';
import type { ShipState } from '@/game/battle/shipState';

export interface BattlePeer {
  uuid: string;
  ship: ShipState;
  updatedAt: number;
}

export interface RelayedFire extends FireEventPayload {
  firedAt: number;
}

export async function postBattlePresence(uuid: string, ship: ShipState): Promise<void> {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  try {
    await fetch('/collab/battle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uuid, ship, updatedAt: Date.now() }),
    });
  } catch {
    // Dev relay only
  }
}

export async function listBattlePeers(
  selfUuid: string,
  maxAgeMs = 10_000,
): Promise<BattlePeer[]> {
  if (!import.meta.env.DEV || typeof window === 'undefined') return [];
  try {
    const res = await fetch('/collab/battle');
    if (!res.ok) return [];
    const entries = (await res.json()) as BattlePeer[];
    const now = Date.now();
    return entries.filter(
      (e) => e.uuid !== selfUuid && now - e.updatedAt <= maxAgeMs && e.ship?.alive,
    );
  } catch {
    return [];
  }
}

export async function postBattleFire(payload: FireEventPayload): Promise<void> {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  try {
    await fetch('/collab/battle-fire', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, firedAt: Date.now() }),
    });
  } catch {
    // Dev relay only
  }
}

export async function listBattleFires(maxAgeMs = 2_500): Promise<RelayedFire[]> {
  if (!import.meta.env.DEV || typeof window === 'undefined') return [];
  try {
    const res = await fetch('/collab/battle-fire');
    if (!res.ok) return [];
    const entries = (await res.json()) as RelayedFire[];
    const now = Date.now();
    return entries.filter((e) => now - e.firedAt <= maxAgeMs);
  } catch {
    return [];
  }
}
