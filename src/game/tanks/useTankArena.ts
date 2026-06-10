import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TANK_ACTOR_SYNC_INTERVAL_MS } from '@/config';
import { ActorSender } from '@/game/session/ActorSender';
import { CrowdySession } from '@/game/session/CrowdySession';
import { useConfigFingerprint } from '@/context/DemoConfigContext';
import {
  getTankColorChoice,
  resolveTankColor,
  setTankColorChoice,
} from '@/game/tanks/tankColors';
import {
  TANK_ARENA_SIZE,
  TANK_BODY_SIZE,
  TANK_BULLET_LIFETIME_MS,
  TANK_BULLET_RADIUS,
  TANK_BULLET_SPEED,
  TANK_FIRE_COOLDOWN_MS,
  TANK_HIT_RADIUS,
  TANK_MAX_HP,
  TANK_REMOTE_TIMEOUT_MS,
  TANK_ROT_RAMP_DOWN,
  TANK_ROT_RAMP_UP,
  TANK_ROT_SPEED_MAX,
  TANK_ROT_SPEED_MIN,
  TANK_SHOT_DAMAGE,
  TANK_SPAWN_POINTS,
  TANK_SPEED,
} from '@/game/tanks/constants';
import { getTankActorUuid } from '@/game/tanks/tankActorUuid';
import {
  decodeTankState,
  encodeTankState,
  tankStateToPose,
  type TankState,
} from '@/game/tanks/tankState';
import {
  EVENT_TANK_FIRE,
  EVENT_TANK_HIT,
  type FirePayload,
  type HitPayload,
  type RemoteTank,
  type TankArenaSnapshot,
  type TankBullet,
} from '@/game/tanks/types';
import { worldToChunkInput } from '@/game/world/coordinates';

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

function spawnForUuid(uuid: string): TankState {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (hash * 31 + uuid.charCodeAt(i)) >>> 0;
  }
  const idx = hash % TANK_SPAWN_POINTS.length;
  const spawn = TANK_SPAWN_POINTS[idx]!;
  return {
    x: spawn.x,
    y: spawn.y,
    angle: spawn.angle,
    hp: TANK_MAX_HP,
    alive: true,
    kills: 0,
  };
}

function clampTank(tank: TankState): void {
  const margin = TANK_BODY_SIZE / 2;
  tank.x = Math.max(margin, Math.min(TANK_ARENA_SIZE - margin, tank.x));
  tank.y = Math.max(margin, Math.min(TANK_ARENA_SIZE - margin, tank.y));
}

function isSeqNewer(incoming: number, last: number | undefined): boolean {
  if (last === undefined) return true;
  const diff = (incoming - last + 256) % 256;
  return diff > 0 && diff < 128;
}

