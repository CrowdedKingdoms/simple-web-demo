import {
  actorColorForUuid,
  PILOT_COLORS,
  pilotColorLabel,
} from '@/game/render/CanvasRenderer';
import { envScopedKey } from '@/game/envScope';

export { PILOT_COLORS, pilotColorLabel };

function colorStorageKey(): string {
  return envScopedKey('cks-tank-color-hex');
}

export function isTankColorHex(value: string): boolean {
  return (PILOT_COLORS as readonly string[]).includes(value);
}

export function resolveTankColor(
  colorId: string | undefined,
  fallbackUuid: string,
): string {
  if (colorId && isTankColorHex(colorId)) return colorId;
  return actorColorForUuid(colorId ?? fallbackUuid);
}

export function defaultTankColorForUuid(uuid: string): string {
  return actorColorForUuid(uuid);
}

export function getTankColorChoice(fallbackUuid: string): string {
  if (typeof window === 'undefined') {
    return defaultTankColorForUuid(fallbackUuid);
  }
  try {
    const stored = localStorage.getItem(colorStorageKey());
    if (stored && isTankColorHex(stored)) return stored;
  } catch {
    // ignore
  }
  return defaultTankColorForUuid(fallbackUuid);
}

export function setTankColorChoice(hex: string): void {
  if (typeof window === 'undefined') return;
  if (!isTankColorHex(hex)) return;
  try {
    localStorage.setItem(colorStorageKey(), hex);
  } catch {
    // ignore
  }
}
