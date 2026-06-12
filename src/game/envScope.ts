import {
  getActiveDemoConfig,
  getEnvHandleFromConfig,
} from '@/config/demoConfig';

const SCOPE_MARKER_KEY = 'cks-demo-scope-key';

const SCOPED_PREFIXES = [
  'cks-canvas-token',
  'cks-canvas-guest-creds',
  'cks-battle-actor-uuid',
  'cks-pilot-color-id',
  'cks-tank-actor-uuid',
  'cks-tank-color-hex',
];

/** Env handle + app id + management plane — separate auth per app world. */
export function resolveScopeKey(): string {
  const config = getActiveDemoConfig();
  const handle = getEnvHandleFromConfig(config);
  const appId = config.appId?.trim() || '1';
  const mgmt = config.managementGraphqlUrl?.trim() || '';
  return `${handle}|${appId}|${mgmt}`;
}

export function resolveEnvHandle(): string {
  return getEnvHandleFromConfig(getActiveDemoConfig());
}

export function envScopedKey(base: string): string {
  return `${base}:${resolveScopeKey()}`;
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

function clearEnvOnlyScopedKeys(handle: string): void {
  if (typeof localStorage === 'undefined' || !handle) return;
  try {
    for (const base of SCOPED_PREFIXES) {
      localStorage.removeItem(`${base}:${handle}`);
    }
  } catch {
    // ignore
  }
}

/**
 * When env handle or app id changes, drop cached tokens and actor ids so each
 * app world reconnects with its own guest session and actor uuid.
 */
export function ensureEnvScope(): void {
  if (typeof localStorage === 'undefined') return;
  const scopeKey = resolveScopeKey();
  const handle = resolveEnvHandle();
  try {
    const prev = localStorage.getItem(SCOPE_MARKER_KEY);
    if (prev && prev !== scopeKey) {
      if (prev.includes('|')) {
        for (const base of SCOPED_PREFIXES) {
          localStorage.removeItem(`${base}:${prev}`);
        }
      } else {
        clearEnvOnlyScopedKeys(prev);
      }
      clearLegacyUnscopedKeys();
    } else if (!prev) {
      clearLegacyUnscopedKeys();
      if (handle) clearEnvOnlyScopedKeys(handle);
    }
    localStorage.setItem(SCOPE_MARKER_KEY, scopeKey);
  } catch {
    // ignore
  }
}
