import { Link, useLocation } from 'react-router-dom';
import { preserveConfigSearch } from '@/config/demoConfig';
import { DemoPane } from '@/components/DemoPane';
import { StatusPanel } from '@/components/StatusPanel';
import { useGameDemo } from '@/game/useGameDemo';
import { CrowdySession } from '@/game/session/CrowdySession';

export function FullGame() {
  const location = useLocation();
  const search = preserveConfigSearch(location.search);
  const session = CrowdySession.getInstance();
  const game = useGameDemo('full');

  return (
    <div className="play-layout">
      <header className="play-header">
        <Link to={{ pathname: '/', search }}>← Tutorial</Link>
        <h1>Collaborative Canvas</h1>
        <p>Paint together. Push the viewport from the edges. Forever.</p>
      </header>
      <div className="play-body">
        <div className="play-main">
          <div className="palette">
            {game.palette.map((c, i) => (
              <button
                key={c.voxelType}
                type="button"
                className={i === game.selectedIdx ? 'selected' : ''}
                style={{ background: `rgb(${c.r},${c.g},${c.b})` }}
                onClick={() => game.setSelectedIdx(i)}
              />
            ))}
          </div>
          <DemoPane
            renderOptions={{
              viewport: game.viewport,
              localPose: game.localPose,
              remoteActors: game.remoteActors,
              voxelStore: game.voxelStore,
              showGrid: game.showGrid,
            }}
            onPointerMove={game.handlePointerMove}
            onClick={(x, y) => void game.handleClick(x, y)}
          />
        </div>
        <StatusPanel
          userEmail={session.user?.email}
          udpConnected
          peerCount={game.peerCount}
          paintedCells={game.paintCount}
          netPush={game.netPushLabel}
          events={game.events}
        />
      </div>
    </div>
  );
}