export function useTankArena() {
  const configFingerprint = useConfigFingerprint();
  const session = useMemo(
    () => CrowdySession.getInstance(),
    [configFingerprint],
  );
  const tankUuid = useMemo(() => getTankActorUuid(), [configFingerprint]);
  const [tankColor, setTankColorState] = useState(() =>
    getTankColorChoice(getTankActorUuid()),
  );
  const colorId = tankColor;

  const actorSenderRef = useRef(new ActorSender(session, TANK_ACTOR_SYNC_INTERVAL_MS));
  const remoteRef = useRef(new Map<string, RemoteTank>());
  const bulletsRef = useRef<TankBullet[]>([]);
  const keysRef = useRef(new Set<string>());
  const localTankRef = useRef<TankState>(spawnForUuid(tankUuid));
  const lastFireRef = useRef(0);
  const eventSeqRef = useRef(0);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(performance.now());
  const hitBulletsRef = useRef(new Set<string>());
  const processedHitsRef = useRef(new Set<string>());
  const turnRampRef = useRef(0);
  const turnDirRef = useRef(0);

  const [tick, setTick] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const [matchStatus, setMatchStatus] = useState<'fighting' | 'victory' | 'eliminated'>('fighting');

  const bump = useCallback(() => setTick((t) => t + 1), []);

  const setTankColor = useCallback((hex: string) => {
    setTankColorChoice(hex);
    setTankColorState(hex);
    bump();
  }, [bump]);

  useEffect(() => {
    return session.onEvent(() => setEvents([...session.events]));
  }, [session]);

  const applyHit = useCallback(
    (payload: HitPayload) => {
      if (processedHitsRef.current.has(payload.projectileId)) return;
      processedHitsRef.current.add(payload.projectileId);

      if (payload.targetUuid === tankUuid) {
        const tank = localTankRef.current;
        if (!tank.alive) return;
        tank.hp = Math.max(0, tank.hp - payload.damage);
        if (tank.hp <= 0) {
          tank.alive = false;
          setMatchStatus('eliminated');
        }
        bump();
        return;
      }
      const remote = remoteRef.current.get(payload.targetUuid);
      if (!remote || !remote.tank.alive) return;
      const wasAlive = remote.tank.alive;
      remote.tank.hp = Math.max(0, remote.tank.hp - payload.damage);
      if (wasAlive && remote.tank.hp <= 0) {
        remote.tank.alive = false;
        if (payload.projectileId.startsWith(tankUuid.slice(0, 8))) {
          localTankRef.current.kills += 1;
        }
      }
      bump();
    },
    [tankUuid, bump],
  );

  const fireBullet = useCallback(async () => {
    const tank = localTankRef.current;
    const now = performance.now();
    if (!tank.alive) return;
    if (now - lastFireRef.current < TANK_FIRE_COOLDOWN_MS) return;
    lastFireRef.current = now;

    const vx = Math.cos(tank.angle) * TANK_BULLET_SPEED;
    const vy = Math.sin(tank.angle) * TANK_BULLET_SPEED;
    const muzzle = TANK_BODY_SIZE * 0.55;
    const px = tank.x + Math.cos(tank.angle) * muzzle;
    const py = tank.y + Math.sin(tank.angle) * muzzle;
    const id = `${tankUuid.slice(0, 8)}-${eventSeqRef.current++}`;
    const payload: FirePayload = { id, ownerUuid: tankUuid, x: px, y: py, vx, vy };
    bulletsRef.current.push({
      id,
      ownerUuid: tankUuid,
      x: px,
      y: py,
      vx,
      vy,
      bornAt: now,
    });
    const { chunk } = worldToChunkInput(px, py);
    void session.sendClientEvent({
      chunk,
      eventType: EVENT_TANK_FIRE,
      state: encodeJsonPayload(payload),
      sequenceNumber: eventSeqRef.current % 256,
      distance: 8,
      decayRate: 0,
      uuid: tankUuid,
    });
    bump();
  }, [session, tankUuid, bump]);

  const broadcastHit = useCallback(
    (targetUuid: string, projectileId: string) => {
      const payload: HitPayload = {
        targetUuid,
        damage: TANK_SHOT_DAMAGE,
        projectileId,
      };
      const tank = localTankRef.current;
      const { chunk } = worldToChunkInput(tank.x, tank.y);
      void session.sendClientEvent({
        chunk,
        eventType: EVENT_TANK_HIT,
        state: encodeJsonPayload(payload),
        sequenceNumber: eventSeqRef.current++ % 256,
        distance: 8,
        decayRate: 0,
        uuid: tankUuid,
      });
      void applyHit(payload);
    },
    [session, tankUuid, applyHit],
  );

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    let cancelled = false;

    void (async () => {
      await session.ensureGuestAuth();
      await session.bootstrap();
      await session.connectUdp();
      if (cancelled) return;

      actorSenderRef.current.setActorUuid(tankUuid);
      unsubs.push(
        session.onNotification('ActorUpdateNotification', (n) => {
          if (n.__typename !== 'ActorUpdateNotification') return;
          if (n.uuid === tankUuid) return;
          const tank = decodeTankState(n.state);
          if (!tank) return;
          const seq = Number(n.sequenceNumber);
          const prev = remoteRef.current.get(n.uuid);
          if (prev && !isSeqNewer(seq, prev.lastSequence)) return;
          // Block stale pre-death updates, but allow explicit respawns (full HP + alive).
          if (prev && !prev.tank.alive) {
            const isRespawn = tank.alive && tank.hp >= TANK_MAX_HP;
            if (!isRespawn) {
              tank.alive = false;
              tank.hp = 0;
            }
          }
          const color = resolveTankColor(tank.colorId, n.uuid);
          remoteRef.current.set(n.uuid, {
            uuid: n.uuid,
            tank,
            color,
            lastSeenAt: performance.now(),
            lastSequence: seq,
          });
          bump();
        }),
      );

      unsubs.push(
        session.onNotification('ClientEventNotification', (n) => {
          if (n.__typename !== 'ClientEventNotification') return;
          if (n.eventType === EVENT_TANK_FIRE) {
            const payload = decodeJsonPayload<FirePayload>(n.state);
            if (!payload || payload.ownerUuid === tankUuid) return;
            if (bulletsRef.current.some((b) => b.id === payload.id)) return;
            bulletsRef.current.push({
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
          if (n.eventType === EVENT_TANK_HIT) {
            const payload = decodeJsonPayload<HitPayload>(n.state);
            if (!payload) return;
            // Shooter already applied this hit locally in broadcastHit.
            if (n.uuid === tankUuid) return;
            applyHit(payload);
          }
        }),
      );

      actorSenderRef.current.setStateEncoder(() =>
        encodeTankState({ ...localTankRef.current, colorId }, colorId),
      );
      actorSenderRef.current.setProvider({
        getPose: () => tankStateToPose(localTankRef.current),
      });
      actorSenderRef.current.start();
      await actorSenderRef.current.sendNow();
    })();

    return () => {
      cancelled = true;
      actorSenderRef.current.stop();
      for (const u of unsubs) u();
    };
  }, [session, tankUuid, colorId, bump, applyHit]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === ' ') {
        e.preventDefault();
        void fireBullet();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [fireBullet]);

  useEffect(() => {
    const step = (now: number) => {
      const dt = Math.min(32, now - lastFrameRef.current);
      lastFrameRef.current = now;
      const tank = localTankRef.current;
      const keys = keysRef.current;

      if (tank.alive) {
        let turn = 0;
        if (keys.has('arrowleft') || keys.has('a')) turn -= 1;
        if (keys.has('arrowright') || keys.has('d')) turn += 1;

        const frameScale = dt / 16;
        if (turn !== 0) {
          if (turnDirRef.current !== 0 && turn !== turnDirRef.current) {
            turnRampRef.current *= 0.35;
          }
          turnDirRef.current = turn;
          turnRampRef.current = Math.min(
            1,
            turnRampRef.current + TANK_ROT_RAMP_UP * frameScale,
          );
        } else {
          turnDirRef.current = 0;
          turnRampRef.current = Math.max(
            0,
            turnRampRef.current - TANK_ROT_RAMP_DOWN * frameScale,
          );
        }

        if (turn !== 0) {
          const eased =
            turnRampRef.current *
            turnRampRef.current *
            (3 - 2 * turnRampRef.current);
          const rotSpeed =
            TANK_ROT_SPEED_MIN +
            (TANK_ROT_SPEED_MAX - TANK_ROT_SPEED_MIN) * eased;
          tank.angle += turn * rotSpeed * frameScale;
        }

        let thrust = 0;
        if (keys.has('arrowup') || keys.has('w')) thrust += 1;
        if (keys.has('arrowdown') || keys.has('s')) thrust -= 1;
        if (thrust !== 0) {
          tank.x += Math.cos(tank.angle) * TANK_SPEED * thrust * (dt / 16);
          tank.y += Math.sin(tank.angle) * TANK_SPEED * thrust * (dt / 16);
          clampTank(tank);
        }
      }

      const aliveRemotes = [...remoteRef.current.values()].filter((r) => {
        return r.tank.alive && now - r.lastSeenAt <= TANK_REMOTE_TIMEOUT_MS;
      });
      for (const [uuid, remote] of remoteRef.current) {
        if (now - remote.lastSeenAt > TANK_REMOTE_TIMEOUT_MS) {
          remoteRef.current.delete(uuid);
        }
      }

      bulletsRef.current = bulletsRef.current.filter(
        (b) => now - b.bornAt < TANK_BULLET_LIFETIME_MS,
      );

      for (const bullet of bulletsRef.current) {
        if (hitBulletsRef.current.has(bullet.id)) continue;
        bullet.x += bullet.vx * (dt / 16);
        bullet.y += bullet.vy * (dt / 16);
        if (
          bullet.x < 0 ||
          bullet.y < 0 ||
          bullet.x > TANK_ARENA_SIZE ||
          bullet.y > TANK_ARENA_SIZE
        ) {
          hitBulletsRef.current.add(bullet.id);
          continue;
        }
        if (bullet.ownerUuid === tankUuid && tank.alive) {
          const dx = bullet.x - tank.x;
          const dy = bullet.y - tank.y;
          if (Math.hypot(dx, dy) < TANK_HIT_RADIUS) {
            hitBulletsRef.current.add(bullet.id);
            continue;
          }
        }
        for (const remote of aliveRemotes) {
          if (bullet.ownerUuid === remote.uuid) continue;
          if (!remote.tank.alive) continue;
          const dx = bullet.x - remote.tank.x;
          const dy = bullet.y - remote.tank.y;
          if (Math.hypot(dx, dy) < TANK_HIT_RADIUS + TANK_BULLET_RADIUS) {
            hitBulletsRef.current.add(bullet.id);
            if (bullet.ownerUuid === tankUuid) {
              broadcastHit(remote.uuid, bullet.id);
            }
            break;
          }
        }
      }

      const aliveCount =
        (tank.alive ? 1 : 0) + aliveRemotes.filter((r) => r.tank.alive).length;
      if (tank.alive && aliveCount === 1 && aliveRemotes.length > 0) {
        setMatchStatus('victory');
      }

      bump();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tankUuid, bump, broadcastHit]);

  const respawn = useCallback(async () => {
    const tank = localTankRef.current;
    if (tank.alive) return;
    const fresh = spawnForUuid(tankUuid);
    fresh.kills = tank.kills;
    fresh.hp = TANK_MAX_HP;
    fresh.alive = true;
    localTankRef.current = fresh;
    turnRampRef.current = 0;
    turnDirRef.current = 0;
    setMatchStatus('fighting');
    // Burst sync so remotes pick up the respawn promptly.
    await actorSenderRef.current.sendNow();
    await actorSenderRef.current.sendNow();
    bump();
  }, [tankUuid, bump]);

  const getSnapshot = useCallback((): TankArenaSnapshot => {
    const now = performance.now();
    const remoteTanks = [...remoteRef.current.values()].filter(
      (r) => r.tank.alive && now - r.lastSeenAt <= TANK_REMOTE_TIMEOUT_MS,
    );
    const playerCount =
      (localTankRef.current.alive ? 1 : 0) +
      remoteTanks.filter((r) => r.tank.alive).length;
    return {
      localTank: { ...localTankRef.current },
      localColor: tankColor,
      localUuid: tankUuid,
      remoteTanks: remoteTanks.map((r) => ({
        ...r,
        tank: { ...r.tank },
      })),
      bullets: bulletsRef.current.map((b) => ({ ...b })),
      playerCount,
      tick,
    };
  }, [tankColor, tankUuid, tick]);

  return {
    getSnapshot,
    events,
    matchStatus,
    respawn,
    localTank: localTankRef.current,
    tankColor,
    setTankColor,
    playerCount: getSnapshot().playerCount,
    tick,
  };
}
