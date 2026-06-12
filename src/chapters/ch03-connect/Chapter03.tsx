import { useCallback, useEffect, useState } from 'react';
import { ChapterShell } from '@/chapters/ChapterShell';
import { getChapter } from '@/chapters/registry';
import { StatusPanel } from '@/components/StatusPanel';
import { CrowdySession } from '@/game/session/CrowdySession';

export function Chapter03() {
  const chapter = getChapter(3)!;
  const session = CrowdySession.getInstance();
  const [udpOk, setUdpOk] = useState(false);
  const [bootOk, setBootOk] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState('');

  const connect = useCallback(async () => {
    setError('');
    try {
      await session.ensureGuestAuth();
      await session.ensureAppAccess();
      const boot = await session.bootstrap();
      setBootOk(true);
      const connected = await session.connectUdp();
      setUdpOk(connected || boot.udpConnected);
      setEvents([...session.events]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [session]);

  useEffect(() => {
    void connect();
    return session.onEvent(() => setEvents([...session.events]));
  }, [connect, session]);

  const checks = [
    { id: 'boot', label: 'gameClientBootstrap succeeded', passed: bootOk },
    { id: 'udp', label: 'UDP proxy connected', passed: udpOk },
    { id: 'sub', label: 'Subscription registered', passed: events.some((e) => e.includes('subscription')) },
  ];

  return (
    <ChapterShell
      chapter={chapter}
      checks={checks}
      status={
        <StatusPanel
          userEmail={session.user?.email}
          udpConnected={udpOk}
          lastError={error}
          events={events}
        />
      }
      demo={
        <div className="connect-demo">
          <button type="button" onClick={() => void connect()}>
            Reconnect UDP
          </button>
          <pre className="event-feed">{events.slice(-20).join('\n') || 'Waiting for events…'}</pre>
        </div>
      }
    >
      <p>
        After auth, call <code>gameClientBootstrap(appId)</code> for version limits
        and UDP status, then <code>udp.connect()</code> and{' '}
        <code>udp.subscribe()</code> for realtime notifications.
      </p>
      <p>The event feed below shows every notification type as it arrives.</p>
    </ChapterShell>
  );
}
