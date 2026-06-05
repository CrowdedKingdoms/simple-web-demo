import type { Viewport } from '@/game/world/Viewport';
import type { Projectile, RemoteShip } from '@/game/battle/types';
import type { ShipState } from '@/game/battle/shipState';
import type { ZoneState } from '@/game/battle/zone';

export interface BattleRenderOptions {
  viewport: Viewport;
  localShip: ShipState;
  remoteShips: RemoteShip[];
  projectiles: Projectile[];
  zone: ZoneState;
}

function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  for (let i = 0; i < 80; i++) {
    const x = ((seed + i * 97) % 1000) / 1000 * w;
    const y = ((seed + i * 53) % 1000) / 1000 * h;
    const alpha = 0.2 + ((i * 17) % 50) / 100;
    ctx.fillStyle = `rgba(200,220,255,${alpha})`;
    ctx.fillRect(x, y, 1 + (i % 2), 1 + (i % 2));
  }
}

export class BattleRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
  }

  render(opts: BattleRenderOptions): void {
    const { viewport, localShip, remoteShips, projectiles, zone } = opts;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#050510');
    grad.addColorStop(1, '#10183a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    drawStarfield(ctx, w, h, Math.floor(viewport.x + viewport.y));

    this.drawZone(ctx, zone, viewport, w, h);

    for (const remote of remoteShips) {
      if (remote.ship.alive) {
        this.drawShip(ctx, remote.ship, viewport, remote.color, false);
        this.drawHealthBar(ctx, remote.ship, viewport, remote.color);
      } else {
        this.drawWreck(ctx, remote.ship, viewport);
      }
    }

    for (const p of projectiles) {
      this.drawLaser(ctx, p, viewport);
    }

    if (localShip.alive) {
      this.drawShip(ctx, localShip, viewport, '#ffffff', true);
      this.drawHealthBar(ctx, localShip, viewport, '#7eb8ff');
    } else {
      this.drawWreck(ctx, localShip, viewport);
    }
  }

  private drawZone(
    ctx: CanvasRenderingContext2D,
    zone: ZoneState,
    viewport: Viewport,
    w: number,
    h: number,
  ): void {
    const { x, y } = viewport.worldToScreen(zone.centerX, zone.centerY);
    const screenRadius = zone.radius;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(x, y, screenRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(8, 4, 20, 0.72)';
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(120, 180, 255, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, screenRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawShip(
    ctx: CanvasRenderingContext2D,
    ship: ShipState,
    viewport: Viewport,
    color: string,
    isLocal: boolean,
  ): void {
    const { x, y } = viewport.worldToScreen(ship.worldX, ship.worldY);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ship.angle);

    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, -10);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isLocal ? '#fff' : 'rgba(0,0,0,0.5)';
    ctx.lineWidth = isLocal ? 2 : 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-20, 0);
    ctx.strokeStyle = 'rgba(255, 160, 60, 0.75)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  }

  private drawWreck(
    ctx: CanvasRenderingContext2D,
    ship: ShipState,
    viewport: Viewport,
  ): void {
    const { x, y } = viewport.worldToScreen(ship.worldX, ship.worldY);
    ctx.fillStyle = 'rgba(255,80,40,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawLaser(
    ctx: CanvasRenderingContext2D,
    p: Projectile,
    viewport: Viewport,
  ): void {
    const { x, y } = viewport.worldToScreen(p.x, p.y);
    const angle = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffee88';
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 8;
    ctx.fillRect(-10, -2, 14, 4);
    ctx.restore();
  }

  private drawHealthBar(
    ctx: CanvasRenderingContext2D,
    ship: ShipState,
    viewport: Viewport,
    color: string,
  ): void {
    const { x, y } = viewport.worldToScreen(ship.worldX, ship.worldY);
    const width = 28;
    const height = 4;
    const pct = ship.hp / 100;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - width / 2, y - 22, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(x - width / 2, y - 22, width * pct, height);
  }
}
