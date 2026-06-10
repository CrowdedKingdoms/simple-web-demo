import {
  BrowserLocalStorageTokenStore,
  createCrowdyClient,
  generateCrowdyUuid,
  type CrowdyClient,
  type UdpNotification,
} from '@crowdedkingdomstudios/crowdyjs';
import {
  configFingerprint,
  getActiveDemoConfig,
  type DemoConfig,
} from '@/config/demoConfig';
import { ensureEnvScope, envScopedKey } from '@/game/envScope';
import { checkConnectivityForConfig, type ConnectivityStatus } from '@/game/session/connectivity';
import { voxelToCell } from '@/game/world/coordinates';
import { voxelStateToRgba } from '@/game/world/VoxelStore';
import type { ActorPose } from '@/game/world/actorState';

const PRESENCE_KIND = 'cks-canvas-v1';
const PRESENCE_CHUNK = { x: '0', y: '0', z: '-1' } as const;
const PRESENCE_VOXEL_TYPE = 250;

export interface PresenceActor {
  uuid: string;
  pose: ActorPose;
  updatedAt: number;
}

export interface SharedPaintCell {
  cellX: number;
  cellY: number;
  r: number;
  g: number;
  b: number;
  a: number;
  voxelType: number;
  updatedAt?: number;
}

export interface SessionUser {
  userId: string;
  email?: string;
  gamertag?: string;
}

export type { ConnectivityStatus };

function guestCredsKey(): string {
  return envScopedKey('cks-canvas-guest-creds');
}

export interface GuestCredentials {
  email: string;
  password: string;
}

export class CrowdySession {
  private static instance: CrowdySession | null = null;
  private static activeFingerprint: string | null = null;
  readonly config: DemoConfig;
  readonly client: CrowdyClient;
  readonly actorUuid: string;
  private _user: SessionUser | null = null;
  private udpSubscribed = false;
  private presenceSequence = 0;
  private eventLog: string[] = [];
  private eventListeners = new Set<(msg: string) => void>();
  private notificationHandlers = new Map<string, Set<(n: UdpNotification) => void>>();

  private constructor(config: DemoConfig) {
    this.config = config;
    ensureEnvScope();
    // GitHub CrowdyJS (Netlify build) resolves endpoint as httpUrl || graphqlEndpoint,
    // so managementUrl must include /graphql — not just the root /mgmt-api path.
    this.client = createCrowdyClient({
      managementUrl: config.managementGraphqlUrl,
      managementGraphqlEndpoint: config.managementGraphqlUrl,
      httpUrl: config.gameHttpUrl,
      wsUrl: config.gameWsUrl,
      tokenStore: new BrowserLocalStorageTokenStore(envScopedKey('cks-canvas-token')),
      realtime: { retryAttempts: 8, waitTimeoutMs: 5000 },
    });
    this.actorUuid = generateCrowdyUuid();
  }

  static getInstance(): CrowdySession {
    const config = getActiveDemoConfig();
    const fingerprint = configFingerprint(config);
    ensureEnvScope();
    if (
      !CrowdySession.instance ||
      CrowdySession.activeFingerprint !== fingerprint
    ) {
      CrowdySession.instance = new CrowdySession(config);
      CrowdySession.activeFingerprint = fingerprint;
    }
    return CrowdySession.instance;
  }

  get appId(): string {
    return this.config.appId;
  }

  get user(): SessionUser | null {
    return this._user;
  }

  get isAuthenticated(): boolean {
    return !!this.client.session.getToken();
  }

  get events(): string[] {
    return [...this.eventLog];
  }

