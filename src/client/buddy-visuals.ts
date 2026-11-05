import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import {
  BUDDY_ASSETS,
  type BuddyAppearance,
  type BuddyKind,
  type BuddyMotion,
} from "./buddy-assets";
import { buddyFollowTarget, type BuddyPoint } from "./buddy-follow";
import { mapFor } from "../shared/stages";
import type { World } from "../shared/game";

/** 各loadの所有物だけを解放。別の兵士・敵・バディへ共有しない。 */
export function disposeBuddyModel(model: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  model.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      materials.add(m);
    if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
  });
  for (const g of geometries) g.dispose();
  const textures = new Set<T.Texture>();
  for (const m of materials) {
    for (const value of Object.values(m))
      if (value instanceof T.Texture) textures.add(value);
    m.dispose();
  }
  for (const texture of textures) texture.dispose();
}
interface Entry extends BuddyAppearance {
  root: T.Group;
  model?: T.Group;
  mixer?: T.AnimationMixer;
  actions?: Map<string, T.AnimationAction>;
  motion?: string;
  position?: BuddyPoint;
  error?: string;
  loading?: Promise<void>;
}
/** 外観のみ。所有者の位置は実World／既存兵士描画を参照し、戦闘・保存を変更しない。 */
export class BuddyVisuals {
  readonly entries = new Map<string, Entry>();
  private run = "";
  private disposed = false;
  // 地形の影は静的キャッシュ。動くモデルを焼き込むと退出後も影が残る。
  shadows = false;
  constructor(
    private scene: T.Scene,
    private load: (kind: BuddyKind) => Promise<GLTF> = (kind) =>
      new GLTFLoader().loadAsync(
        `${import.meta.env.BASE_URL}assets/buddy/${BUDDY_ASSETS[kind].file}`,
      ),
  ) {}

  private remove(key: string) {
    const e = this.entries.get(key);
    if (!e) return;
    this.entries.delete(key); // 遅れて完了するloadを無効化する。
    this.scene.remove(e.root);
    e.mixer?.stopAllAction();
    if (e.model) {
      e.mixer?.uncacheRoot(e.model);
      disposeBuddyModel(e.model);
    }
  }
  clear() {
    for (const key of this.entries.keys()) this.remove(key);
    this.run = "";
  }
  dispose() {
    this.disposed = true;
    this.clear();
  }

