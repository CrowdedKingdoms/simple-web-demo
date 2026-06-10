import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { ChapterMeta } from './registry';
import { CHAPTERS } from './registry';
import { CheckList } from '@/components/CheckList';
import type { ChapterCheck } from './registry';
import { preserveConfigSearch } from '@/config/demoConfig';

interface ChapterShellProps {
  chapter: ChapterMeta;
  children: ReactNode;
  demo: ReactNode;
  status: ReactNode;
  checks: ChapterCheck[];
}

export function ChapterShell({ chapter, children, demo, status, checks }: ChapterShellProps) {
  const location = useLocation();
  const search = preserveConfigSearch(location.search);
  const prev = CHAPTERS.find((c) => c.number === chapter.number - 1);
  const next = CHAPTERS.find((c) => c.number === chapter.number + 1);
  const allPassed = checks.every((c) => c.passed);

  return (
    <div className="chapter-layout">
      <nav className="chapter-nav">
        <Link to={{ pathname: '/', search }}>Home</Link>
        {CHAPTERS.map((c) => (
          <Link
            key={c.number}
            to={{ pathname: `/chapter/${c.number}`, search }}
            className={c.number === chapter.number ? 'active' : ''}
          >
            {c.number}
          </Link>
        ))}
      </nav>
      <header className="chapter-header">
        <p className="chapter-label">Chapter {chapter.number}</p>
        <h1>{chapter.title}</h1>
        <p className="goal">{chapter.goal}</p>
        <a
          href={`https://docs.crowdedkingdoms.com${chapter.docPath}`}
          target="_blank"
          rel="noreferrer"
          className="doc-btn"
        >
          Read doc chapter →
        </a>
      </header>
      <div className="chapter-body">
        <section className="chapter-prose">{children}</section>
        <section className="chapter-demo">{demo}</section>
        <section className="chapter-sidebar">{status}</section>
      </div>
      <footer className="chapter-footer">
        <CheckList checks={checks} />
        <div className="chapter-nav-buttons">
          {prev && <Link to={{ pathname: `/chapter/${prev.number}`, search }}>← Ch {prev.number}</Link>}
          {next && (
            <Link
              to={{ pathname: `/chapter/${next.number}`, search }}
              className={allPassed ? '' : 'disabled'}
            >
              Ch {next.number} →
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}