  onEvent(listener: (msg: string) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private log(msg: string): void {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.eventLog = [...this.eventLog.slice(-99), line];
    for (const l of this.eventListeners) l(line);
  }

  async checkConnectivity(): Promise<ConnectivityStatus> {
    return checkConnectivityForConfig(this.config);
  }

  private loadGuestCreds(): GuestCredentials | null {
    try {
      const raw = localStorage.getItem(guestCredsKey());
      if (!raw) return null;
      return JSON.parse(raw) as GuestCredentials;
    } catch {
      return null;
    }
  }

  private saveGuestCreds(creds: GuestCredentials): void {
    localStorage.setItem(guestCredsKey(), JSON.stringify(creds));
  }

  private generateGuestCreds(): GuestCredentials {
    const id = randomHex(8);
    return {
      email: `guest-${id}@demo.local`,
      password: `Guest${randomHex(12)}!`,
    };
  }

  async ensureGuestAuth(): Promise<SessionUser> {
    await this.client.session.restore();
    if (this.client.session.getToken()) {
      try {
        const me = await this.client.users.me();
        if (me) {
          this._user = {
            userId: String(me.userId),
            email: me.email ?? undefined,
            gamertag: me.gamertag ?? undefined,
          };
          this.log(`Restored session for ${this._user.email ?? this._user.userId}`);
          return this._user;
        }
      } catch {
        this.log('Stale session token — re-authenticating');
      }
      await this.client.auth.logout();
    }

    let creds = this.loadGuestCreds();
    if (!creds) {
      creds = this.generateGuestCreds();
      this.saveGuestCreds(creds);
    }

    try {
      const result = await this.client.auth.register({
        email: creds.email,
        password: creds.password,
        gamertag: `Guest-${creds.email.slice(6, 14)}`,
      });
      this._user = {
        userId: String(result.user.userId),
        email: result.user.email ?? creds.email,
        gamertag: result.user.gamertag ?? undefined,
      };
      this.log(`Registered guest ${this._user.email}`);
      return this._user;
    } catch {
      try {
        const login = await this.client.auth.login({
          email: creds.email,
          password: creds.password,
        });
        this._user = {
          userId: String(login.user.userId),
          email: login.user.email ?? creds.email,
          gamertag: login.user.gamertag ?? undefined,
        };
        this.log(`Logged in guest ${this._user.email}`);
        return this._user;
      } catch {
        // Stale creds saved when mgmt-api proxy was unavailable on first visit.
        this.log('Guest auth failed — regenerating credentials');
        localStorage.removeItem(guestCredsKey());
        creds = this.generateGuestCreds();
        this.saveGuestCreds(creds);
        const retry = await this.client.auth.register({
          email: creds.email,
          password: creds.password,
          gamertag: `Guest-${creds.email.slice(6, 14)}`,
        });
        this._user = {
          userId: String(retry.user.userId),
          email: retry.user.email ?? creds.email,
          gamertag: retry.user.gamertag ?? undefined,
        };
        this.log(`Registered fresh guest ${this._user.email}`);
        return this._user;
      }
    }
  }

  resetGuest(): void {
    localStorage.removeItem(guestCredsKey());
    void this.client.auth.logout();
    this._user = null;
    this.log('Guest credentials cleared');
  }

  async bootstrap(): Promise<{ udpConnected: boolean; minVersion?: string }> {
    const boot = await this.client.serverStatus.gameClientBootstrap(this.appId);
    const connected = boot.udpProxyConnectionStatus?.connected ?? false;
    this.log(`Bootstrap OK — UDP connected: ${connected}`);
    const min = boot.versionInfo?.minimumClientVersion;
    const minVersion = min
      ? `${min.major}.${min.minor}.${min.patch}.${min.build}`
      : undefined;
    return { udpConnected: connected, minVersion };
  }

  async connectUdp(): Promise<boolean> {
    const status = await this.client.udp.connect();
    this.log(`UDP connect: ${status.connected ? 'connected' : 'failed'}`);
    return status.connected;
  }

  onNotification(
    typename: string,
    handler: (n: UdpNotification) => void,
  ): () => void {
    if (!this.notificationHandlers.has(typename)) {
      this.notificationHandlers.set(typename, new Set());
    }
    this.notificationHandlers.get(typename)!.add(handler);
    void this.ensureUdpSubscription();
    return () => this.notificationHandlers.get(typename)?.delete(handler);
  }

  private async ensureUdpSubscription(): Promise<void> {
    if (this.udpSubscribed) return;
    this.udpSubscribed = true;
    this.client.udp.subscribe({
      actorUpdate: (n) => this.dispatch('ActorUpdateNotification', n),
      voxelUpdate: (n) => this.dispatch('VoxelUpdateNotification', n),
      clientEvent: (n) => this.dispatch('ClientEventNotification', n),
      connectionEvent: (n) => {
        this.dispatch('RealtimeConnectionEvent', n);
        this.log(`Connection event: ${n.status ?? 'unknown'}`);
      },
      genericError: (n) => {
        this.dispatch('GenericErrorResponse', n);
        this.log(`UDP error: code ${n.errorCode}`);
      },
      actorUpdateResponse: (n) => this.dispatch('ActorUpdateResponse', n),
      voxelUpdateResponse: (n) => this.dispatch('VoxelUpdateResponse', n),
    });
    this.log('UDP subscription active');
  }

  private dispatch(typename: string, notification: UdpNotification): void {
    this.log(`← ${typename}`);
    const handlers = this.notificationHandlers.get(typename);
    if (handlers) {
      for (const h of handlers) h(notification);
    }
  }

  async sendActorUpdate(input: {
    chunk: { x: string; y: string; z: string };
    state: string;
    sequenceNumber: number;
    distance?: number;
    decayRate?: number;
    uuid?: string;
  }): Promise<boolean> {
    return this.client.udp.sendActorUpdate({
      appId: this.appId,
      chunk: input.chunk,
      uuid: input.uuid ?? this.actorUuid,
      state: input.state,
      sequenceNumber: input.sequenceNumber,
      distance: input.distance,
      decayRate: input.decayRate,
    });
  }

  async upsertPresenceActor(
    pose: ActorPose,
  ): Promise<void> {
    const publicState = encodePresenceState(pose);
    await postLocalPresence(this.actorUuid, pose);
    try {
      await this.client.udp.sendVoxelUpdate({
        appId: this.appId,
        chunk: PRESENCE_CHUNK,
        uuid: this.actorUuid,
        voxel: presenceLocationForUuid(this.actorUuid),
        voxelType: PRESENCE_VOXEL_TYPE,
        voxelState: publicState,
        sequenceNumber: this.nextPresenceSequence(),
        distance: 8,
        decayRate: 0,
      });
    } catch {
      // Local dev relay is sufficient for the tutorial if UDP presence is not
      // accepted by the current dev-tier account.
    }
  }

  async listPresenceActors(maxAgeMs = 10_000): Promise<PresenceActor[]> {
    const merged = new Map<string, PresenceActor>();
    try {
      const result = await this.client.voxels.listByDistance({
        appId: this.appId,
        centerCoordinate: PRESENCE_CHUNK,
        maxDistance: 1,
      });
      const now = Date.now();
      const voxels = result.chunks.flatMap((chunk) => chunk.voxels);
      for (const actor of voxels
        .filter((voxel) => voxel.voxelType === PRESENCE_VOXEL_TYPE)
        .map((voxel) => decodePresenceState(voxel.state))
        .filter((actor): actor is PresenceActor => {
          return (
            actor !== null &&
            actor.uuid !== this.actorUuid &&
            now - actor.updatedAt <= maxAgeMs
          );
        })) {
        merged.set(actor.uuid, actor);
      }
    } catch {
      // Keep local demos collaborative even if this dev-tier account cannot
      // read the reserved CKS presence layer.
    }

    for (const actor of await listLocalPresence(this.actorUuid, maxAgeMs)) {
      merged.set(actor.uuid, actor);
    }

    return [...merged.values()];
  }

  private nextPresenceSequence(): number {
    const current = this.presenceSequence;
    this.presenceSequence = (current + 1) % 256;
    return current;
  }

  async sendVoxelUpdate(input: {
    chunk: { x: string; y: string; z: string };
    cell?: SharedPaintCell;
    voxel: { x: number; y: number; z: number };
    voxelType: number;
    voxelState: string;
    sequenceNumber: number;
    distance?: number;
    decayRate?: number;
  }): Promise<boolean> {
    if (input.cell) {
      await postLocalPaint(input.cell);
    }
    return this.client.udp.sendVoxelUpdate({
      appId: this.appId,
      chunk: input.chunk,
      uuid: this.actorUuid,
      voxel: input.voxel,
      voxelType: input.voxelType,
      voxelState: input.voxelState,
      sequenceNumber: input.sequenceNumber,
      distance: input.distance,
      decayRate: input.decayRate,
    });
  }

  async listSharedPaint(): Promise<SharedPaintCell[]> {
    return listLocalPaint();
  }

  async sendClientEvent(input: {
    chunk: { x: string; y: string; z: string };
    eventType: number;
    state: string;
    sequenceNumber: number;
    distance?: number;
    decayRate?: number;
    uuid?: string;
  }): Promise<boolean> {
    return this.client.udp.sendClientEvent({
      appId: this.appId,
      chunk: input.chunk,
      uuid: input.uuid ?? this.actorUuid,
      eventType: input.eventType,
      state: input.state,
      sequenceNumber: input.sequenceNumber,
      distance: input.distance,
      decayRate: input.decayRate,
    });
  }

  async hydrateVoxels(
    centerChunkX: number,
    centerChunkY: number,
    onCell: (cellX: number, cellY: number, r: number, g: number, b: number, a: number, voxelType: number) => void,
  ): Promise<number> {
    const result = await this.client.voxels.listByDistance({
      appId: this.appId,
      centerCoordinate: { x: String(centerChunkX), y: String(centerChunkY), z: '0' },
      maxDistance: 3,
    });
    let count = 0;
    for (const chunk of result.chunks) {
      const cx = Number(chunk.coordinates.x);
      const cy = Number(chunk.coordinates.y);
      for (const v of chunk.voxels) {
        const cell = voxelToCell({
          chunkX: cx,
          chunkY: cy,
          voxelX: v.location.x,
          voxelY: v.location.y,
        });
        const rgba = voxelStateToRgba(v.state) ?? { r: 200, g: 100, b: 50, a: 255 };
        onCell(cell.cellX, cell.cellY, rgba.r, rgba.g, rgba.b, rgba.a, v.voxelType);
        count++;
      }
    }
    this.log(`Hydrated ${count} painted cells`);
    return count;
  }
}

function encodePresenceState(pose: ActorPose): string {
  return btoa(
    JSON.stringify({
      kind: PRESENCE_KIND,
      uuid: CrowdySession.getInstance().actorUuid,
      worldX: pose.worldX,
      worldY: pose.worldY,
      pushFlags: pose.pushFlags,
      updatedAt: Date.now(),
    }),
  );
}

function decodePresenceState(
  publicState: string | null | undefined,
): PresenceActor | null {
  if (!publicState) return null;
  try {
    const data = JSON.parse(atob(publicState)) as {
      kind?: string;
      uuid?: string;
      worldX?: number;
      worldY?: number;
      pushFlags?: number;
      updatedAt?: number;
    };
    if (data.kind !== PRESENCE_KIND) return null;
    if (
      typeof data.uuid !== 'string' ||
      typeof data.worldX !== 'number' ||
      typeof data.worldY !== 'number' ||
      typeof data.pushFlags !== 'number' ||
      typeof data.updatedAt !== 'number'
    ) {
      return null;
    }
    return {
      uuid: data.uuid,
      pose: {
        worldX: data.worldX,
        worldY: data.worldY,
        pushFlags: data.pushFlags,
      },
      updatedAt: data.updatedAt,
    };
  } catch {
    return null;
  }
}

function presenceLocationForUuid(uuid: string): { x: number; y: number; z: number } {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (hash * 31 + uuid.charCodeAt(i)) >>> 0;
  }
  return {
    x: hash % 16,
    y: Math.floor(hash / 16) % 16,
    z: 0,
  };
}

