import { Link } from 'react-router-dom';
import { preserveConfigSearch } from '@/config/demoConfig';
import { CHAPTERS } from '@/chapters/registry';
import { useLocation } from 'react-router-dom';

export function Home() {
  const location = useLocation();
  const search = preserveConfigSearch(location.search);

  return (
    <div className="home">
      <header>
        <h1>Crowded Kingdoms Web Demo</h1>
        <p>
          Step through nine tutorial chapters to learn how CrowdyJS connects a
          browser game to your dev environment. When your env handle is configured
          in the bar above, launch the collaborative canvas or the tank arena.
        </p>
      </header>
      <ol className="chapter-list">
        {CHAPTERS.map((c) => (
          <li key={c.number}>
            <Link to={{ pathname: `/chapter/${c.number}`, search }}>
              <span className="num">Chapter {c.number}</span>
              <span className="title">{c.title}</span>
              <span className="goal">{c.goal}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
