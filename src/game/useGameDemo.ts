import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notificationMatchesApp } from '@/game/notificationAppId';
import { CrowdySession } from '@/game/session/CrowdySession';
import { ActorSender } from '@/game/session/ActorSender';
import { Viewport } from '@/game/world/Viewport';
import { VoxelStore, rgbaToVoxelState, voxelStateToRgba } from '@/game/world/VoxelStore';
import {
  computeEdgePushFlags,
  computeNetPush,
  decodeActorState,
  type ActorPose,
} from '@/game/world/actorState';
import {
  cellToVoxel,
  voxelToCell,
  worldToCell,
  worldToChunkInput,
} from '@/game/world/coordinates';
import { actorColorForUuid } from '@/game/render/CanvasRenderer';
import { VIEWPORT_PUSH_SPEED } from '@/config';
import type { RemoteActor } from '@/game/render/CanvasRenderer';

export type GameMode =
  | 'coords'
  | 'actors'
  | 'paint'
  | 'viewport'
  | 'collab'
  | 'full';

export interface GameDemoState {
  viewport: Viewport;
  voxelStore: VoxelStore;
  localPose: ActorPose | null;
  remoteActors: RemoteActor[];
  hoverCell: { cellX: number; cellY: number } | null;
  hoverVoxel: ReturnType<typeof cellToVoxel> | null;
  selectedColor: { r: number; g: number; b: number; voxelType: number };
  peerCount: number;
  netPushLabel: string;
  events: string[];
}

const PALETTE = [
  { r: 231, g: 76, b: 60, voxelType: 1 },
  { r: 52, g: 152, b: 219, voxelType: 2 },
  { r: 46, g: 204, b: 113, voxelType: 3 },
  { r: 241, g: 196, b: 15, voxelType: 4 },
  { r: 155, g: 89, b: 182, voxelType: 5 },
];

