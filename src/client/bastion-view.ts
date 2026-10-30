import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Enemy, World } from "../shared/game";
import {
  BASTION,
  bastionAimLane,
  bastionLaneHalfWidth,
  bastionLanes,
  bastionSpikes,
  bastionTier,
} from "../shared/bastion";
import type { Block } from "../shared/map-blocks";
import { supportHeight } from "../shared/terrain";

/** assets/blender/candidates/bastion/model-v1/build_bastion.py の書出し（SHA-256 先頭12桁）。 */
export const BASTION_ASSET = "assets/enemies/bastion_v1.glb?rev=8dedf5952722";

/** GLBの extras.rig（build_bastion.py の P と各部品の軸）。 */
interface Rig {
  params: { loose: number; spike_ext: number; open_max: number; ports: number };
  plates: { name: string; hinge: number[]; axis: number[]; loose: number[] }[];
  spikes: { name: string; parent: string; dir: number[] }[];
}
interface Unit {
  root: T.Object3D;
  body: T.Object3D;
  bandNode: T.Object3D;
  coreNode: T.Object3D;
  plates: {
    node: T.Object3D;
    hinge: T.Vector3;
    axis: T.Vector3;
    loose: T.Vector3;
  }[];
  spikes: { node: T.Object3D; rest: T.Vector3; dir: T.Vector3 }[];
  seam: T.MeshStandardMaterial;
  port: T.MeshStandardMaterial;
  core: T.MeshStandardMaterial;
  /** 開放中のコアの光（トーンマッピング・ブルームのない描画で弱点を目立たせる）。 */
  halo: T.Mesh<T.SphereGeometry, T.MeshBasicMaterial>;
  spikes01: number;
  loose01: number;
  open01: number;
  band: number;
  bandSpeed: number;
  bodyY: number;
  heading?: number;
  /** 直前に描いた硬化段階と、段階が上がった瞬間の発光（1→0、約0.3秒）。 */
  tier: number;
  pulse: number;
  seen: boolean;
}

const COLD = new T.Color(0.55, 0.85, 1);
const AMBER = new T.Color(1, 0.55, 0.12);
const ORANGE = new T.Color(1, 0.42, 0.05);
const RED = new T.Color(1, 0.06, 0.05);
const CORE = new T.Color(0.55, 0.9, 1);

