/** Browser-facing same-origin proxy paths for CKS GraphQL HTTP APIs. */

export const PROXY_MGMT_PATH = '/cks-proxy/mgmt';
export const PROXY_GAME_PATH = '/cks-proxy/game';

const MGMT_HOST_PATTERNS = [
  /^api\.[a-z0-9-]+\.dev\.cks-env\.com$/i,
  /^api\.[a-z0-9-]+\.test\.cks-env\.com$/i,
  /^api\.[a-z0-9-]+\.cks-env\.com$/i,
  /^api\.dev\.crowdedkingdoms\.com$/i,
  /^api\.test\.crowdedkingdoms\.com$/i,
  /^api\.crowdedkingdoms\.com$/i,
];

const GAME_HOST_PATTERNS = [
  /^game\.[a-z0-9-]+\.dev\.cks-env\.com$/i,
  /^game\.[a-z0-9-]+\.test\.cks-env\.com$/i,
  /^game\.[a-z0-9-]+\.cks-env\.com$/i,
];

export function isAllowedUpstreamUrl(
  upstreamUrl: string,
  kind: 'mgmt' | 'game',
): boolean {
  try {
    const url = new URL(upstreamUrl);
    if (url.protocol !== 'https:') return false;
    const patterns = kind === 'mgmt' ? MGMT_HOST_PATTERNS : GAME_HOST_PATTERNS;
    if (!patterns.some((re) => re.test(url.hostname))) return false;
    return url.pathname === '/graphql' || url.pathname.endsWith('/graphql');
  } catch {
    return false;
  }
}

export function buildProxyUrl(kind: 'mgmt' | 'game', upstreamUrl: string): string {
  const base = kind === 'mgmt' ? PROXY_MGMT_PATH : PROXY_GAME_PATH;
  return `${base}?target=${encodeURIComponent(upstreamUrl)}`;
}

/** If already a same-origin proxy URL, return as-is. */
export function toProxiedGraphqlUrl(
  kind: 'mgmt' | 'game',
  upstreamOrProxyUrl: string,
): string {
  const trimmed = upstreamOrProxyUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('/cks-proxy/')) return trimmed;
  if (trimmed.startsWith('/mgmt-api') || trimmed.startsWith('/game-api')) {
    return trimmed;
  }
  return buildProxyUrl(kind, trimmed);
}