export function useGameDemo(mode: GameMode) {
  const session = useMemo(() => CrowdySession.getInstance(), []);
  const viewportRef = useRef(new Viewport());
  const voxelStoreRef = useRef(new VoxelStore());
  const actorSenderRef = useRef(new ActorSender(session));
  const remoteRef = useRef(new Map<string, RemoteActor>());
  const seqRef = useRef(0);
  const rafRef = useRef(0);
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localPoseRef = useRef<ActorPose>({ worldX: 320, worldY: 240, pushFlags: 0 });

  const [tick, setTick] = useState(0);
  const [hoverCell, setHoverCell] = useState<{ cellX: number; cellY: number } | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const selectedColor = PALETTE[selectedIdx]!;

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    return session.onEvent(() => setEvents([...session.events]));
  }, [session]);

  useEffect(() => {
    if (mode === 'coords') return;

    void (async () => {
      await session.ensureGuestAuth();
      await session.ensureAppAccess();
      await session.bootstrap();
      await session.connectUdp();

      session.onNotification('ActorUpdateNotification', (n) => {
        if (n.__typename !== 'ActorUpdateNotification') return;
        if (!notificationMatchesApp(n.appId, session.appId)) return;
        if (n.uuid === session.actorUuid) return;
        const pose = decodeActorState(n.state);
        if (!pose) return;
        remoteRef.current.set(n.uuid, {
          uuid: n.uuid,
          pose,
          color: actorColorForUuid(n.uuid),
        });
        bump();
      });

      session.onNotification('VoxelUpdateNotification', (n) => {
        if (n.__typename !== 'VoxelUpdateNotification') return;
        if (!notificationMatchesApp(n.appId, session.appId)) return;
        const cell = voxelToCell({
          chunkX: Number(n.chunkX),
          chunkY: Number(n.chunkY),
          voxelX: n.voxelX,
          voxelY: n.voxelY,
        });
        const rgba = voxelStateToRgba(n.voxelState) ?? { r: 200, g: 100, b: 50, a: 255 };
        voxelStoreRef.current.set(cell.cellX, cell.cellY, {
          r: rgba.r,
          g: rgba.g,
          b: rgba.b,
          a: rgba.a,
          voxelType: n.voxelType,
        });
        bump();
      });

      if (mode === 'paint' || mode === 'full') {
        const cx = Math.floor(localPoseRef.current.worldX / (8 * 16));
        const cy = Math.floor(localPoseRef.current.worldY / (8 * 16));
        await session.hydrateVoxels(cx, cy, (cellX, cellY, r, g, b, a, voxelType) => {
          voxelStoreRef.current.set(cellX, cellY, { r, g, b, a, voxelType });
        });
        setHydrated(true);
        bump();
      }

      actorSenderRef.current.setProvider({
        getPose: () => localPoseRef.current,
      });
      actorSenderRef.current.start();
      await actorSenderRef.current.sendNow();

      const syncPresence = async () => {
        try {
          const pose = localPoseRef.current;
          await session.upsertPresenceActor(pose);

          if (mode === 'paint' || mode === 'full') {
            const sharedPaint = await session.listSharedPaint();
            for (const cell of sharedPaint) {
              voxelStoreRef.current.set(cell.cellX, cell.cellY, {
                r: cell.r,
                g: cell.g,
                b: cell.b,
                a: cell.a,
                voxelType: cell.voxelType,
              });
            }
          }

          const peers = await session.listPresenceActors();
          const next = new Map(remoteRef.current);
          const seen = new Set<string>();
          for (const peer of peers) {
            seen.add(peer.uuid);
            next.set(peer.uuid, {
              uuid: peer.uuid,
              pose: peer.pose,
              color: actorColorForUuid(peer.uuid),
            });
          }
          for (const uuid of next.keys()) {
            if (uuid !== session.actorUuid && !seen.has(uuid)) {
              next.delete(uuid);
            }
          }
          remoteRef.current = next;
          bump();
        } catch (error) {
          console.warn('Presence sync failed', error);
        }
      };

      await syncPresence();
      presenceIntervalRef.current = setInterval(() => {
        void syncPresence();
      }, 1_000);
      bump();
    })();

    return () => {
      actorSenderRef.current.stop();
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
    };
  }, [mode, session, bump]);

  useEffect(() => {
    if (mode === 'coords') return;
    const loop = () => {
      const vp = viewportRef.current;
      const pose = localPoseRef.current;

      if (mode === 'viewport') {
        vp.applyEdgeScrollFromActor(pose.worldX, pose.worldY);
      }

      if (mode === 'collab' || mode === 'full') {
        const flags = computeEdgePushFlags(
          pose.worldX,
          pose.worldY,
          vp.x,
          vp.y,
          vp.width,
          vp.height,
          vp.edgeMargin,
        );
        pose.pushFlags = flags;
        const allPoses = [
          pose,
          ...[...remoteRef.current.values()].map((r) => r.pose),
        ];
        const net = computeNetPush(allPoses);
        if (net.x !== 0 || net.y !== 0) {
          vp.applyNetPush(net.x, net.y, VIEWPORT_PUSH_SPEED);
        }
      }

      bump();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mode, bump]);

  const handlePointerMove = (worldX: number, worldY: number) => {
    const cell = worldToCell(worldX, worldY);
    setHoverCell(cell);
    if (mode !== 'coords') {
      localPoseRef.current = {
        ...localPoseRef.current,
        worldX,
        worldY,
      };
      bump();
    }
  };

  const handleClick = async (worldX: number, worldY: number) => {
    if (mode !== 'paint' && mode !== 'full') return;
    const cell = worldToCell(worldX, worldY);
    const v = cellToVoxel(cell.cellX, cell.cellY);
    const { chunk } = worldToChunkInput(worldX, worldY);
    const voxelState = rgbaToVoxelState(
      selectedColor.r,
      selectedColor.g,
      selectedColor.b,
      255,
    );
    voxelStoreRef.current.set(cell.cellX, cell.cellY, {
      ...selectedColor,
      a: 255,
    });
    bump();
    const seq = seqRef.current++ % 256;
    await session.sendVoxelUpdate({
      chunk,
      cell: {
        cellX: cell.cellX,
        cellY: cell.cellY,
        ...selectedColor,
        a: 255,
      },
      voxel: { x: v.voxelX, y: v.voxelY, z: v.voxelZ },
      voxelType: selectedColor.voxelType,
      voxelState,
      sequenceNumber: seq,
      distance: 8,
      decayRate: 0,
    });
  };

  const hoverVoxel = hoverCell ? cellToVoxel(hoverCell.cellX, hoverCell.cellY) : null;
  const remoteActors = [...remoteRef.current.values()];
  const allPoses = [
    localPoseRef.current,
    ...remoteActors.map((r) => r.pose),
  ];
  const net = computeNetPush(allPoses);
  const netPushLabel =
    net.x === 0 && net.y === 0
      ? 'none'
      : `x=${net.x.toFixed(2)} y=${net.y.toFixed(2)}`;

  return {
    viewport: viewportRef.current,
    voxelStore: voxelStoreRef.current,
    localPose: mode === 'coords' ? null : localPoseRef.current,
    remoteActors,
    hoverCell,
    hoverVoxel,
    selectedColor,
    selectedIdx,
    palette: PALETTE,
    setSelectedIdx,
    peerCount: remoteActors.length,
    paintCount: voxelStoreRef.current.size(),
    netPushLabel,
    events,
    hydrated,
    handlePointerMove,
    handleClick,
    handlePointerLeave: () => setHoverCell(null),
    showGrid: true,
    tick,
  };
}
