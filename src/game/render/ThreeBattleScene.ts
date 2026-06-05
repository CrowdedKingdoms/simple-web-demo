import * as THREE from 'three';
import type { BattleSceneSnapshot } from '@/game/battle/types';
import type { ShipState } from '@/game/battle/shipState';

const N64_PALETTE = {
  sky: 0x1a1040,
  fog: 0x2a1858,
  arwing: 0xd8dce8,
  arwingAccent: 0x3d7fd6,
  exhaust: 0xff8833,
  laser: 0xffee55,
  zone: 0x55aaff,
  asteroid: 0x4a3f6b,
};

function hexColor(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function createArwingMesh(
  color: number,
  accent: number,
  opts?: { fog?: boolean },
): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    fog: opts?.fog ?? true,
  });
  const accentMat = new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    fog: opts?.fog ?? true,
  });
  accentMat.color.setHex(accent);

  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 4), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = -0.3;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 4), accentMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -1.1;
  group.add(nose);

  const wingGeo = new THREE.BoxGeometry(1.4, 0.06, 0.5);
  const wingL = new THREE.Mesh(wingGeo, accentMat);
  wingL.position.set(-0.75, 0, 0.1);
  wingL.rotation.z = 0.08;
  group.add(wingL);
  const wingR = wingL.clone();
  wingR.position.x = 0.75;
  wingR.rotation.z = -0.08;
  group.add(wingR);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.35), bodyMat);
  tail.position.set(0, 0.12, 0.75);
  group.add(tail);

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 6, 4),
    new THREE.MeshLambertMaterial({
      color: 0x88ccff,
      flatShading: true,
      fog: opts?.fog ?? true,
    }),
  );
  canopy.position.set(0, 0.14, -0.35);
  canopy.scale.set(1, 0.6, 1.2);
  group.add(canopy);

  group.scale.setScalar(1.4);
  return group;
}

function createStarfield(): THREE.Points {
  const count = 2400;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 800 + Math.random() * 2200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xc8d8ff,
    size: 2.2,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

function createAsteroidField(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    color: N64_PALETTE.asteroid,
    flatShading: true,
  });
  for (let i = 0; i < 48; i++) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(8 + Math.random() * 24, 0),
      mat,
    );
    const angle = (i / 48) * Math.PI * 2;
    const dist = 180 + (i % 7) * 90;
    mesh.position.set(
      Math.cos(angle) * dist,
      ((i % 5) - 2) * 40,
      Math.sin(angle) * dist,
    );
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(mesh);
  }
  return group;
}

