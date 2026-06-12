import {
  forwardWebRequest,
  parseProxyTarget,
  PROXY_GAME_PATH,
  PROXY_MGMT_PATH,
} from '../../scripts/cks-api-proxy-lib.mjs';

export default async (request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const kind = path.includes(`${PROXY_GAME_PATH}`)
    ? 'game'
    : path.includes(`${PROXY_MGMT_PATH}`)
      ? 'mgmt'
      : null;

  if (!kind) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  const target = parseProxyTarget(url.searchParams.get('target'), kind);
  if (!target) {
    return new Response(JSON.stringify({ error: 'invalid or disallowed target' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    return await forwardWebRequest(request, target);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
};
