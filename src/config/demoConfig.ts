/** Runtime demo configuration — URL params, build defaults, or empty. */

export type DemoConfigSource = 'query' | 'build' | 'empty';

export interface DemoConfig {
  envHandle: string;
  managementGraphqlUrl: string;
  gameHttpUrl: string;
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

export function deriveUrlsFromEnvHandle(
  envHandle: string,
  overrides?: { mgmt?: string; gameHttp?: string; gameWs?: string },
): Pick<DemoConfig, 'managementGraphqlUrl' | 'gameHttpUrl' | 'gameWsUrl'> {
  const handle = envHandle.trim();
  const gameHost = `game.${handle}.${DEV_DNS_ROOT}`;
  return {
    managementGraphqlUrl:
      overrides?.mgmt?.trim() ||
      `https://api.${handle}.${DEV_DNS_ROOT}/graphql`,
    gameHttpUrl:
      overrides?.gameHttp?.trim() ||
      `https://${gameHost}/graphql`,
    gameWsUrl:
      overrides?.gameWs?.trim() ||
      `wss://${gameHost}/graphql`,
  };
}

function buildDefaultConfig(): DemoConfig {
  const mgmtBase =
    import.meta.env.VITE_MANAGEMENT_API_URL ?? '/mgmt-api';
  const mgmtGraphql =
    import.meta.env.VITE_MANAGEMENT_GRAPHQL_URL ??
    `${mgmtBase.replace(/\/$/, '')}/graphql`;

  return {
    envHandle: BUILD_ENV_HANDLE,
    managementGraphqlUrl: mgmtGraphql,
    gameHttpUrl:
      import.meta.env.VITE_GAME_API_HTTP_URL ??
      `https://game.${BUILD_ENV_HANDLE}.${DEV_DNS_ROOT}/graphql`,
    gameWsUrl:
      import.meta.env.VITE_GAME_API_WS_URL ??
      `wss://game.${BUILD_ENV_HANDLE}.${DEV_DNS_ROOT}/graphql`,
    appId: import.meta.env.VITE_APP_ID ?? '1',
    orgId: import.meta.env.VITE_ORG_ID ?? '1',
    source: 'build',
  };
}

function emptyConfig(): DemoConfig {
  return {
    envHandle: '',
    managementGraphqlUrl: SHARED_MGMT_FALLBACK,
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

  const mgmtOverride = params.get('mgmt')?.trim();
  const gameHttpOverride = params.get('gh')?.trim();
  const gameWsOverride = params.get('gw')?.trim();
  const derived = deriveUrlsFromEnvHandle(envHandle, {
    mgmt: mgmtOverride,
    gameHttp: gameHttpOverride,
    gameWs: gameWsOverride,
  });

  let mgmt = derived.managementGraphqlUrl;
  if (!mgmtOverride && !mgmt.includes(handleInMgmtUrl(envHandle))) {
    mgmt = SHARED_MGMT_FALLBACK;
  }

  return {
    envHandle,
    managementGraphqlUrl: mgmt,
    gameHttpUrl: derived.gameHttpUrl,
    gameWsUrl: derived.gameWsUrl,
    appId: params.get('app')?.trim() || '1',
    orgId: params.get('org')?.trim() || '1',
    source: 'query',
  };
}

function handleInMgmtUrl(handle: string): string {
  return `api.${handle}.`;
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

  const defaults = deriveUrlsFromEnvHandle(input.envHandle);
  if (
    input.managementGraphqlUrl &&
    input.managementGraphqlUrl !== defaults.managementGraphqlUrl
  ) {
    params.set('mgmt', input.managementGraphqlUrl);
  }
  if (input.gameHttpUrl && input.gameHttpUrl !== defaults.gameHttpUrl) {
    params.set('gh', input.gameHttpUrl);
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
  return {
    EnvHandle: config.envHandle,
    ManagementApiUrl: config.managementGraphqlUrl,
    GameApiHttpUrl: config.gameHttpUrl,
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
  return deriveEnvHandleFromGameUrl(config.gameHttpUrl) ?? 'default';
}
