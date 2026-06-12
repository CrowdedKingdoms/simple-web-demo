/** Runtime demo configuration — URL params, build defaults, or empty. */

import { buildProxyUrl, toProxiedGraphqlUrl } from '@/config/apiProxy';

export type DemoConfigSource = 'query' | 'build' | 'empty';

export interface DemoConfig {
  envHandle: string;
  /** Same-origin proxy URL used by the browser for management GraphQL HTTP. */
  managementGraphqlUrl: string;
  /** Same-origin proxy URL used by the browser for game GraphQL HTTP. */
  gameHttpUrl: string;
  /** Direct WebSocket URL (cross-origin; game API allows all origins). */
  gameWsUrl: string;
  appId: string;
  orgId: string;
  source: DemoConfigSource;
}

const DEV_DNS_ROOT = 'dev.cks-env.com';
const SHARED_MGMT_FALLBACK = 'https://api.dev.crowdedkingdoms.com/graphql';

const BUILD_ENV_HANDLE =
  import.meta.env.VITE_ENV_HANDLE?.trim() ||
  deriveEnvHandleFromGameUrl(import.meta.env.VITE_GAME_API_HTTP_URL) ||
  'e-zt0psk82q3bi';

function deriveEnvHandleFromGameUrl(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/game\.([a-z0-9-]+)\.dev\.cks-env\.com/i);
  return m?.[1] ?? null;
}

/** Default management API for devbox env handles (`api.<handle>.dev.cks-env.com`). */
export function managementApiUrlForEnvHandle(envHandle: string): string {
  const handle = envHandle.trim();
  if (!handle) return SHARED_MGMT_FALLBACK;
  return `https://api.${handle}.${DEV_DNS_ROOT}/graphql`;
}

/** Resolve real upstream HTTPS GraphQL endpoints (not browser proxy paths). */
export function resolveUpstreamUrls(
  envHandle: string,
  overrides?: { mgmt?: string; gameHttp?: string; gameWs?: string },
): {
  managementGraphqlUrl: string;
  gameHttpUrl: string;
  gameWsUrl: string;
} {
  const handle = envHandle.trim();
  const gameHost = `game.${handle}.${DEV_DNS_ROOT}`;
  // Devbox game-api introspects tokens against the box-local management API
  // (`api.<handle>.…`), so register/login must use the same plane. Dedicated
  // environments can override with ?mgmt=https://api.dev.crowdedkingdoms.com/graphql.
  const upstream = {
    managementGraphqlUrl:
      overrides?.mgmt?.trim() || managementApiUrlForEnvHandle(handle),
    gameHttpUrl:
      overrides?.gameHttp?.trim() ||
      `https://${gameHost}/graphql`,
    gameWsUrl:
      overrides?.gameWs?.trim() ||
      `wss://${gameHost}/graphql`,
  };

  return upstream;
}

export function deriveUrlsFromEnvHandle(
  envHandle: string,
  overrides?: { mgmt?: string; gameHttp?: string; gameWs?: string },
): Pick<DemoConfig, 'managementGraphqlUrl' | 'gameHttpUrl' | 'gameWsUrl'> {
  const upstream = resolveUpstreamUrls(envHandle, overrides);
  return {
    managementGraphqlUrl: toProxiedGraphqlUrl('mgmt', upstream.managementGraphqlUrl),
    gameHttpUrl: toProxiedGraphqlUrl('game', upstream.gameHttpUrl),
    gameWsUrl: upstream.gameWsUrl,
  };
}

function upstreamFromBuildEnv(): {
  managementGraphqlUrl: string;
  gameHttpUrl: string;
  gameWsUrl: string;
} {
  const mgmtFromEnv = import.meta.env.VITE_MANAGEMENT_GRAPHQL_URL?.trim();
  const gameHttpFromEnv = import.meta.env.VITE_GAME_API_HTTP_URL?.trim();
  const gameWsFromEnv = import.meta.env.VITE_GAME_API_WS_URL?.trim();

  if (
    mgmtFromEnv &&
    (mgmtFromEnv.startsWith('http://') || mgmtFromEnv.startsWith('https://'))
  ) {
    return resolveUpstreamUrls(BUILD_ENV_HANDLE, {
      mgmt: mgmtFromEnv,
      gameHttp: gameHttpFromEnv,
      gameWs: gameWsFromEnv,
    });
  }

  return resolveUpstreamUrls(BUILD_ENV_HANDLE, {
    gameHttp: gameHttpFromEnv?.startsWith('http')
      ? gameHttpFromEnv
      : undefined,
    gameWs: gameWsFromEnv,
  });
}

function buildDefaultConfig(): DemoConfig {
  const upstream = upstreamFromBuildEnv();
  return {
    envHandle: BUILD_ENV_HANDLE,
    managementGraphqlUrl: toProxiedGraphqlUrl('mgmt', upstream.managementGraphqlUrl),
    gameHttpUrl: toProxiedGraphqlUrl('game', upstream.gameHttpUrl),
    gameWsUrl: upstream.gameWsUrl,
    appId: import.meta.env.VITE_APP_ID ?? '1',
    orgId: import.meta.env.VITE_ORG_ID ?? '1',
    source: 'build',
  };
}

