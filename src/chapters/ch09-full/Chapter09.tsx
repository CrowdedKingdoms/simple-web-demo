import { Link, useLocation } from 'react-router-dom';
import { ChapterShell } from '@/chapters/ChapterShell';
import { getChapter } from '@/chapters/registry';
import { preserveConfigSearch } from '@/config/demoConfig';

export function Chapter09() {
  const chapter = getChapter(9)!;
  const location = useLocation();
  const search = preserveConfigSearch(location.search);

  const checks = [
    { id: 'play', label: 'Full canvas game available at /canvas', passed: true },
    { id: 'docs', label: 'Documentation complete', passed: true },
  ];

  return (
    <ChapterShell
      chapter={chapter}
      checks={checks}
      status={
        <div className="summary-panel">
          <h3>You built it</h3>
          <ul>
            <li>Dev-tier connectivity</li>
            <li>Auto guest auth</li>
            <li>UDP bootstrap + subscribe</li>
            <li>Coordinate mapping</li>
            <li>Multiplayer actors</li>
            <li>Persistent voxel paint</li>
            <li>Viewport edge scroll</li>
            <li>Collaborative push</li>
          </ul>
        </div>
      }
      demo={
        <div className="connect-demo">
          <p>
            Configure your env in the bar above, then use <strong>Launch Canvas</strong>.
          </p>
          <Link to={{ pathname: '/canvas', search }} className="play-link big">
            Open collaborative canvas →
          </Link>
        </div>
      }
    >
      <p>
        Every chapter added one slice. The full canvas at{' '}
        <Link to={{ pathname: '/canvas', search }}>/canvas</Link> combines them:
        move with your mouse, paint with click, scroll at edges, and coordinate
        viewport pushes with other players.
      </p>
      <p>
        The tutorial docs in <code>cks-docs/docs-build-a-game/</code> mirror each
        chapter — a developer can rebuild this entirely from documentation alone.
      </p>
    </ChapterShell>
  );
}
