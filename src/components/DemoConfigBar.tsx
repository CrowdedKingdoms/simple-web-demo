import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { preserveConfigSearch } from '@/config/demoConfig';
import { useDemoConfig } from '@/context/DemoConfigContext';

export function DemoConfigBar() {
  const location = useLocation();
  const {
    config,
    isComplete,
    connectivity,
    checking,
    applyDraft,
    recheckConnectivity,
  } = useDemoConfig();

  const [envHandle, setEnvHandle] = useState(config.envHandle);
  const [appId, setAppId] = useState(config.appId);
  const [orgId, setOrgId] = useState(config.orgId);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEnvHandle(config.envHandle);
    setAppId(config.appId);
    setOrgId(config.orgId);
  }, [config.envHandle, config.appId, config.orgId]);

  const search = preserveConfigSearch(location.search);
  const canLaunch =
    isComplete && connectivity.managementOk === true && connectivity.gameOk === true;

  const statusLabel = checking
    ? 'Checking…'
    : !isComplete
      ? 'Enter env handle'
      : connectivity.managementOk && connectivity.gameOk
        ? 'Connected'
        : 'Failed';

  const statusClass =
    checking || !isComplete
      ? 'pending'
      : connectivity.managementOk && connectivity.gameOk
        ? 'ok'
        : 'error';

  return (
    <header className="demo-config-bar">
      <div className="demo-config-fields">
        <label>
          Env handle
          <input
            type="text"
            value={envHandle}
            onChange={(e) => setEnvHandle(e.target.value)}
            placeholder="e-zt0psk82q3bi"
            data-testid="config-env-handle"
          />
        </label>
        <label>
          App ID
          <input
            type="text"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            className="short"
            data-testid="config-app-id"
          />
        </label>
        <label>
          Org ID
          <input
            type="text"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="short"
            data-testid="config-org-id"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            applyDraft({ envHandle, appId, orgId })
          }
          data-testid="config-apply"
        >
          Apply
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void recheckConnectivity()}
          disabled={!isComplete || checking}
        >
          Re-check
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!isComplete}
          onClick={() => {
            void navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
          data-testid="config-copy-link"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <span className={`config-status ${statusClass}`} data-testid="config-status">
          {statusLabel}
        </span>
      </div>
      <nav className="demo-config-launch">
        {canLaunch ? (
          <>
            <Link
              to={{ pathname: '/canvas', search }}
              className="launch-btn"
              data-testid="launch-canvas"
            >
              Launch Canvas
            </Link>
            <Link
              to={{ pathname: '/tanks', search }}
              className="launch-btn"
              data-testid="launch-tanks"
            >
              Launch Tanks
            </Link>
          </>
        ) : (
          <>
            <span className="launch-btn disabled" data-testid="launch-canvas">
              Launch Canvas
            </span>
            <span className="launch-btn disabled" data-testid="launch-tanks">
              Launch Tanks
            </span>
          </>
        )}
      </nav>
    </header>
  );
}
