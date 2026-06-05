import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CrowdySession } from '@/game/session/CrowdySession';
import { ActorSender } from '@/game/session/ActorSender';
import { Viewport } from '@/game/world/Viewport';
import { actorColorForUuid } from '@/game/render/CanvasRenderer';
import {
  BATTLE_FIRE_COOLDOWN_MS,
  BATTLE_PROJECTILE_LIFETIME_MS,
  BATTLE_PROJECTILE_SPEED,
  BATTLE_SHIP_ACCEL,
  BATTLE_SHIP_DRAG,
  BATTLE_SHIP_MAX_SPEED,
  BATTLE_SHOT_DAMAGE,
  BATTLE_ZONE_DAMAGE_PER_SEC,
} from '@/config';
import { worldToChunkInput } from '@/game/world/coordinates';
import {
  decodeShipState,
  encodeShipState,
  shipStateToPose,
  type ShipState,
} from '@/game/battle/shipState';
import { distanceToZoneEdge, getMatchStartMs, getZoneState } from '@/game/battle/zone';
import { randomSpawn } from '@/game/battle/spawn';
import {
  EVENT_FIRE,
  EVENT_HIT,
  type FireEventPayload,
  type HitEventPayload,
  type Projectile,
  type RemoteShip,
} from '@/game/battle/types';

function encodeJsonPayload(payload: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function decodeJsonPayload<T>(state: string): T | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(state)))) as T;
  } catch {
    return null;
  }
}

