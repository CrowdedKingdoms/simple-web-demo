import { Link } from 'react-router-dom';
import { BattlePane } from '@/components/BattlePane';
import { BattleRadar } from '@/components/BattleRadar';
import { BattleThrottle } from '@/components/BattleThrottle';
import { useBattleRoyale } from '@/game/battle/useBattleRoyale';
import { CrowdySession } from '@/game/session/CrowdySession';

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function BattleRoyale() {
  const session = CrowdySession.getInstance();
  const game = useBattleRoyale();

  return (
    <div className="play-layout battle-layout">
      <header className="play-header">
        <Link to="/">← Tutorial</Link>
        <h1>Star Fox Royale</h1>
        <p>
          Star Fox flight: <strong>mouse</strong> or <strong>A/D · ←/→</strong> steer ·{' '}
          <strong>W/S · ↑/↓</strong> throttle · hold <strong>Space</strong> or <strong>click</strong>{' '}
          to laser (Esc unlocks mouse)
        </p>
      </header>
      <div className="play-body">
        <div className="play-main">
          <div className="battle-viewport">
            <BattlePane
              getSnapshot={game.getSnapshot}
              setFiring={game.setFiring}
              applySteer={game.applySteer}
            />
            <BattleThrottle throttle={game.throttle} />
            <BattleRadar
              localShip={game.localShip}
              remoteShips={game.remoteShips}
              zone={game.zone}
            />
          </div>
          <div className="battle-hud n64-hud">
            <div className="hud-stat">
              <span className="label">Shield</span>
              <span className="value">{game.localShip.hp}</span>
            </div>
            <div className="hud-stat">
              <span className="label">Kills</span>
              <span className="value">{game.localShip.kills}</span>
            </div>
            <div className="hud-stat">
              <span className="label">Pilots</span>
              <span className="value" data-testid="alive-count">
                {game.aliveCount}
              </span>
            </div>
            <div className="hud-stat">
              <span className="label">Sector</span>
              <span className="value">{formatTime(game.zone.remainingMs)}</span>
            </div>
          </div>
          {game.matchStatus === 'victory' && (
            <div className="battle-banner victory">Sector clear — you win!</div>
          )}
          {game.matchStatus === 'eliminated' && (
            <div className="battle-banner eliminated">Ship destroyed — respawn next round.</div>
          )}
        </div>
        <aside className="battle-sidebar">
          <p className="battle-user">{session.user?.email ?? 'Connecting…'}</p>
          <p className="battle-hint">
            Your Arwing stays centered and always flies forward — the nebula scrolls past like Star
            Fox 64. Steer with the mouse (click arena to lock cursor) or A/D. Throttle with W/S or
            ↑/↓ down to a crawl. Use the sector radar (top-right) for rival bearings.
          </p>
          <ol className="battle-log">
            {game.events.slice(-8).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