  private add(appearance: BuddyAppearance) {
    const e: Entry = { ...appearance, root: new T.Group() };
    e.root.name = `buddy:${e.key}`;
    e.root.visible = false;
    this.entries.set(e.key, e);
    this.scene.add(e.root);
    e.loading = this.load(e.kind)
      .then((gltf) => {
        if (this.disposed || this.entries.get(e.key) !== e) {
          disposeBuddyModel(gltf.scene);
          return;
        }
        e.model = gltf.scene;
        const names = new Set(gltf.animations.map((c) => c.name));
        const required = [
          "Idle",
          "Follow",
          BUDDY_ASSETS[e.kind].display,
          ...(e.kind === "oriha" ? ["Coil"] : []),
        ];
        if (required.some((name) => !names.has(name)))
          throw new Error("採用GLBの動作が不足しています");
        // Blender→glTFの座標変換済み。等倍、素材の前方+Z。浮遊高も骨に含まれる。
        e.root.add(e.model);
        e.model.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.castShadow = this.shadows;
            o.receiveShadow = true;
          }
        });
        e.mixer = new T.AnimationMixer(e.model);
        e.actions = new Map(
          gltf.animations.map((c) => [c.name, e.mixer!.clipAction(c)]),
        );
        this.play(e, "Idle");
      })
      .catch((error) => {
        if (this.entries.get(e.key) !== e) return;
        e.error = error instanceof Error ? error.message : String(error);
        if (e.model) {
          disposeBuddyModel(e.model);
          e.model.removeFromParent();
          e.model = undefined;
        }
      });
  }
  /** 出撃準備だけが待つ。通常updateで追加された味方は非同期のまま表示する。 */
  async prepare(world: World, soldiers: ReadonlyMap<string, T.Group>) {
    for (const [key, entry] of this.entries) if (entry.error) this.remove(key);
    this.update(
      world,
      Object.entries(world.buddies?.entries ?? {}).map(([owner, b]) => ({
        key: owner,
        owner,
        kind: b.buddyId,
      })),
      0,
      soldiers,
      undefined,
      true,
    );
    const entries = [...this.entries.values()];
    await Promise.all(entries.map((entry) => entry.loading));
    for (const entry of entries) {
      if (this.entries.get(entry.key) !== entry)
        throw Error("バディの準備を中止しました");
      if (entry.error || !entry.model)
        throw Error(
          `${BUDDY_ASSETS[entry.kind].name}を読み込めません。通信を確認して再試行してください。${entry.error ?? ""}`,
        );
    }
  }
  private play(e: Entry, motion: BuddyMotion) {
    const name = motion === "Display" ? BUDDY_ASSETS[e.kind].display : motion;
    const next = e.actions?.get(name);
    if (!next || e.motion === name) return;
    const previous = e.motion ? e.actions?.get(e.motion) : undefined;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    previous?.crossFadeTo(next, 0.18, false);
    e.motion = name;
  }
  update(
    world: World | null,
    appearances: readonly BuddyAppearance[],
    dt: number,
    soldiers: ReadonlyMap<string, T.Group>,
    reviewMotion?: BuddyMotion,
    preparing = false,
  ) {
    if (this.disposed) return;
    // 生存・防衛・訓練・別rulesetに入れない。結果とロビーでも解放する。
    if (
      !world ||
      world.front ||
      world.defense ||
      world.training ||
      world.rebuild ||
      (world.phase !== "battle" && !(preparing && world.phase === "lobby"))
    ) {
      this.clear();
      return;
    }
    if (this.run !== world.run) {
      this.clear();
      this.run = world.run;
    }
    const wanted = new Map(
      appearances
        .filter((a) =>
          world.players.some(
            (p) => p.id === a.owner && p.hp > 0 && p.connected,
          ),
        )
        .map((a) => [a.key, a]),
    );
    for (const [key, e] of this.entries) {
      const next = wanted.get(key);
      if (!next || next.kind !== e.kind || next.owner !== e.owner)
        this.remove(key);
    }
    for (const [key, a] of wanted) if (!this.entries.has(key)) this.add(a);
    const delta = Math.max(0, Math.min(0.1, dt));
    for (const e of this.entries.values()) {
      const p = world.players.find((p) => p.id === e.owner)!;
      const soldier = soldiers.get(p.id);
      const owner = {
        x: soldier?.position.x ?? p.x,
        y: soldier?.position.y ?? p.y ?? 0,
        z: soldier?.position.z ?? p.z,
        yaw: p.yaw,
      };
      const authoritative = world.buddies?.entries[p.id];
      const target = authoritative
        ? authoritative.visible
          ? authoritative
          : null
        : buddyFollowTarget(
            owner,
            BUDDY_ASSETS[e.kind].radius,
            mapFor(world).blocks,
            e.position,
          );
      e.root.visible = !!target && !!e.model;
      if (!target) {
        e.position = undefined;
        continue;
      }
      const before = e.position;
      const t = before ? 1 - Math.exp(-7 * delta) : 1;
      const position = before
        ? {
            x: T.MathUtils.lerp(before.x, target.x, t),
            y: T.MathUtils.lerp(before.y, target.y, t),
            z: T.MathUtils.lerp(before.z, target.z, t),
          }
        : target;
      const speed =
        before && delta > 0
          ? Math.hypot(position.x - before.x, position.z - before.z) / delta
          : 0;
      e.position = position;
      e.root.position.set(position.x, position.y, position.z);
      const yaw =
        speed > 0.15 && before
          ? Math.atan2(position.x - before.x, -(position.z - before.z))
          : p.yaw;
      if (!before) e.root.rotation.y = Math.PI - yaw;
      e.root.rotation.y +=
        Math.atan2(
          Math.sin(Math.PI - yaw - e.root.rotation.y),
          Math.cos(Math.PI - yaw - e.root.rotation.y),
        ) *
        (1 - Math.exp(-10 * delta));
      this.play(
        e,
        reviewMotion ??
          (authoritative && world.time < authoritative.displayUntil
            ? "Display"
            : speed > 0.15
              ? "Follow"
              : "Idle"),
      );
      e.mixer?.update(delta);
    }
  }
}