function approach(
  value: number,
  target: number,
  up: number,
  down: number,
  dt: number,
) {
  const rate = target > value ? up : down;
  return (
    value +
    Math.sign(target - value) * Math.min(Math.abs(target - value), rate * dt)
  );
}
function wrap(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * 戦闘・検証ページ共通の表示。権威状態（e.bastion）を読むだけで書き換えない。
 * 硬化段階 → トゲ・装甲の締まり・継ぎ目の色、予備動作 → 帯の回転、
 * 赤予告 → 実弾と同じレーンの危険帯、開放 → 装甲の展開とコア。
 */
export class BastionView {
  readonly root = new T.Group();
  ready = false;
  error?: string;
  /**
   * 戦場に BASTION が現れた時（攻略は出撃準備、生存戦は出現の少し前）だけ読み込む。
   * 出現しない作戦では取得しない。
   */
  loading?: Promise<void>;
  private template?: T.Object3D;
  private rig?: Rig;
  private readonly units = new Map<number, Unit>();
  private preparationUnit?: Unit;
  // 地面の危険帯（実際の当たり幅）と、弾の高さを示す細い芯線。
  private readonly laneMaterial = new T.MeshBasicMaterial({
    color: 0xff283b,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly coreMaterial = new T.MeshBasicMaterial({
    color: 0xff5a4a,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  private readonly lanes = new T.InstancedMesh(
    new T.BoxGeometry(1, 1, 1),
    this.laneMaterial,
    // 射程36m・1.5m刻みで12レーン×24区間。同時3体の斉射と照準弾まで欠けない数。
    1152,
  );
  private readonly laneCores = new T.InstancedMesh(
    new T.BoxGeometry(1, 1, 1),
    this.coreMaterial,
    96,
  );
  private readonly haloGeometry = new T.SphereGeometry(0.62, 24, 16);
  // 硬化装甲で弾かれた着弾: 撃った隊員の方向の装甲表面に火花と閃光。
  // 加算合成なので色の明るさがそのまま濃さになり、段階が高いほど白く大きい。
  private readonly sparks = new T.InstancedMesh(
    new T.BoxGeometry(0.035, 0.035, 0.32),
    new T.MeshBasicMaterial({
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
    }),
    128,
  );
  private readonly flashes = new T.InstancedMesh(
    new T.CircleGeometry(0.24, 18),
    new T.MeshBasicMaterial({
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    48,
  );
  private readonly sparkState: {
    p: T.Vector3;
    v: T.Vector3;
    life: number;
    max: number;
    color: T.Color;
  }[] = [];
  private readonly flashState: {
    p: T.Vector3;
    n: T.Vector3;
    life: number;
    max: number;
    size: number;
    color: T.Color;
  }[] = [];
  private readonly dummy = new T.Object3D();
  constructor(
    private readonly url = `${import.meta.env.BASE_URL}${BASTION_ASSET}`,
  ) {
    for (const mesh of [
      this.lanes,
      this.laneCores,
      this.sparks,
      this.flashes,
    ]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.root.add(mesh);
    }
    // First-hit effects use instance colors; allocate that shader variant before
    // battle rather than changing the material program on the first spark.
    for (const mesh of [this.sparks, this.flashes]) {
      mesh.setColorAt(0, new T.Color(0xffffff));
      mesh.instanceColor!.setUsage(T.DynamicDrawUsage);
    }
  }

  /** Dedicated hidden model and effect meshes for the loading-screen draw. */
  get preparationRoots(): T.Object3D[] {
    return [
      ...(this.preparationUnit ? [this.preparationUnit.root] : []),
      this.lanes,
      this.laneCores,
      this.sparks,
      this.flashes,
    ];
  }

  /** GLB の読込を一度だけ始める。読込前・失敗時は描画側が既存の簡易形状を描く。 */
  load() {
    this.loading ??= new GLTFLoader()
      .loadAsync(this.url)
      .then((gltf) => {
        const root = gltf.scene.getObjectByName("BASTION_ROOT");
        const rig = root?.userData.rig;
        if (!root || typeof rig !== "string")
          throw Error("BASTION rig missing");
        this.rig = JSON.parse(rig) as Rig;
        root.traverse((o) => {
          if ((o as T.Mesh).isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        this.template = root;
        this.preparationUnit = this.create(-1);
        if (this.preparationUnit) {
          this.preparationUnit.root.visible = false;
          // Warm the open-core halo too; only its preparation parent is hidden.
          this.preparationUnit.halo.visible = true;
        }
        this.ready = true;
      })
      .catch((error) => {
        this.error = String(error);
        console.warn("BASTION model unavailable; using fallback", error);
      });
    return this.loading;
  }

  private create(id: number): Unit | undefined {
    if (!this.template || !this.rig) return;
    const root = this.template.clone(true);
    const find = (name: string) => {
      const o = root.getObjectByName(name);
      if (!o) throw Error("BASTION node missing: " + name);
      return o;
    };
    // 発光材質だけ個体ごとに複製する。外装の焼き込み材質は共有。
    const own = new Map<T.Material, T.MeshStandardMaterial>();
    root.traverse((o) => {
      const mesh = o as T.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as T.MeshStandardMaterial;
      if (!/BASTION_(seam|port|core)/.test(m.name)) return;
      if (!own.has(m)) own.set(m, m.clone());
      mesh.material = own.get(m)!;
    });
    const material = (name: string) =>
      [...own.values()].find((m) => m.name === name)!;
    const v = (a: number[]) => new T.Vector3(a[0], a[1], a[2]);
    const body = find("Body");
    const halo = new T.Mesh(
      this.haloGeometry,
      new T.MeshBasicMaterial({
        color: 0x8fe8ff,
        transparent: true,
        opacity: 0,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.visible = false;
    find("core").add(halo);
    const unit: Unit = {
      root,
      body,
      bandNode: find("band"),
      coreNode: find("core"),
      plates: this.rig.plates.map((p) => ({
        node: find(p.name),
        hinge: v(p.hinge),
        axis: v(p.axis).normalize(),
        loose: v(p.loose).normalize(),
      })),
      spikes: this.rig.spikes.map((s) => {
        const node = find(s.name);
        return { node, rest: node.position.clone(), dir: v(s.dir).normalize() };
      }),
      seam: material("BASTION_seam"),
      port: material("BASTION_port"),
      core: material("BASTION_core"),
      halo,
      spikes01: 0,
      loose01: 1,
      open01: 0,
      band: (id * 1.37) % (Math.PI * 2),
      bandSpeed: 0.3,
      bodyY: body.position.y,
      tier: -1,
      pulse: 0,
      seen: false,
    };
    this.root.add(root);
    return unit;
  }

  /**
   * 硬化中の被弾（被弾イベントの guard 1〜3）。from は撃った隊員の足元。
   * 見た目だけで、戦闘の状態には触れない。
   */
  spark(
    hit: { x: number; y: number; z: number; guard?: number },
    from?: { x: number; y: number; z: number },
  ) {
    const tier = Math.max(1, Math.min(3, hit.guard ?? 1));
    const center = new T.Vector3(hit.x, hit.y, hit.z);
    const dir = from
      ? new T.Vector3(from.x, from.y + 1.5, from.z).sub(center)
      : new T.Vector3(Math.random() - 0.5, 0.2, Math.random() - 0.5);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    const point = center.clone().addScaledVector(dir, 1.03);
    const color = new T.Color(1, 0.5 + 0.15 * tier, 0.15 + 0.2 * tier);
    const side = new T.Vector3();
    for (let k = 0; k < 2 + tier && this.sparkState.length < 128; k++) {
      side
        .set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5)
        .multiplyScalar(1.6);
      const life = 0.14 + 0.08 * Math.random();
      this.sparkState.push({
        p: point.clone(),
        v: dir
          .clone()
          .add(side)
          .normalize()
          .multiplyScalar(5 + 4 * Math.random()),
        life,
        max: life,
        color,
      });
    }
    if (this.flashState.length < 48)
      this.flashState.push({
        p: point,
        n: dir,
        life: 0.11,
        max: 0.11,
        size: 0.7 + 0.3 * tier,
        color,
      });
  }

  private animateSparks(dt: number) {
    const look = new T.Vector3();
    let n = 0;
    for (let i = this.sparkState.length - 1; i >= 0; i--) {
      const s = this.sparkState[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.sparkState.splice(i, 1);
        continue;
      }
      s.p.addScaledVector(s.v, dt);
      s.v.y -= 9 * dt;
      this.dummy.position.copy(s.p);
      this.dummy.lookAt(look.copy(s.p).add(s.v));
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.sparks.setMatrixAt(n, this.dummy.matrix);
      this.sparks.setColorAt(
        n++,
        s.color.clone().multiplyScalar(s.life / s.max),
      );
    }
    this.sparks.count = n;
    let f = 0;
    for (let i = this.flashState.length - 1; i >= 0; i--) {
      const s = this.flashState[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.flashState.splice(i, 1);
        continue;
      }
      const t = s.life / s.max;
      this.dummy.position.copy(s.p);
      this.dummy.lookAt(look.copy(s.p).add(s.n));
      this.dummy.scale.setScalar(s.size * (1.2 - 0.5 * t));
      this.dummy.updateMatrix();
      this.flashes.setMatrixAt(f, this.dummy.matrix);
      this.flashes.setColorAt(f++, s.color.clone().multiplyScalar(t));
    }
    this.flashes.count = f;
    for (const mesh of [this.sparks, this.flashes]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /** 毎フレームの開始。危険帯を作り直し、火花を進め、全個体を未配置にする。 */
  begin(w: World | null, blocks: Block[], dt = 0) {
    this.animateSparks(dt);
    // 生存戦は出現の少し前から読み込み、予告中に簡易形状が出ないようにする。
    if (
      !this.loading &&
      w &&
      (w.enemies.some((e) => e.kind === "bastion") ||
        (w.front?.growthVersion === 3 &&
          !w.defense &&
          w.time >= BASTION.survival.preload))
    )
      this.load();
    for (const u of this.units.values()) u.seen = false;
    let n = 0,
      c = 0;
    const box = (
      mesh: T.InstancedMesh,
      index: number,
      a: { x: number; y: number; z: number },
      b: { x: number; y: number; z: number },
      width: number,
      height: number,
    ) => {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z;
      this.dummy.position.set(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        (a.z + b.z) / 2,
      );
      this.dummy.rotation.set(
        -Math.atan2(dy, Math.hypot(dx, dz)),
        Math.atan2(dx, dz),
        0,
        "YXZ",
      );
      this.dummy.scale.set(width, height, Math.hypot(dx, dy, dz));
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
    };
    const lane = (
      from: { x: number; y: number; z: number },
      to: { x: number; y: number; z: number },
      charge: number,
    ) => {
      const horizontal = Math.hypot(to.x - from.x, to.z - from.z);
      if (horizontal < 1e-3) return;
      // 地面: 1.5m以下の区間ごとに、弾の高さ以下の支持面へ沿わせる。幅はその支持面に
      // 立つ隊員に実際に当たる幅（高低差で変わる）。当たらない区間は描かない。
      const parts = Math.max(1, Math.ceil(horizontal / 1.5));
      const at = (t: number) => {
        const x = from.x + (to.x - from.x) * t,
          z = from.z + (to.z - from.z) * t,
          bullet = from.y + (to.y - from.y) * t;
        return { x, z, bullet, ground: supportHeight(x, z, blocks, bullet) };
      };
      let a = at(0);
      for (let i = 1; i <= parts && n < this.lanes.instanceMatrix.count; i++) {
        const b = at(i / parts),
          mid = at((i - 0.5) / parts),
          half = bastionLaneHalfWidth(mid.bullet, mid.ground);
        if (half > 0.05)
          box(
            this.lanes,
            n++,
            { x: a.x, y: a.ground + 0.05, z: a.z },
            { x: b.x, y: b.ground + 0.05, z: b.z },
            2 * half,
            0.02,
          );
        a = b;
      }
      // 実際の弾道（高さ）を示す芯線。
      if (c < this.laneCores.instanceMatrix.count)
        box(
          this.laneCores,
          c++,
          from,
          to,
          0.05 + 0.04 * charge,
          0.05 + 0.04 * charge,
        );
    };
    for (const e of w?.enemies ?? []) {
      const s = e.bastion;
      if (!s || e.hp <= 0) continue;
      // 赤い予告は確定済みの斉射だけ。身体の予備動作（brace）中は出さない。
      if (s.phase === "warn" && s.volley) {
        const charge = Math.min(1, (w!.time - s.phaseAt) / BASTION.warn);
        const grow = Math.min(1, (w!.time - s.phaseAt) / 0.15);
        for (const l of bastionLanes(s.volley, blocks))
          lane(
            l.from,
            {
              x: l.from.x + (l.to.x - l.from.x) * grow,
              y: l.from.y,
              z: l.from.z + (l.to.z - l.from.z) * grow,
            },
            charge,
          );
      }
      if (s.aim?.committed) {
        const l = bastionAimLane(s.aim.committed, blocks);
        const charge = Math.min(
          1,
          (w!.time - s.aim.started - BASTION.aimWind / 2) /
            (BASTION.aimWind / 2),
        );
        lane(l.from, l.to, charge);
      }
    }
    this.lanes.count = n;
    this.laneCores.count = c;
    this.lanes.instanceMatrix.needsUpdate = true;
    this.laneCores.instanceMatrix.needsUpdate = true;
    return this.ready;
  }

  /** 1個体を配置して姿勢と発光を決める。position は描画側の補間済み座標。 */
  place(e: Enemy, position: T.Vector3, time: number, dt: number) {
    const s = e.bastion;
    if (!s) return false;
    let u = this.units.get(e.id);
    if (!u) {
      u = this.create(e.id);
      if (!u) return false;
      this.units.set(e.id, u);
    }
    u.seen = true;
    u.root.visible = true;
    const tier = bastionTier(s.armor);
    const age = time - s.phaseAt;
    // 段階が上がった瞬間は一度だけ強く光って膨らむ（遠目でも段階の変化が分かる）。
    if (u.tier < 0) u.tier = tier;
    if (tier > u.tier && (s.phase === "guard" || s.phase === "brace"))
      u.pulse = 1;
    u.tier = s.phase === "open" ? 0 : tier;
    u.pulse = Math.max(0, u.pulse - dt / 0.3);
    const flare = 1 + 1.2 * u.pulse;
    u.body.scale.setScalar(1 + 0.05 * u.pulse);
    const heading = e.heading ?? u.heading ?? 0;
    u.heading = heading;
    u.root.position.set(position.x, position.y, position.z);
    u.root.rotation.set(0, heading + Math.PI, 0);
    // 装甲: 段階0では最初の数発から締まり始め、段階1で密着する。
    const looseTarget =
      s.phase === "guard" ? Math.max(0, 1 - s.armor / BASTION.tiers[0]) : 0;
    u.loose01 = approach(u.loose01, looseTarget, 1.5, 6, dt);
    // 段階が上がるたびに素早くせり出し、予備動作（0.8秒）の前半で全展開に達する。
    u.spikes01 = approach(u.spikes01, bastionSpikes(s), 2.5, 2, dt);
    u.open01 = approach(u.open01, s.phase === "open" ? 1 : 0, 2.4, 6, dt);
    const p = this.rig!.params;
    const q = new T.Quaternion();
    for (const plate of u.plates) {
      plate.node.position
        .copy(plate.hinge)
        .addScaledVector(plate.loose, p.loose * u.loose01);
      // 開放は蝶番の外開き。ease-out で開き、閉じは素早く。
      const open = 1 - (1 - u.open01) ** 2;
      plate.node.quaternion.copy(
        q.setFromAxisAngle(plate.axis, T.MathUtils.degToRad(p.open_max) * open),
      );
    }
    for (const spike of u.spikes) {
      spike.node.position
        .copy(spike.rest)
        .addScaledVector(spike.dir, p.spike_ext * u.spikes01);
      spike.node.visible = u.spikes01 > 0.01;
    }
    // 帯: 通常はゆっくり、予備動作で加速、赤予告開始で実弾方向へロック。
    const bodyYaw = heading + Math.PI;
    let lockTo: number | undefined;
    if (s.phase === "warn" && s.volley) lockTo = s.volley.turn;
    else if (s.aim?.committed) {
      const c = s.aim.committed;
      lockTo = Math.atan2(c.tx - e.x, c.tz - e.z);
    }
    if (lockTo !== undefined) {
      // ポート0の向き a = π - φ + θ を帯の回転 β = φ - θ - π で作る（30度周期）。
      const step = (Math.PI * 2) / p.ports;
      const want = lockTo - bodyYaw - Math.PI;
      const delta = wrap(want - u.band);
      const nearest = u.band + delta - Math.round(delta / step) * step;
      u.band += (nearest - u.band) * Math.min(1, dt * 16);
      u.bandSpeed = 0;
    } else {
      const speed =
        s.phase === "brace"
          ? 1.5 + 9 * Math.min(1, age / BASTION.brace)
          : 0.3 + 0.25 * tier;
      u.bandSpeed = approach(u.bandSpeed, speed, 12, 6, dt);
      u.band += u.bandSpeed * dt;
    }
    u.band = wrap(u.band);
    u.bandNode.rotation.set(0, u.band, 0);
    // 本体: 浮遊の上下。予備動作は小刻みに震え、開放中はわずかに沈む。
    const bob =
      s.phase === "brace"
        ? Math.sin(time * 55) * 0.018
        : s.phase === "open"
          ? -0.08 * u.open01 + Math.sin(time * 1.3 + e.id) * 0.02
          : Math.sin(time * 1.6 + e.id) * 0.05;
    u.body.position.y = u.bodyY + bob;
    // 発光: 継ぎ目は硬化の段階、発射口は攻撃の段階、コアは開放。
    const hurt = e.hurt > 0 && tier > 0 ? 1.6 : 1;
    const seam = new T.Color();
    let seamStrength: number;
    if (s.phase === "warn") {
      seam.copy(RED);
      seamStrength = 1.6 + 0.8 * Math.abs(Math.sin(time * 18));
    } else if (s.phase === "brace") {
      seam.copy(ORANGE);
      seamStrength = 1.5;
    } else if (s.phase === "open") {
      seam.copy(COLD);
      seamStrength = 0.35;
    } else {
      seam.copy(COLD).lerp(AMBER, Math.min(1, s.armor / BASTION.tiers[0]));
      seamStrength = (0.75 + tier * 0.22) * hurt;
    }
    u.seam.emissive.copy(seam);
    u.seam.emissiveIntensity = seamStrength * flare;
    const port = new T.Color();
    let portStrength: number;
    if (s.phase === "warn") {
      port.copy(RED);
      portStrength = 1.6 + 1.4 * Math.min(1, age / BASTION.warn);
    } else if (s.phase === "brace") {
      port.copy(ORANGE);
      portStrength = 0.9 + 0.8 * Math.min(1, age / BASTION.brace);
    } else if (s.aim) {
      port.copy(s.aim.committed ? RED : ORANGE);
      portStrength = s.aim.committed ? 2.4 : 1.2;
    } else {
      port.copy(seam);
      portStrength = 0.7 + 0.15 * tier;
    }
    u.port.emissive.copy(port);
    u.port.emissiveIntensity = portStrength * flare;
    u.core.emissive.copy(CORE);
    u.core.emissiveIntensity =
      0.25 + u.open01 * (1.2 + 0.3 * Math.sin(time * 9));
    u.coreNode.scale.setScalar(1 + u.open01 * 0.08 * Math.sin(time * 9));
    u.halo.visible = u.open01 > 0.01;
    u.halo.material.opacity = u.open01 * (0.3 + 0.08 * Math.sin(time * 9));
    return true;
  }

  /** フレームの終わり。消えた敵の表示を破棄し、未配置の個体を隠す。 */
  end(w: World | null) {
    const alive = new Set(w?.enemies.filter((e) => e.hp > 0).map((e) => e.id));
    for (const [id, u] of this.units) {
      if (!alive.has(id) || !w) {
        this.root.remove(u.root);
        for (const m of [u.seam, u.port, u.core, u.halo.material]) m.dispose();
        this.units.delete(id);
      } else if (!u.seen) u.root.visible = false;
    }
  }

  /** 作戦の切替・終了。個体の表示と、前の作戦の火花・閃光を残さず消す。 */
  clear() {
    this.end(null);
    if (this.preparationUnit) this.preparationUnit.root.visible = false;
    this.sparkState.length = 0;
    this.flashState.length = 0;
    this.sparks.count = this.flashes.count = 0;
  }

  /** 配置済み個体の外形（会敵ムービーのカメラ合わせ用）。 */
  bounds(id: number) {
    const u = this.units.get(id);
    if (!u) return undefined;
    u.root.updateMatrixWorld(true);
    return new T.Box3().setFromObject(u.root, true);
  }

  /** 読込済みのモデルで一度でも配置された個体か（会敵演出を始めてよいか）。 */
  placed(id: number) {
    return this.units.has(id);
  }

  /** 個体の正面（隊員側）。他の敵と同じく描画姿勢の (0,0,-1) を世界方向へ。 */
  front(id: number) {
    const u = this.units.get(id);
    const direction = new T.Vector3(0, 0, -1);
    if (!u) return direction;
    u.root.updateWorldMatrix(true, false);
    return direction.transformDirection(u.root.matrixWorld);
  }

  /**
   * 会敵演出: 戦闘の状態は止めたまま、この個体だけ待機の浮遊と帯の回転を進める。
   * 次の通常描画で戦闘側の姿勢に戻るので、restore は何もしなくてよい。
   */
  inspectionIdle(e: Enemy) {
    const u = this.units.get(e.id);
    if (!u) return;
    const position = u.root.position.clone();
    let last = 0;
    return {
      update: (time: number) => {
        this.place(e, position, time, Math.max(0, Math.min(0.1, time - last)));
        last = time;
      },
      restore: () => {},
    };
  }

  /** 図鑑など一時的な表示の後始末。共有の形状・材質と読み込んだモデルも破棄する。 */
  dispose() {
    this.clear();
    if (this.preparationUnit) {
      const u = this.preparationUnit;
      this.root.remove(u.root);
      for (const material of [u.seam, u.port, u.core, u.halo.material])
        material.dispose();
      this.preparationUnit = undefined;
    }
    for (const mesh of [
      this.lanes,
      this.laneCores,
      this.sparks,
      this.flashes,
    ]) {
      mesh.geometry.dispose();
      (mesh.material as T.Material).dispose();
      mesh.dispose();
    }
    this.laneMaterial.dispose();
    this.coreMaterial.dispose();
    this.haloGeometry.dispose();
    this.template?.traverse((o) => {
      const mesh = o as T.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      for (const m of [mesh.material].flat() as T.MeshStandardMaterial[]) {
        for (const map of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap])
          map?.dispose();
        m.dispose();
      }
    });
    this.root.removeFromParent();
  }

  /** 検証用: 個体の表示状態。 */
  inspect(id: number) {
    const u = this.units.get(id);
    return (
      u && {
        spikes: +u.spikes01.toFixed(3),
        loose: +u.loose01.toFixed(3),
        open: +u.open01.toFixed(3),
        band: +u.band.toFixed(3),
        seam: u.seam.emissive.getHexString(),
        port: u.port.emissive.getHexString(),
      }
    );
  }
  get lanesDrawn() {
    return this.lanes.count;
  }
}
