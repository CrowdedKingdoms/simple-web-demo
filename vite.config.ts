import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  forwardNodeRequest,
  parseProxyTarget,
  PROXY_GAME_PATH,
  PROXY_MGMT_PATH,
} from './scripts/cks-api-proxy-lib.mjs';

interface DevPresence {
  uuid: string;
  pose: { worldX: number; worldY: number; pushFlags: number };
  updatedAt: number;
}

interface DevPaintCell {
  cellX: number;
  cellY: number;
  r: number;
  g: number;
  b: number;
  a: number;
  voxelType: number;
  updatedAt: number;
}

const devPresence = new Map<string, DevPresence>();
const devPaint = new Map<string, DevPaintCell>();

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += String(chunk);
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function cksApiProxyPlugin(): Plugin {
  return {
    name: 'cks-api-proxy',
    configureServer(server) {
      const handleProxy = async (
        req: IncomingMessage,
        res: ServerResponse,
        kind: 'mgmt' | 'game',
      ) => {
        if (!req.url) {
          sendJson(res, 400, { error: 'missing url' });
          return;
        }
        const target = parseProxyTarget(
          new URL(req.url, 'http://localhost').searchParams.get('target'),
          kind,
        );
        if (!target) {
          sendJson(res, 400, { error: 'invalid or disallowed target' });
          return;
        }
        try {
          await forwardNodeRequest(req, res, target);
        } catch (error) {
          sendJson(res, 502, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };

      server.middlewares.use(PROXY_MGMT_PATH, (req, res) => {
        void handleProxy(req, res, 'mgmt');
      });
      server.middlewares.use(PROXY_GAME_PATH, (req, res) => {
        void handleProxy(req, res, 'game');
      });
    },
  };
}

function devPresencePlugin(): Plugin {
  return {
    name: 'cks-canvas-dev-presence',
    configureServer(server) {
      server.middlewares.use('/collab/presence', async (req, res) => {
        if (req.method === 'GET') {
          const now = Date.now();
          for (const [uuid, presence] of devPresence) {
            if (now - presence.updatedAt > 10_000) devPresence.delete(uuid);
          }
          sendJson(res, 200, [...devPresence.values()]);
          return;
        }

        if (req.method === 'POST') {
          try {
            const body = (await readJsonBody(req)) as DevPresence;
            if (
              !body ||
              typeof body.uuid !== 'string' ||
              typeof body.pose?.worldX !== 'number' ||
              typeof body.pose?.worldY !== 'number' ||
              typeof body.pose?.pushFlags !== 'number'
            ) {
              sendJson(res, 400, { error: 'invalid presence payload' });
              return;
            }
            devPresence.set(body.uuid, { ...body, updatedAt: Date.now() });
            sendJson(res, 200, { ok: true });
          } catch (error) {
            sendJson(res, 500, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }

        sendJson(res, 405, { error: 'method not allowed' });
      });

      server.middlewares.use('/collab/paint', async (req, res) => {
        if (req.method === 'GET') {
          sendJson(res, 200, [...devPaint.values()]);
          return;
        }

        if (req.method === 'POST') {
          try {
            const body = (await readJsonBody(req)) as DevPaintCell;
            if (
              !body ||
              typeof body.cellX !== 'number' ||
              typeof body.cellY !== 'number' ||
              typeof body.r !== 'number' ||
              typeof body.g !== 'number' ||
              typeof body.b !== 'number' ||
              typeof body.a !== 'number' ||
              typeof body.voxelType !== 'number'
            ) {
              sendJson(res, 400, { error: 'invalid paint payload' });
              return;
            }
            const cell = { ...body, updatedAt: Date.now() };
            devPaint.set(`${cell.cellX},${cell.cellY}`, cell);
            sendJson(res, 200, { ok: true });
          } catch (error) {
            sendJson(res, 500, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }

        sendJson(res, 405, { error: 'method not allowed' });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), cksApiProxyPlugin(), devPresencePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    globals: false,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
