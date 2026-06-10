import {
  getActiveDemoConfig,
  getEnvHandleFromConfig,
} from '@/config/demoConfig';

const ENV_MARKER_KEY = 'cks-demo-env-handle';

const SCOPED_PREFIXES = [
  'cks-canvas-token',
  'cks-canvas-guest-creds',
  'cks-battle-actor-uuid',
  'cks-pilot-color-id',
  'cks-tank-actor-uuid',
  'cks-tank-color-hex',
];

export function resolveEnvHandle(): string {
  return getEnvHandleFromConfig(getActiveDemoConfig());
}

export function envScopedKey(base: string): string {
  return `${base}:${resolveEnvHandle()}`;
}

function clearLegacyUnscopedKeys(): void {
  if (typeof localStorage === 'undefined') return;
  for (const base of SCOPED_PREFIXES) {
    try {
      localStorage.removeItem(base);
    } catch {
      // ignore
    }
  }
}

/**
 * When the configured game/mgmt URLs change, drop cached tokens and actor ids
 * from the previous environment so UDP multiplayer can reconnect cleanly.
 */
export function ensureEnvScope(): void {
  if (typeof localStorage === 'undefined') return;
  const handle = resolveEnvHandle();
  try {
    const prev = localStorage.getItem(ENV_MARKER_KEY);
    if (prev && prev !== handle) {
      for (const base of SCOPED_PREFIXES) {
        localStorage.removeItem(envScopedKey(base));
      }
      clearLegacyUnscopedKeys();
    } else if (!prev) {
      clearLegacyUnscopedKeys();
    }
    localStorage.setItem(ENV_MARKER_KEY, handle);
  } catch {
    // ignore
  }
}