export class ThreeBattleScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly playerRig: THREE.Group;
  private readonly arena: THREE.Group;
  private readonly localShip: THREE.Group;
  private readonly exhaust: THREE.Mesh;
  private readonly zoneMesh: THREE.Mesh;
  private readonly remoteMeshes = new Map<
    string,
    { rig: THREE.Group; ship: THREE.Group; beacon: THREE.Mesh }
  >();
  private readonly laserMeshes = new Map<string, THREE.Group>();
  private readonly localLaserMeshes = new Map<string, THREE.Group>();
  private readonly localFx: THREE.Group;
  private animId = 0;
  private boostGlow = 0;

  constructor(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.className = 'battle-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(N64_PALETTE.sky);
    this.scene.fog = new THREE.FogExp2(N64_PALETTE.fog, 0.00045);

    this.camera = new THREE.PerspectiveCamera(58, w / h, 0.1, 4000);
    this.camera.position.set(0, 1.4, 4.2);

    const ambient = new THREE.AmbientLight(0x6060a0, 1.1);
    const key = new THREE.DirectionalLight(0xfff0d0, 1.4);
    key.position.set(4, 8, 2);
    const rim = new THREE.DirectionalLight(0x6688ff, 0.6);
    rim.position.set(-6, -2, -4);
    this.scene.add(ambient, key, rim);

    this.playerRig = new THREE.Group();
    this.scene.add(this.playerRig);

    this.localShip = createArwingMesh(N64_PALETTE.arwing, N64_PALETTE.arwingAccent);
    this.localShip.position.set(0, -0.35, 0);
    this.playerRig.add(this.localShip);

    this.exhaust = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.5 + Math.random() * 0.2, 4),
      new THREE.MeshBasicMaterial({ color: N64_PALETTE.exhaust }),
    );
    this.exhaust.rotation.x = -Math.PI / 2;
    this.exhaust.position.set(0, 0, 0.95);
    this.localShip.add(this.exhaust);

    this.localFx = new THREE.Group();
    this.localShip.add(this.localFx);

    this.camera.lookAt(0, -0.1, -6);
    this.playerRig.add(this.camera);

    this.arena = new THREE.Group();
    this.scene.add(this.arena);

    this.arena.add(createStarfield());
    this.arena.add(createAsteroidField());

    const zoneGeo = new THREE.SphereGeometry(1, 24, 16);
    const zoneMat = new THREE.MeshBasicMaterial({
      color: N64_PALETTE.zone,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    this.zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
    this.arena.add(this.zoneMesh);

    const horizon = new THREE.Mesh(
      new THREE.RingGeometry(400, 1200, 48),
      new THREE.MeshBasicMaterial({
        color: 0x3a2068,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25,
      }),
    );
    horizon.rotation.x = -Math.PI / 2;
    horizon.position.y = -120;
    this.arena.add(horizon);
  }

  resize(): void {
    const parent = this.renderer.domElement.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  startLoop(getSnapshot: () => BattleSceneSnapshot): void {
    const tick = () => {
      this.draw(getSnapshot());
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
  }

  stopLoop(): void {
    cancelAnimationFrame(this.animId);
  }

  dispose(): void {
    this.stopLoop();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private draw(snapshot: BattleSceneSnapshot): void {
    const { localUuid, localShip, remoteShips, projectiles, zone } = snapshot;

    this.playerRig.rotation.order = 'YXZ';
    this.playerRig.rotation.y = localShip.yaw;
    this.playerRig.rotation.x = localShip.pitch;

    this.arena.position.set(-localShip.worldX, -localShip.worldY, -localShip.worldZ);
    this.arena.rotation.set(0, 0, 0);

    this.zoneMesh.position.set(zone.centerX, 0, zone.centerZ);
    this.zoneMesh.scale.setScalar(zone.radius);

    this.boostGlow = 0.35 + Math.sin(performance.now() * 0.02) * 0.15;
    this.exhaust.scale.set(1, 1, this.boostGlow);
    this.localShip.rotation.z = Math.sin(performance.now() * 0.008) * 0.04;

    this.syncRemotes(remoteShips, localShip);
    this.syncLasers(projectiles, localShip, localUuid);
    this.syncLocalLasers(projectiles, localUuid);

    this.renderer.render(this.scene, this.camera);
  }

  private makeBolt(): THREE.Group {
    const bolt = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.25, 5),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false }),
    );
    core.position.z = -2.5;
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 5.5),
      new THREE.MeshBasicMaterial({
        color: N64_PALETTE.laser,
        transparent: true,
        opacity: 0.9,
        toneMapped: false,
        fog: false,
      }),
    );
    glow.position.z = -2.75;
    bolt.add(core, glow);
    return bolt;
  }

  private syncLocalLasers(
    projectiles: BattleSceneSnapshot['projectiles'],
    localUuid: string,
  ): void {
    const seen = new Set<string>();
    const now = performance.now();
    for (const p of projectiles) {
      if (p.ownerUuid !== localUuid) continue;
      seen.add(p.id);
      let bolt = this.localLaserMeshes.get(p.id);
      if (!bolt) {
        bolt = this.makeBolt();
        this.localFx.add(bolt);
        this.localLaserMeshes.set(p.id, bolt);
      }
      const age = (now - p.bornAt) / 1000;
      bolt.position.set(0, 0, -2.2 - age * 28);
      bolt.visible = age < 1.6;
    }
    for (const [id, mesh] of this.localLaserMeshes) {
      if (!seen.has(id)) {
        this.localFx.remove(mesh);
        this.localLaserMeshes.delete(id);
      }
    }
  }

  private syncRemotes(
    remotes: BattleSceneSnapshot['remoteShips'],
    local: ShipState,
  ): void {
    const seen = new Set<string>();
    for (const remote of remotes) {
      seen.add(remote.uuid);
      let entry = this.remoteMeshes.get(remote.uuid);
      if (!entry) {
        const color = hexColor(remote.color);
        const rig = new THREE.Group();
        const ship = createArwingMesh(color, 0x2244aa, { fog: false });
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(2.4, 10, 8),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.85,
            fog: false,
            toneMapped: false,
          }),
        );
        beacon.position.set(0, 0, -1.2);
        rig.add(ship, beacon);
        this.arena.add(rig);
        entry = { rig, ship, beacon };
        this.remoteMeshes.set(remote.uuid, entry);
      }
      const s = remote.ship;
      const dx = s.worldX - local.worldX;
      const dy = s.worldY - local.worldY;
      const dz = s.worldZ - local.worldZ;
      const dist = Math.hypot(dx, dy, dz);
      const visualScale = Math.max(3, Math.min(14, 2 + dist * 0.045));

      entry.rig.visible = s.alive;
      entry.rig.position.set(dx, dy, dz);
      entry.rig.rotation.order = 'YXZ';
      entry.rig.rotation.y = s.yaw;
      entry.rig.rotation.x = s.pitch;
      entry.ship.scale.setScalar(visualScale);
      entry.beacon.scale.setScalar(Math.max(1, visualScale * 0.35));
      (entry.beacon.material as THREE.MeshBasicMaterial).color.setHex(
        hexColor(remote.color),
      );
    }
    for (const [uuid, entry] of this.remoteMeshes) {
      if (!seen.has(uuid)) {
        this.arena.remove(entry.rig);
        this.remoteMeshes.delete(uuid);
      }
    }
  }

  private syncLasers(
    projectiles: BattleSceneSnapshot['projectiles'],
    local: ShipState,
    localUuid: string,
  ): void {
    const seen = new Set<string>();
    for (const p of projectiles) {
      if (p.ownerUuid === localUuid) continue;
      seen.add(p.id);
      let bolt = this.laserMeshes.get(p.id);
      if (!bolt) {
        bolt = this.makeBolt();
        this.arena.add(bolt);
        this.laserMeshes.set(p.id, bolt);
      }
      bolt.position.set(p.x - local.worldX, p.y - local.worldY, p.z - local.worldZ);
      const speed = Math.hypot(p.vx, p.vy, p.vz) || 1;
      bolt.rotation.set(
        Math.atan2(p.vy, Math.hypot(p.vx, p.vz)),
        Math.atan2(p.vx, -p.vz),
        0,
        'YXZ',
      );
      bolt.visible = speed > 0.1;
    }
    for (const [id, mesh] of this.laserMeshes) {
      if (!seen.has(id)) {
        this.arena.remove(mesh);
        this.laserMeshes.delete(id);
      }
    }
  }
}