function emptyConfig(): DemoConfig {
  return {
    envHandle: '',
    managementGraphqlUrl: buildProxyUrl('mgmt', SHARED_MGMT_FALLBACK),
    gameHttpUrl: '',
    gameWsUrl: '',
    appId: '1',
    orgId: '1',
    source: 'empty',
  };
}

export function parseDemoConfig(search: string): DemoConfig {
  const params = new URLSearchParams(search);
  const envHandle = params.get('env')?.trim() ?? '';

  if (!envHandle) {
    const hasBuild =
      !!import.meta.env.VITE_ENV_HANDLE ||
      !!import.meta.env.VITE_GAME_API_HTTP_URL;
    return hasBuild ? buildDefaultConfig() : emptyConfig();
  }

  const derived = deriveUrlsFromEnvHandle(envHandle, {
    mgmt: params.get('mgmt')?.trim(),
    gameHttp: params.get('gh')?.trim(),
    gameWs: params.get('gw')?.trim(),
  });

  return {
    envHandle,
    managementGraphqlUrl: derived.managementGraphqlUrl,
    gameHttpUrl: derived.gameHttpUrl,
    gameWsUrl: derived.gameWsUrl,
    appId: params.get('app')?.trim() || '1',
    orgId: params.get('org')?.trim() || '1',
    source: 'query',
  };
}

export function isConfigComplete(config: DemoConfig): boolean {
  return (
    config.source !== 'empty' &&
    config.envHandle.length > 0 &&
    config.gameHttpUrl.length > 0 &&
    config.gameWsUrl.length > 0 &&
    config.managementGraphqlUrl.length > 0 &&
    config.appId.length > 0 &&
    config.orgId.length > 0
  );
}

export function configFingerprint(config: DemoConfig): string {
  return [
    config.envHandle,
    config.managementGraphqlUrl,
    config.gameHttpUrl,
    config.gameWsUrl,
    config.appId,
    config.orgId,
  ].join('|');
}

export function serializeDemoConfig(
  input: Pick<DemoConfig, 'envHandle' | 'appId' | 'orgId'> & {
    managementGraphqlUrl?: string;
    gameHttpUrl?: string;
    gameWsUrl?: string;
  },
): string {
  const params = new URLSearchParams();
  if (input.envHandle) params.set('env', input.envHandle);
  if (input.appId && input.appId !== '1') params.set('app', input.appId);
  if (input.orgId && input.orgId !== '1') params.set('org', input.orgId);

  const defaults = resolveUpstreamUrls(input.envHandle);
  const mgmtUpstream = input.managementGraphqlUrl?.startsWith('/cks-proxy/')
    ? undefined
    : input.managementGraphqlUrl;
  const gameHttpUpstream = input.gameHttpUrl?.startsWith('/cks-proxy/')
    ? undefined
    : input.gameHttpUrl;

  if (mgmtUpstream && mgmtUpstream !== defaults.managementGraphqlUrl) {
    params.set('mgmt', mgmtUpstream);
  }
  if (gameHttpUpstream && gameHttpUpstream !== defaults.gameHttpUrl) {
    params.set('gh', gameHttpUpstream);
  }
  if (input.gameWsUrl && input.gameWsUrl !== defaults.gameWsUrl) {
    params.set('gw', input.gameWsUrl);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function preserveConfigSearch(search: string): string {
  const config = parseDemoConfig(search);
  if (!isConfigComplete(config)) return '';
  return serializeDemoConfig(config);
}

export function configToDisplay(config: DemoConfig): Record<string, string> {
  const upstream = config.envHandle
    ? resolveUpstreamUrls(config.envHandle)
    : {
        managementGraphqlUrl: SHARED_MGMT_FALLBACK,
        gameHttpUrl: '',
        gameWsUrl: '',
      };

  return {
    EnvHandle: config.envHandle,
    ManagementApiUrl: upstream.managementGraphqlUrl,
    GameApiHttpUrl: upstream.gameHttpUrl,
    GameApiWsUrl: config.gameWsUrl,
    AppId: config.appId,
    OrgId: config.orgId,
  };
}

/** Module store — updated by DemoConfigProvider before CrowdySession reads it. */
let activeConfig: DemoConfig = buildDefaultConfig();

export function setActiveDemoConfig(config: DemoConfig): void {
  activeConfig = config;
}

export function getActiveDemoConfig(): DemoConfig {
  return activeConfig;
}

export function getEnvHandleFromConfig(config: DemoConfig = activeConfig): string {
  if (config.envHandle) return config.envHandle;
  return deriveEnvHandleFromGameUrl(config.gameWsUrl) ?? 'default';
}
