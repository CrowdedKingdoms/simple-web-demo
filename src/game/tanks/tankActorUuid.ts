import { generateCrowdyUuid } from '@crowdedkingdomstudios/crowdyjs';
import { envScopedKey } from '@/game/envScope';

const STORAGE_KEY = () => envScopedKey('cks-tank-actor-uuid');

/** Per-tab storage so two windows/tabs on the same env+app get distinct tank actors. */
function tabStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getTankActorUuid(): string {
  if (typeof window === 'undefined') return generateCrowdyUuid();
  const storage = tabStorage();
  if (!storage) return generateCrowdyUuid();
  try {
    const key = STORAGE_KEY();
    let id = storage.getItem(key);
    if (!id) {
      id = generateCrowdyUuid();
      storage.setItem(key, id);
    }
    return id;
  } catch {
    return generateCrowdyUuid();
  }
}

export function clearTankActorUuid(): void {
  const storage = tabStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY());
  } catch {
    // ignore
  }
}
