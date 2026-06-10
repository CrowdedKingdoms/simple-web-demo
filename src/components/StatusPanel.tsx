import { DOCS_BASE } from '@/config';
import { useDemoConfig } from '@/context/DemoConfigContext';

interface StatusPanelProps {
  managementOk?: boolean | null;
  gameOk?: boolean | null;
  userEmail?: string;
  userId?: string;
  udpConnected?: boolean;
  peerCount?: number;
  paintedCells?: number;
  netPush?: string;
  lastError?: string;
  events?: string[];
}

export function StatusPanel(props: StatusPanelProps) {
  const { configDisplay } = useDemoConfig();
  const {
    managementOk,
    gameOk,
    userEmail,
    userId,
    udpConnected,
    peerCount,
    paintedCells,
    netPush,
    lastError,
    events = [],
  } = props;

  return (
    <aside className="status-panel">
      <h3>Status</h3>
      <dl>
        <dt>Management API</dt>
        <dd className={statusClass(managementOk)}>{statusText(managementOk)}</dd>
        <dt>Game API</dt>
        <dd className={statusClass(gameOk)}>{statusText(gameOk)}</dd>
        <dt>AppId</dt>
        <dd>{configDisplay.AppId}</dd>
        <dt>OrgId</dt>
        <dd>{configDisplay.OrgId}</dd>
        {userEmail !== undefined && (
          <>
            <dt>User</dt>
            <dd>{userEmail || '—'}</dd>
          </>
        )}
        {userId !== undefined && (
          <>
            <dt>User ID</dt>
            <dd className="mono">{userId || '—'}</dd>
          </>
        )}
        {udpConnected !== undefined && (
          <>
            <dt>UDP</dt>
            <dd className={udpConnected ? 'ok' : 'bad'}>
              {udpConnected ? 'Connected' : 'Disconnected'}
            </dd>
          </>
        )}
        {peerCount !== undefined && (
          <>
            <dt>Peers</dt>
            <dd data-testid="peer-count">{peerCount}</dd>
          </>
        )}
        {paintedCells !== undefined && (
          <>
            <dt>Painted cells</dt>
            <dd data-testid="paint-count">{paintedCells}</dd>
          </>
        )}
        {netPush !== undefined && (
          <>
            <dt>Net push</dt>
            <dd>{netPush || 'none'}</dd>
          </>
        )}
      </dl>
      {lastError && <p className="error">{lastError}</p>}
      {events.length > 0 && (
        <div className="event-log">
          <h4>Event log</h4>
          <pre>{events.slice(-12).join('\n')}</pre>
        </div>
      )}
      <p className="doc-link">
        <a href={`${DOCS_BASE}/intro`} target="_blank" rel="noreferrer">
          Read the docs →
        </a>
      </p>
    </aside>
  );
}

function statusClass(ok: boolean | null | undefined): string {
  if (ok === true) return 'ok';
  if (ok === false) return 'bad';
  return '';
}

function statusText(ok: boolean | null | undefined): string {
  if (ok === true) return 'Reachable';
  if (ok === false) return 'Unreachable';
  return 'Not checked';
}
