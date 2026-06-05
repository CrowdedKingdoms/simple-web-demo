import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CrowdySession } from '@/game/session/CrowdySession';
import { ActorSender } from '@/game/session/ActorSender';
import { actorColorForUuid } from '@/game/render/CanvasRenderer';
import {
  BATTLE_FIRE_COOLDOWN_MS,
  BATTLE_LASER_MUZZLE_OFFSET,
  BATTLE_MAX_PITCH,
  BATTLE_MOUSE_SENSITIVITY,
  BATTLE_PITCH_RATE,
  BATTLE_PROJECTILE_LIFETIME_MS,
  BATTLE_PROJECTILE_SPEED,
  BATTLE_THROTTLE_DEFAULT,
  BATTLE_THROTTLE_MAX_SPEED,
  BATTLE_THROTTLE_MIN_SPEED,
  BATTLE_THROTTLE_RATE,
  BATTLE_SHOT_DAMAGE,
  BATTLE_YAW_RATE,
  BATTLE_ZONE_DAMAGE_PER_SEC,
} from '@/config';
import { worldToChunkInput } from '@/game/world/coordinates';
import {
  decodeShipState,
  encodeShipState,
  shipStateToPose,
  type ShipState,
} from '@/game/battle/shipState';
import { distance3, shipForward } from '@/game/battle/flight';
import { distanceToZoneEdge, getMatchStartMs, getZoneState } from '@/game/battle/zone';
import { randomSpawn } from '@/game/battle/spawn';
import {
  listBattleFires,
  listBattlePeers,
  postBattleFire,
  postBattlePresence,
} from '@/game/battle/battlePresence';
import {
  EVENT_FIRE,
  EVENT_HIT,
  type BattleSceneSnapshot,
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

function chunkAt(x: number, z: number) {
  return worldToChunkInput(x, z);
}

export function useBattleRoyale() {
  const session = useMemo(() => CrowdySession.getInstance(), []);
  const actorSenderRef = useRef(new ActorSender(session));
  const remoteRef = useRef(new Map<string, RemoteShip>());
  const projectilesRef = useRef<Projectile[]>([]);
  const keysRef = useRef(new Set<string>());
  const steerRef = useRef({ yaw: 0, pitch: 0 });
  const throttleRef = useRef(BATTLE_THROTTLE_DEFAULT);
  const localShipRef = useRef<ShipState>(randomSpawn(session.actorUuid));
  const lastFireRef = useRef(0);
  const eventSeqRef = useRef(0);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(performance.now());
  const hitProjectilesRef = useRef(new Set<string>());
  const firingRef = useRef(false);
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

      const fwd = shipForward(ship);
      const id = `${session.actorUuid.slice(0, 8)}-${eventSeqRef.current++}`;
      const vx = fwd.x * BATTLE_PROJECTILE_SPEED;
      const vy = fwd.y * BATTLE_PROJECTILE_SPEED;
      const vz = fwd.z * BATTLE_PROJECTILE_SPEED;
      const muzzle = BATTLE_LASER_MUZZLE_OFFSET;
      const px = ship.worldX + fwd.x * muzzle;
      const py = ship.worldY + fwd.y * muzzle;
      const pz = ship.worldZ + fwd.z * muzzle;
      const payload: FireEventPayload = {
        id,
        ownerUuid: session.actorUuid,
        x: px,
        y: py,
        z: pz,
        vx,
        vy,
        vz,
      };
      projectilesRef.current.push({
        id,
        ownerUuid: session.actorUuid,
        x: px,
        y: py,
        z: pz,
        vx,
        vy,
        vz,
        bornAt: now,
      });
      const { chunk } = chunkAt(px, pz);
      void session.sendClientEvent({
        chunk,
        eventType: EVENT_FIRE,
        state: encodeJsonPayload(payload),
        sequenceNumber: eventSeqRef.current % 256,
        distance: 8,
      });
      void postBattleFire(payload);
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
        if (payload.projectileId.startsWith(session.actorUuid.slice(0, 8))) {
          localShipRef.current.kills += 1;
        }
      }
      bump();
    },
    [session, bump, setMatch],
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
            y: payload.y ?? 0,
            z: payload.z ?? 0,
            vx: payload.vx,
            vy: payload.vy ?? 0,
            vz: payload.vz ?? 0,
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
          worldZ: pose.worldY,
        }),
      );
      actorSenderRef.current.setProvider({
        getPose: () => shipStateToPose(localShipRef.current),
      });
      actorSenderRef.current.start();
      await actorSenderRef.current.sendNow();

      const syncPeers = async () => {
        try {
          await postBattlePresence(session.actorUuid, localShipRef.current);
          const peers = await listBattlePeers(session.actorUuid);
          const next = new Map(remoteRef.current);
          for (const peer of peers) {
            next.set(peer.uuid, {
              uuid: peer.uuid,
              ship: peer.ship,
              color: actorColorForUuid(peer.uuid),
            });
          }
          remoteRef.current = next;

          for (const fire of await listBattleFires()) {
            if (fire.ownerUuid === session.actorUuid) continue;
            if (projectilesRef.current.some((p) => p.id === fire.id)) continue;
            projectilesRef.current.push({
              id: fire.id,
              ownerUuid: fire.ownerUuid,
              x: fire.x,
              y: fire.y ?? 0,
              z: fire.z ?? 0,
              vx: fire.vx,
              vy: fire.vy ?? 0,
              vz: fire.vz ?? 0,
              bornAt: fire.firedAt,
            });
          }

          bump();
        } catch {
          // Presence relay is best-effort in dev
        }
      };

      await syncPeers();
      presenceIntervalRef.current = setInterval(() => {
        void syncPeers();
      }, 500);
      bump();
    })();

    return () => {
      actorSenderRef.current.stop();
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
    };
  }, [session, bump, applyHit]);

  const trackKey = useCallback((e: KeyboardEvent, down: boolean) => {
    const codeMap: Record<string, string> = {
      KeyW: 'w',
      KeyS: 's',
      KeyA: 'a',
      KeyD: 'd',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      KeyI: 'pitch_up',
      KeyK: 'pitch_down',
      KeyJ: 'left',
      KeyL: 'right',
    };
    const key = codeMap[e.code] ?? e.key.toLowerCase();
    if (['w', 's', 'a', 'd', 'up', 'down', 'left', 'right', 'pitch_up', 'pitch_down'].includes(key)) {
      if (down) keysRef.current.add(key);
      else keysRef.current.delete(key);
      e.preventDefault();
    }
    if (e.key === ' ' || e.code === 'Space') {
      if (down) {
        e.preventDefault();
        firingRef.current = true;
        void fireProjectile(localShipRef.current);
      } else {
        firingRef.current = false;
      }
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
        steerRef.current = { yaw: 0, pitch: 0 };
        throttleRef.current = BATTLE_THROTTLE_DEFAULT;
        projectilesRef.current = [];
        hitProjectilesRef.current.clear();
        everHadOpponentRef.current = false;
        setMatch('fighting');
      }

      const ship = localShipRef.current;
      const zone = getZoneState();
      const keys = keysRef.current;
      const status = matchStatusRef.current;

      if (ship.alive && status !== 'eliminated') {
        if (firingRef.current) {
          void fireProjectile(ship);
        }

        if (keys.has('a') || keys.has('left')) ship.yaw += BATTLE_YAW_RATE * dt;
        if (keys.has('d') || keys.has('right')) ship.yaw -= BATTLE_YAW_RATE * dt;
        if (keys.has('pitch_up')) {
          ship.pitch = Math.min(BATTLE_MAX_PITCH, ship.pitch + BATTLE_PITCH_RATE * dt);
        }
        if (keys.has('pitch_down')) {
          ship.pitch = Math.max(-BATTLE_MAX_PITCH, ship.pitch - BATTLE_PITCH_RATE * dt);
        }
        if (keys.has('w') || keys.has('up')) {
          throttleRef.current = Math.min(1, throttleRef.current + BATTLE_THROTTLE_RATE * dt);
        }
        if (keys.has('s') || keys.has('down')) {
          throttleRef.current = Math.max(0, throttleRef.current - BATTLE_THROTTLE_RATE * dt);
        }

        const steer = steerRef.current;
        ship.yaw += steer.yaw;
        ship.pitch = Math.max(
          -BATTLE_MAX_PITCH,
          Math.min(BATTLE_MAX_PITCH, ship.pitch + steer.pitch),
        );
        steerRef.current = { yaw: 0, pitch: 0 };

        const fwd = shipForward(ship);
        const cruise =
          BATTLE_THROTTLE_MIN_SPEED +
          (BATTLE_THROTTLE_MAX_SPEED - BATTLE_THROTTLE_MIN_SPEED) * throttleRef.current;
        const speed = cruise * dt;
        ship.worldX += fwd.x * speed;
        ship.worldY += fwd.y * speed;
        ship.worldZ += fwd.z * speed;

        const edge = distanceToZoneEdge(ship.worldX, ship.worldZ, zone);
        if (edge < 0) {
          ship.hp = Math.max(0, ship.hp - (BATTLE_ZONE_DAMAGE_PER_SEC * dt) / 60);
          if (ship.hp <= 0) {
            ship.alive = false;
            setMatch('eliminated');
          }
        }
      }

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
        p.z += p.vz * dt;
        if (performance.now() - p.bornAt > BATTLE_PROJECTILE_LIFETIME_MS) {
          projectiles.splice(i, 1);
          continue;
        }

        if (p.ownerUuid !== session.actorUuid) continue;

        for (const target of aliveRemotes) {
          const s = target.ship;
          if (!s.alive) continue;
          const dist = distance3(p.x, p.y, p.z, s.worldX, s.worldY, s.worldZ);
          if (dist > 14) continue;
          if (hitProjectilesRef.current.has(p.id)) continue;

          const payload: HitEventPayload = {
            projectileId: p.id,
            targetUuid: target.uuid,
            damage: BATTLE_SHOT_DAMAGE,
          };
          const { chunk } = chunkAt(p.x, p.z);
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

  const getSnapshot = useCallback(
    (): BattleSceneSnapshot => ({
      localUuid: session.actorUuid,
      localShip: localShipRef.current,
      remoteShips: [...remoteRef.current.values()],
      projectiles: projectilesRef.current,
      zone: getZoneState(),
      throttle: throttleRef.current,
      tick,
    }),
    [session.actorUuid, tick],
  );

  const setFiring = useCallback((active: boolean) => {
    firingRef.current = active;
    if (active) void fireProjectile(localShipRef.current);
  }, [fireProjectile]);

  const applySteer = useCallback((dx: number, dy: number) => {
    steerRef.current.yaw -= dx * BATTLE_MOUSE_SENSITIVITY;
    steerRef.current.pitch -= dy * BATTLE_MOUSE_SENSITIVITY;
  }, []);

  const zone = getZoneState();
  const remoteShips = [...remoteRef.current.values()];
  const aliveCount =
    (localShipRef.current.alive ? 1 : 0) +
    remoteShips.filter((r) => r.ship.alive).length;

  return {
    getSnapshot,
    localShip: localShipRef.current,
    remoteShips,
    projectiles: projectilesRef.current,
    zone,
    aliveCount,
    matchStatus,
    events,
    setFiring,
    applySteer,
    throttle: throttleRef.current,
    tick,
  };
}
