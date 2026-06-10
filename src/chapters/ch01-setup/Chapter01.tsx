import { useCallback, useEffect, useState } from 'react';
import { ChapterShell } from '@/chapters/ChapterShell';
import { getChapter } from '@/chapters/registry';
import { StatusPanel } from '@/components/StatusPanel';
import { useDemoConfig } from '@/context/DemoConfigContext';
import { CrowdySession } from '@/game/session/CrowdySession';

export function Chapter01() {
  const chapter = getChapter(1)!;
  const { configDisplay, isComplete } = useDemoConfig();
  const [mgmt, setMgmt] = useState<boolean | null>(null);
  const [game, setGame] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const runCheck = useCallback(async () => {
    if (!isComplete) {
      setMgmt(null);
      setGame(null);
      return;
    }
    setChecking(true);
    const session = CrowdySession.getInstance();
    const result = await session.checkConnectivity();
    setMgmt(result.managementOk);
    setGame(result.gameOk);
    setChecking(false);
  }, [isComplete]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const checks = [
    { id: 'mgmt', label: 'Management API reachable', passed: mgmt === true },
    { id: 'game', label: 'Game API reachable', passed: game === true },
    {
      id: 'config',
      label: 'Env handle configured',
      passed: isComplete && configDisplay.AppId.length > 0,
    },
  ];

  return (
    <ChapterShell
      chapter={chapter}
      checks={checks}
      status={
        <StatusPanel managementOk={mgmt} gameOk={game} />
      }
      demo={
        <div className="connect-demo">
          <p className="config-hint">
            Enter your devbox env handle in the bar above, click <strong>Apply</strong>,
            then re-check connectivity.
          </p>
          <pre className="config-block">{JSON.stringify(configDisplay, null, 2)}</pre>
          <button type="button" onClick={() => void runCheck()} disabled={checking || !isComplete}>
            {checking ? 'Checking…' : 'Re-check connectivity'}
          </button>
        </div>
      }
    >
      <p>
        Crowded Kingdoms splits <strong>identity</strong> (Management API) from{' '}
        <strong>gameplay</strong> (Game API). This chapter verifies both dev-tier
        endpoints are reachable before we write any game code.
      </p>
      <p>
        Use the config bar to set your env handle, App ID, and Org ID. Those values
        are encoded in the page URL so you can share a link with teammates on the
        same dev environment.
      </p>
    </ChapterShell>
  );
}
