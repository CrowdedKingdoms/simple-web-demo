import { generateCrowdyUuid } from '@crowdedkingdomstudios/crowdyjs';
import { envScopedKey } from '@/game/envScope';

const STORAGE_KEY = () => envScopedKey('cks-tank-actor-uuid');

export function getTankActorUuid(): string {
  if (typeof window === 'undefined') return generateCrowdyUuid();
  try {
    const key = STORAGE_KEY();
    let id = localStorage.getItem(key);
    if (!id) {
      id = generateCrowdyUuid();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return generateCrowdyUuid();
  }
}

export function clearTankActorUuid(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY());
  } catch {
    // ignore
  }
}
