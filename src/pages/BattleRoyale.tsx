import { Link } from 'react-router-dom';
import { BattlePane } from '@/components/BattlePane';
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
          Click the arena first, then fly: <strong>W</strong> boost · <strong>A/D</strong> turn ·{' '}
          <strong>S</strong> brake · mouse aim · click or space to fire.
        </p>
      </header>
      <div className="play-body">
        <div className="play-main">
          <BattlePane
            renderOptions={{
              viewport: game.viewport,
              localShip: game.localShip,
              remoteShips: game.remoteShips,
              projectiles: game.projectiles,
              zone: game.zone,
            }}
            onAim={game.handleAim}
            onFire={game.handleFire}
          />
          <div className="battle-hud">
            <div className="hud-stat">
              <span className="label">HP</span>
              <span className="value">{game.localShip.hp}</span>
            </div>
            <div className="hud-stat">
              <span className="label">Kills</span>
              <span className="value">{game.localShip.kills}</span>
            </div>
            <div className="hud-stat">
              <span className="label">Pilots left</span>
              <span className="value" data-testid="alive-count">
                {game.aliveCount}
              </span>
            </div>
            <div className="hud-stat">
              <span className="label">Sector closes</span>
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
            Fly like Star Fox: boost into the fight, bank with A/D, and blast rivals before the
            outer nebula closes in.
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
