import { useEffect, useRef } from 'react';
import { TANK_ARENA_SIZE, TANK_MAX_HP } from '@/game/tanks/constants';
import type { TankArenaSnapshot } from '@/game/tanks/types';

interface TankArenaViewProps {
  getSnapshot: () => TankArenaSnapshot;
}

function TankHpOverhead({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const low = hp <= maxHp * 0.35;
  const critical = hp <= maxHp * 0.15;
  return (
    <div
      className={`tank-hp-overhead${low ? ' low' : ''}${critical ? ' critical' : ''}`}
      data-testid="tank-hp-bar"
    >
      <div className="tank-hp-track">
        <div className="tank-hp-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="tank-hp-value">{hp}</span>
    </div>
  );
}

interface TankEntityProps {
  x: number;
  y: number;
  angle: number;
  color: string;
  hp: number;
  alive: boolean;
  isLocal?: boolean;
  testId?: string;
}

function TankEntity({
  x,
  y,
  angle,
  color,
  hp,
  alive,
  isLocal,
  testId,
}: TankEntityProps) {
  if (!alive) return null;

  return (
    <div
      className={`tank-entity${isLocal ? ' local' : ''}`}
      data-testid={testId}
      style={{
        left: x,
        top: y,
      }}
    >
      <TankHpOverhead hp={hp} maxHp={TANK_MAX_HP} />
      <div
        className="tank-body-rotator"
        style={{ transform: `rotate(${angle}rad)` }}
      >
        <div className="tank-body" style={{ backgroundColor: color }}>
          <span className="tank-turret" />
        </div>
      </div>
    </div>
  );
}

export function TankArenaView({ getSnapshot }: TankArenaViewProps) {
  const snapshotRef = useRef(getSnapshot);
  snapshotRef.current = getSnapshot;
  const localXRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const paint = () => {
      const snap = snapshotRef.current();
      if (localXRef.current) {
        localXRef.current.textContent = String(Math.round(snap.localTank.x));
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, []);

  const snap = getSnapshot();

  return (
    <div
      className="tank-arena"
      style={{ width: TANK_ARENA_SIZE, height: TANK_ARENA_SIZE }}
      data-testid="tank-arena"
    >
      <span className="sr-only" data-testid="local-tank-x" ref={localXRef}>
        {Math.round(snap.localTank.x)}
      </span>
      {snap.bullets.map((b) => (
        <div
          key={b.id}
          className="tank-bullet"
          style={{
            transform: `translate(${b.x - 4}px, ${b.y - 4}px)`,
          }}
        />
      ))}
      {snap.remoteTanks.map((remote) => (
        <TankEntity
          key={remote.uuid}
          x={remote.tank.x}
          y={remote.tank.y}
          angle={remote.tank.angle}
          color={remote.color}
          hp={remote.tank.hp}
          alive={remote.tank.alive}
          testId={`tank-remote-${remote.uuid.slice(0, 8)}`}
        />
      ))}
      <TankEntity
        x={snap.localTank.x}
        y={snap.localTank.y}
        angle={snap.localTank.angle}
        color={snap.localColor}
        hp={snap.localTank.hp}
        alive={snap.localTank.alive}
        isLocal
        testId="tank-local"
      />
    </div>
  );
}
