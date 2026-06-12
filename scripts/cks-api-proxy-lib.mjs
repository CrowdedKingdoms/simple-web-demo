/** Shared CKS API proxy helpers (Vite dev middleware + Netlify function). */

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

/**
 * @param {string} upstreamUrl
 * @param {'mgmt' | 'game'} kind
 */
export function isAllowedUpstreamUrl(upstreamUrl, kind) {
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

/**
 * @param {'mgmt' | 'game'} kind
 * @param {string} upstreamUrl
 */
export function buildProxyUrl(kind, upstreamUrl) {
  const base = kind === 'mgmt' ? PROXY_MGMT_PATH : PROXY_GAME_PATH;
  return `${base}?target=${encodeURIComponent(upstreamUrl)}`;
}

/**
 * @param {string | null | undefined} target
 * @param {'mgmt' | 'game'} kind
 */
export function parseProxyTarget(target, kind) {
  if (!target?.trim()) return null;
  const decoded = decodeURIComponent(target.trim());
  return isAllowedUpstreamUrl(decoded, kind) ? decoded : null;
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
]);

/**
 * Forward an HTTP request to an upstream CKS GraphQL endpoint.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} upstreamUrl
 */
export async function forwardNodeRequest(req, res, upstreamUrl) {
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', resolve);
    req.on('error', reject);
  });
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  const upstreamRes = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body:
      req.method && !['GET', 'HEAD'].includes(req.method) ? body : undefined,
  });

  res.statusCode = upstreamRes.status;
  upstreamRes.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await upstreamRes.arrayBuffer());
  res.end(buf);
}

/**
 * @param {Request} request
 * @param {string} upstreamUrl
 */
export async function forwardWebRequest(request, upstreamUrl) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  const hasBody =
    request.method && !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstreamRes = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
  });

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: upstreamRes.headers,
  });
}
