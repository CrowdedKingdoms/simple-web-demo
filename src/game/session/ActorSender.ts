import { ACTOR_SYNC_INTERVAL_MS } from '@/config';
import { CrowdySession } from './CrowdySession';
import type { ActorPose } from '@/game/world/actorState';
import { encodeActorState } from '@/game/world/actorState';
import { worldToChunkInput } from '@/game/world/coordinates';

export interface PoseProvider {
  getPose(): ActorPose;
}

export class ActorSender {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private sequenceNumber = 0;
  private provider: PoseProvider | null = null;
  private stateEncoder: (pose: ActorPose) => string = encodeActorState;

  constructor(private readonly session: CrowdySession) {}

  setStateEncoder(encoder: (pose: ActorPose) => string): void {
    this.stateEncoder = encoder;
  }

  setProvider(provider: PoseProvider | null): void {
    this.provider = provider;
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      void this.sendOnce();
    }, ACTOR_SYNC_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async sendNow(): Promise<void> {
    await this.sendOnce();
  }

  private async sendOnce(): Promise<void> {
    if (!this.provider) return;
    const pose = this.provider.getPose();
    const { chunk } = worldToChunkInput(pose.worldX, pose.worldY);
    const seq = this.nextSeq();
    await this.session.sendActorUpdate({
      chunk,
      state: this.stateEncoder(pose),
      sequenceNumber: seq,
      distance: 8,
      decayRate: 1,
    });
  }

  private nextSeq(): number {
    const s = this.sequenceNumber;
    this.sequenceNumber = (s + 1) % 256;
    return s;
  }
}