async function postLocalPresence(uuid: string, pose: ActorPose): Promise<void> {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  try {
    await fetch('/collab/presence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uuid, pose }),
    });
  } catch {
    // The relay only exists in local Vite dev. Static builds can ignore it.
  }
}

async function listLocalPresence(
  selfUuid: string,
  maxAgeMs: number,
): Promise<PresenceActor[]> {
  if (!import.meta.env.DEV || typeof window === 'undefined') return [];
  try {
    const response = await fetch('/collab/presence');
    if (!response.ok) return [];
    const entries = (await response.json()) as PresenceActor[];
    const now = Date.now();
    return entries.filter((entry) => {
      return entry.uuid !== selfUuid && now - entry.updatedAt <= maxAgeMs;
    });
  } catch {
    return [];
  }
}

async function postLocalPaint(cell: SharedPaintCell): Promise<void> {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  try {
    await fetch('/collab/paint', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cell),
    });
  } catch {
    // Static builds can rely on CKS voxel notifications / persistence.
  }
}

async function listLocalPaint(): Promise<SharedPaintCell[]> {
  if (!import.meta.env.DEV || typeof window === 'undefined') return [];
  try {
    const response = await fetch('/collab/paint');
    if (!response.ok) return [];
    return (await response.json()) as SharedPaintCell[];
  } catch {
    return [];
  }
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}
