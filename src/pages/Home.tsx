import { Link } from 'react-router-dom';
import { CHAPTERS } from '@/chapters/registry';

export function Home() {
  return (
    <div className="home">
      <header>
        <h1>Star Fox Royale</h1>
        <p>
          A Star Fox–style space battle royale on Crowded Kingdoms — blast rivals,
          dodge the shrinking sector, and be the last fighter flying. The chapters
          below walk through how it was built.
        </p>
        <Link to="/play" className="play-link big">
          Launch battle royale →
        </Link>
        <Link to="/canvas" className="play-link secondary">
          Open collaborative canvas →
        </Link>
      </header>
      <ol className="chapter-list">
        {CHAPTERS.map((c) => (
          <li key={c.number}>
            <Link to={`/chapter/${c.number}`}>
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