export function useBattleRoyale() {
  const session = useMemo(() => CrowdySession.getInstance(), []);
  const viewportRef = useRef(new Viewport());
  const actorSenderRef = useRef(new ActorSender(session));
  const remoteRef = useRef(new Map<string, RemoteShip>());
  const projectilesRef = useRef<Projectile[]>([]);
  const keysRef = useRef(new Set<string>());
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const localShipRef = useRef<ShipState>(randomSpawn(session.actorUuid));
  const aimAngleRef = useRef(0);
  const lastFireRef = useRef(0);
  const eventSeqRef = useRef(0);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(performance.now());
  const hitProjectilesRef = useRef(new Set<string>());
  const matchStartRef = useRef(getMatchStartMs());
  const everHadOpponentRef = useRef(false);
  const matchStatusRef = useRef<'fighting' | 'victory' | 'eliminated'>('fighting');

  const [tick, setTick] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const [matchStatus, setMatchStatus] = useState<'fighting' | 'victory' | 'eliminated'>('fighting');

  const setMatch = useCallback((status: 'fighting' | 'victory' | 'eliminated') => {
    matchStatusRef.current = status;
    setMatchStatus(status);
  }, []);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    return session.onEvent(() => setEvents([...session.events]));
  }, [session]);

  const fireProjectile = useCallback(
    async (ship: ShipState) => {
      const now = performance.now();
      if (now - lastFireRef.current < BATTLE_FIRE_COOLDOWN_MS) return;
      if (!ship.alive) return;
      lastFireRef.current = now;

      const id = `${session.actorUuid.slice(0, 8)}-${eventSeqRef.current++}`;
      const vx = Math.cos(ship.angle) * BATTLE_PROJECTILE_SPEED;
      const vy = Math.sin(ship.angle) * BATTLE_PROJECTILE_SPEED;
      const payload: FireEventPayload = {
        id,
        ownerUuid: session.actorUuid,
        x: ship.worldX,
        y: ship.worldY,
        vx,
        vy,
      };
      projectilesRef.current.push({
        id,
        ownerUuid: session.actorUuid,
        x: ship.worldX,
        y: ship.worldY,
        vx,
        vy,
        bornAt: now,
      });
      const { chunk } = worldToChunkInput(ship.worldX, ship.worldY);
      await session.sendClientEvent({
        chunk,
        eventType: EVENT_FIRE,
        state: encodeJsonPayload(payload),
        sequenceNumber: eventSeqRef.current % 256,
        distance: 8,
      });
      bump();
    },
    [session, bump],
  );

  const applyHit = useCallback(
    async (payload: HitEventPayload) => {
      if (hitProjectilesRef.current.has(payload.projectileId)) return;
      hitProjectilesRef.current.add(payload.projectileId);

      if (payload.targetUuid === session.actorUuid) {
        const ship = localShipRef.current;
        if (!ship.alive) return;
        ship.hp = Math.max(0, ship.hp - payload.damage);
        if (ship.hp <= 0) {
          ship.alive = false;
          setMatch('eliminated');
        }
        bump();
        return;
      }

      const remote = remoteRef.current.get(payload.targetUuid);
      if (!remote || !remote.ship.alive) return;
      remote.ship.hp = Math.max(0, remote.ship.hp - payload.damage);
      if (remote.ship.hp <= 0) {
        remote.ship.alive = false;
        const killer = remoteRef.current.get(session.actorUuid);
        if (killer && payload.projectileId.startsWith(session.actorUuid.slice(0, 8))) {
          localShipRef.current.kills += 1;
        }
      }
      bump();
    },
    [session, bump],
  );

  useEffect(() => {
    void (async () => {
      await session.ensureGuestAuth();
      await session.bootstrap();
      await session.connectUdp();

      session.onNotification('ActorUpdateNotification', (n) => {
        if (n.__typename !== 'ActorUpdateNotification') return;
        if (n.uuid === session.actorUuid) return;
        const ship = decodeShipState(n.state);
        if (!ship) return;
        remoteRef.current.set(n.uuid, {
          uuid: n.uuid,
          ship,
          color: actorColorForUuid(n.uuid),
        });
        bump();
      });

      session.onNotification('ClientEventNotification', (n) => {
        if (n.__typename !== 'ClientEventNotification') return;
        if (n.eventType === EVENT_FIRE) {
          const payload = decodeJsonPayload<FireEventPayload>(n.state);
          if (!payload || payload.ownerUuid === session.actorUuid) return;
          if (projectilesRef.current.some((p) => p.id === payload.id)) return;
          projectilesRef.current.push({
            id: payload.id,
            ownerUuid: payload.ownerUuid,
            x: payload.x,
            y: payload.y,
            vx: payload.vx,
            vy: payload.vy,
            bornAt: performance.now(),
          });
          bump();
          return;
        }
        if (n.eventType === EVENT_HIT) {
          const payload = decodeJsonPayload<HitEventPayload>(n.state);
          if (!payload) return;
          void applyHit(payload);
        }
      });

      actorSenderRef.current.setStateEncoder((pose) =>
        encodeShipState({
          ...localShipRef.current,
          worldX: pose.worldX,
          worldY: pose.worldY,
        }),
      );
      actorSenderRef.current.setProvider({
        getPose: () => shipStateToPose(localShipRef.current),
      });
      actorSenderRef.current.start();
      await actorSenderRef.current.sendNow();
      bump();
    })();

    return () => {
      actorSenderRef.current.stop();
    };
  }, [session, bump, applyHit]);

  const trackKey = useCallback((e: KeyboardEvent, down: boolean) => {
    const codeMap: Record<string, string> = {
      KeyW: 'w',
      KeyA: 'a',
      KeyS: 's',
      KeyD: 'd',
    };
    const key = codeMap[e.code] ?? e.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
      if (down) keysRef.current.add(key);
      else keysRef.current.delete(key);
      e.preventDefault();
    }
    if (down && (e.key === ' ' || e.code === 'Space')) {
      e.preventDefault();
      void fireProjectile(localShipRef.current);
    }
  }, [fireProjectile]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => trackKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => trackKey(e, false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [trackKey]);

  useEffect(() => {
    const loop = (now: number) => {
      const dt = Math.min(32, now - lastFrameRef.current) / 16.67;
      lastFrameRef.current = now;

      const roundStart = getMatchStartMs();
      if (roundStart !== matchStartRef.current) {
        matchStartRef.current = roundStart;
        localShipRef.current = randomSpawn(session.actorUuid);
        velocityRef.current = { vx: 0, vy: 0 };
        projectilesRef.current = [];
        hitProjectilesRef.current.clear();
        everHadOpponentRef.current = false;
        setMatch('fighting');
      }

      const ship = localShipRef.current;
      const zone = getZoneState();
      const keys = keysRef.current;
      const vel = velocityRef.current;
      const status = matchStatusRef.current;

      if (ship.alive && status !== 'eliminated') {
        let thrust = 0;
        if (keys.has('w')) thrust += 1;
        if (keys.has('s')) thrust -= 0.6;
        if (thrust !== 0) {
          vel.vx += Math.cos(ship.angle) * BATTLE_SHIP_ACCEL * thrust * dt;
          vel.vy += Math.sin(ship.angle) * BATTLE_SHIP_ACCEL * thrust * dt;
        }
        if (keys.has('a')) ship.angle -= 0.06 * dt;
        if (keys.has('d')) ship.angle += 0.06 * dt;

        vel.vx *= BATTLE_SHIP_DRAG;
        vel.vy *= BATTLE_SHIP_DRAG;
        const speed = Math.hypot(vel.vx, vel.vy);
        if (speed > BATTLE_SHIP_MAX_SPEED) {
          const scale = BATTLE_SHIP_MAX_SPEED / speed;
          vel.vx *= scale;
          vel.vy *= scale;
        }
        ship.worldX += vel.vx * dt;
        ship.worldY += vel.vy * dt;

        const edge = distanceToZoneEdge(ship.worldX, ship.worldY, zone);
        if (edge < 0) {
          ship.hp = Math.max(0, ship.hp - (BATTLE_ZONE_DAMAGE_PER_SEC * dt) / 60);
          if (ship.hp <= 0) {
            ship.alive = false;
            setMatch('eliminated');
          }
        }
      }

      viewportRef.current.followActor(ship.worldX, ship.worldY);

      const aliveRemotes = [...remoteRef.current.values()].filter((r) => r.ship.alive);
      if (remoteRef.current.size > 0) {
        everHadOpponentRef.current = true;
      }
      if (
        ship.alive &&
        everHadOpponentRef.current &&
        aliveRemotes.length === 0 &&
        status === 'fighting'
      ) {
        setMatch('victory');
      }

      const projectiles = projectilesRef.current;
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (performance.now() - p.bornAt > BATTLE_PROJECTILE_LIFETIME_MS) {
          projectiles.splice(i, 1);
          continue;
        }

        if (p.ownerUuid !== session.actorUuid) continue;

        const targets = aliveRemotes.map((r) => ({ uuid: r.uuid, ship: r.ship }));
        for (const target of targets) {
          if (!target.ship.alive) continue;
          const dist = Math.hypot(p.x - target.ship.worldX, p.y - target.ship.worldY);
          if (dist > 18) continue;
          if (hitProjectilesRef.current.has(p.id)) continue;

          const payload: HitEventPayload = {
            projectileId: p.id,
            targetUuid: target.uuid,
            damage: BATTLE_SHOT_DAMAGE,
          };
          const { chunk } = worldToChunkInput(p.x, p.y);
          void session.sendClientEvent({
            chunk,
            eventType: EVENT_HIT,
            state: encodeJsonPayload(payload),
            sequenceNumber: eventSeqRef.current++ % 256,
            distance: 8,
          });
          void applyHit(payload);
          if (target.ship.hp <= 0) {
            localShipRef.current.kills += 1;
          }
          projectiles.splice(i, 1);
          break;
        }
      }

      bump();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [session, bump, applyHit, setMatch]);

  const handleAim = (worldX: number, worldY: number) => {
    const ship = localShipRef.current;
    aimAngleRef.current = Math.atan2(worldY - ship.worldY, worldX - ship.worldX);
    ship.angle = aimAngleRef.current;
    bump();
  };

  const handleFire = () => {
    void fireProjectile(localShipRef.current);
  };

  const zone = getZoneState();
  const remoteShips = [...remoteRef.current.values()];
  const aliveCount =
    (localShipRef.current.alive ? 1 : 0) +
    remoteShips.filter((r) => r.ship.alive).length;

  return {
    viewport: viewportRef.current,
    localShip: localShipRef.current,
    remoteShips,
    projectiles: projectilesRef.current,
    zone,
    aliveCount,
    matchStatus,
    events,
    velocity: velocityRef.current,
    handleAim,
    handleFire,
    tick,
  };
}
