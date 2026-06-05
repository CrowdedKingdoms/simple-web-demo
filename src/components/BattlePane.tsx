import { useEffect, useRef } from 'react';
import type { BattleRenderOptions } from '@/game/render/BattleRenderer';
import { BattleRenderer } from '@/game/render/BattleRenderer';

interface BattlePaneProps {
  renderOptions: BattleRenderOptions;
  onAim?: (worldX: number, worldY: number) => void;
  onFire?: () => void;
  width?: number;
  height?: number;
}

export function BattlePane({
  renderOptions,
  onAim,
  onFire,
  width = 640,
  height = 480,
}: BattlePaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BattleRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current = new BattleRenderer(canvas);
    rendererRef.current.resize();
  }, []);

  useEffect(() => {
    rendererRef.current?.render(renderOptions);
  }, [renderOptions]);

  const pointerToWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return renderOptions.viewport.screenToWorld(sx, sy);
  };

  return (
    <div className="battle-pane demo-pane" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerMove={(e) => {
          const world = pointerToWorld(e.clientX, e.clientY);
          if (world) onAim?.(world.x, world.y);
        }}
        onPointerDown={(e) => {
          const world = pointerToWorld(e.clientX, e.clientY);
          if (world) onAim?.(world.x, world.y);
          onFire?.();
        }}
      />
    </div>
  );
}
