import { Link, useLocation } from 'react-router-dom';
import { preserveConfigSearch } from '@/config/demoConfig';
import { TankArenaView } from '@/components/TankArenaView';
import { TankColorPicker } from '@/components/TankColorPicker';
import { useTankArena } from '@/game/tanks/useTankArena';

export function TankArena() {
  const location = useLocation();
  const search = preserveConfigSearch(location.search);
  const game = useTankArena();
  const snap = game.getSnapshot();

  return (
    <div className="play-layout tank-layout">
      <header className="play-header">
        <Link to={{ pathname: '/', search }}>← Tutorial</Link>
        <h1>Tank Arena</h1>
        <p>
          Top-down tanks for up to four players. <strong>A/D</strong> or{' '}
          <strong>left/right</strong> steer · <strong>W/S</strong> or{' '}
          <strong>up/down</strong> drive · <strong>Space</strong> fires.
        </p>
      </header>
      <div className="play-body tank-play-body">
        <div className="play-main">
          <div className="tank-arena-wrap">
            <TankArenaView getSnapshot={game.getSnapshot} />
            {game.matchStatus === 'eliminated' && (
              <div className="tank-respawn-overlay">
                <p>Tank destroyed</p>
                <button
                  type="button"
                  className="tank-respawn-btn"
                  data-testid="tank-respawn"
                  onClick={() => void game.respawn()}
                >
                  Respawn
                </button>
              </div>
            )}
          </div>
          <div className="tank-hud">
            <div className="hud-stat">
              <span className="label">HP</span>
              <span className="value">{snap.localTank.hp}</span>
            </div>
            <div className="hud-stat">
              <span className="label">Kills</span>
              <span className="value">{snap.localTank.kills}</span>
            </div>
            <div className="hud-stat">
              <span className="label">Players</span>
              <span className="value" data-testid="player-count">
                {snap.playerCount}
              </span>
            </div>
          </div>
          {game.matchStatus === 'victory' && (
            <div className="battle-banner victory">Arena clear — you win!</div>
          )}
        </div>
        <TankColorPicker
          selected={game.tankColor}
          onSelect={game.setTankColor}
        />
      </div>
    </div>
  );
}
