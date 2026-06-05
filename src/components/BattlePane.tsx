import { useEffect, useRef } from 'react';
import { ThreeBattleScene } from '@/game/render/ThreeBattleScene';
import type { BattleSceneSnapshot } from '@/game/battle/types';

interface BattlePaneProps {
  getSnapshot: () => BattleSceneSnapshot;
  setFiring?: (active: boolean) => void;
  applySteer?: (dx: number, dy: number) => void;
  width?: number;
  height?: number;
}

export function BattlePane({
  getSnapshot,
  setFiring,
  applySteer,
  width = 640,
  height = 480,
}: BattlePaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ThreeBattleScene | null>(null);
  const snapshotRef = useRef(getSnapshot);
  const steerRef = useRef(applySteer);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  snapshotRef.current = getSnapshot;
  steerRef.current = applySteer;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new ThreeBattleScene(host);
    sceneRef.current = scene;
    scene.startLoop(() => snapshotRef.current());

    const onResize = () => scene.resize();
    window.addEventListener('resize', onResize);

    const steerFromDelta = (dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return;
      steerRef.current?.(dx, dy);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement === host) {
        steerFromDelta(e.movementX, e.movementY);
        return;
      }
      if (lastPointerRef.current) {
        steerFromDelta(
          e.clientX - lastPointerRef.current.x,
          e.clientY - lastPointerRef.current.y,
        );
      }
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      host.focus();
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      setFiring?.(true);
      void host.requestPointerLock();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      setFiring?.(false);
    };

    const onPointerLeave = () => {
      lastPointerRef.current = null;
      setFiring?.(false);
    };

    const onPointerLockChange = () => {
      if (document.pointerLockElement !== host) {
        lastPointerRef.current = null;
      }
    };

    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointerup', onPointerUp);
    host.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      window.removeEventListener('resize', onResize);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointerup', onPointerUp);
      host.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [setFiring]);

  return (
    <div className="battle-pane demo-pane" style={{ width, height }}>
      <div ref={hostRef} className="battle-3d-host" tabIndex={0} aria-label="Star Fox 3D arena" />
    </div>
  );
}
