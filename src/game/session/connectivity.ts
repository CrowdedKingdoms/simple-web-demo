import type { DemoConfig } from '@/config/demoConfig';

export interface ConnectivityStatus {
  managementOk: boolean | null;
  gameOk: boolean | null;
  managementError?: string;
  gameError?: string;
}

export async function checkConnectivityForConfig(
  config: DemoConfig,
): Promise<ConnectivityStatus> {
  const result: ConnectivityStatus = {
    managementOk: null,
    gameOk: null,
  };
  try {
    const mgmtRes = await fetch(config.managementGraphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    result.managementOk = mgmtRes.ok;
    if (!mgmtRes.ok) result.managementError = `HTTP ${mgmtRes.status}`;
  } catch (e) {
    result.managementOk = false;
    result.managementError = e instanceof Error ? e.message : String(e);
  }
  try {
    const gameRes = await fetch(config.gameHttpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    result.gameOk = gameRes.ok;
    if (!gameRes.ok) result.gameError = `HTTP ${gameRes.status}`;
  } catch (e) {
    result.gameOk = false;
    result.gameError = e instanceof Error ? e.message : String(e);
  }
  return result;
}
