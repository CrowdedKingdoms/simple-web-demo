import type { ComponentType } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { DemoConfigBar } from '@/components/DemoConfigBar';
import { DemoConfigProvider } from '@/context/DemoConfigContext';
import { Home } from '@/pages/Home';
import { Chapter01 } from '@/chapters/ch01-setup/Chapter01';
import { Chapter02 } from '@/chapters/ch02-auth/Chapter02';
import { Chapter03 } from '@/chapters/ch03-connect/Chapter03';
import { Chapter04 } from '@/chapters/ch04-coords/Chapter04';
import { Chapter05 } from '@/chapters/ch05-actors/Chapter05';
import { Chapter06 } from '@/chapters/ch06-paint/Chapter06';
import { Chapter07 } from '@/chapters/ch07-viewport/Chapter07';
import { Chapter08 } from '@/chapters/ch08-collab/Chapter08';
import { Chapter09 } from '@/chapters/ch09-full/Chapter09';
import { FullGame } from '@/chapters/ch09-full/FullGame';
import { TankArena } from '@/pages/TankArena';

const CHAPTER_MAP: Record<number, ComponentType> = {
  1: Chapter01,
  2: Chapter02,
  3: Chapter03,
  4: Chapter04,
  5: Chapter05,
  6: Chapter06,
  7: Chapter07,
  8: Chapter08,
  9: Chapter09,
};

function ChapterRoute() {
  const { n } = useParams();
  const num = Number(n);
  const Component = CHAPTER_MAP[num];
  if (!Component) return <Navigate to="/" replace />;
  return <Component />;
}

function AppRoutes() {
  return (
    <>
      <DemoConfigBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chapter/:n" element={<ChapterRoute />} />
        <Route path="/tanks" element={<TankArena />} />
        <Route path="/canvas" element={<FullGame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <DemoConfigProvider>
      <AppRoutes />
    </DemoConfigProvider>
  );
}
