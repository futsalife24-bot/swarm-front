import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { progressionWeaponModel } from "./progression-weapons";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Player } from "../shared/game";
import type { Kind } from "../shared/defs";
import {
  EVADE_DURATION,
  WEAPON_SWITCH_DURATION,
  HEAVY_HIT_DURATION,
  reloadDuration,
} from "../shared/defs";

export const TROOPER_PROFILES: Record<Kind, string> = {
  rifle: "Rifle",
  shotgun: "Shotgun",
  rocket: "Rocket",
};
export const TROOPER_SWITCH = {
  duration: WEAPON_SWITCH_DURATION,
  holster: 0.45 * WEAPON_SWITCH_DURATION,
  draw: 0.6 * WEAPON_SWITCH_DURATION,
} as const;
// Matches the v6 support-foot trajectory, in world metres per complete cycle.
export const TROOPER_RUN_STRIDE = 2.6;
// Provisional B adoption: the exact reviewed UAL Sprint lower-body clip.
export const TROOPER_SPRINT_STRIDE = 5.21351158618927;
export const TROOPER_SKINS = {
  standard: {
    Armor: "#5b6469",
    Ceramic: "#d1d7d8",
    Cloth: "#394039",
    Orange: "#f98f35",
  },
  desert: {
    Armor: "#ad9870",
    Ceramic: "#d6c5a0",
    Cloth: "#675c42",
    Orange: "#df913e",
  },
  arctic: {
    Armor: "#c7d2d6",
    Ceramic: "#e5ecee",
    Cloth: "#66777f",
    Orange: "#f98f35",
  },
  special: {
    Armor: "#30383e",
    Ceramic: "#555d65",
    Cloth: "#272c30",
    Orange: "#b65754",
  },
} as const;
export type TrooperSkin = keyof typeof TROOPER_SKINS;
export const TROOPER_BONES = [
  "Root",
  "Pelvis",
  "Spine",
  "SpineMid",
  "Chest",
  "Neck",
  "Head",
  ...["L", "R"].flatMap((side) => [
    ...[
      "Clavicle",
      "UpperArm",
      "LowerArm",
      "Hand",
      "UpperLeg",
      "LowerLeg",
      "Foot",
      "Toe",
    ].map((n) => `${n}_${side}`),
    ...["Thumb", "Index", "Middle", "Ring", "Little"].flatMap((n) =>
      [1, 2, 3].map((i) => `${n}${i}_${side}`),
    ),
  ]),
  "RightHandWeaponSocket",
  "LeftHandSupportSocket",
  "BackWeaponSocket",
  "BackWeaponSocket_2",
] as const;
type Assets = {
  character: GLTF;
  weapons: Record<Kind, T.Group>;
  runTrial?: { clip: T.AnimationClip; stride: number; name: string };
};
let loading: Promise<Assets> | undefined;
function trooperEnvironment() {
  // A continuous, neutral sky/ground reflection for the small metal and visor
  // surfaces. Shared once across players; no changes to the world's lighting.
  const faces = Array.from({ length: 6 }, (_, face) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!,
      pixels = ctx.createImageData(64, 64);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const u = (2 * (x + 0.5)) / 64 - 1,
          v = (2 * (y + 0.5)) / 64 - 1;
        const dir = [
          new T.Vector3(1, -v, -u),
          new T.Vector3(-1, -v, u),
          new T.Vector3(u, 1, v),
          new T.Vector3(u, -1, -v),
          new T.Vector3(u, -v, 1),
          new T.Vector3(-u, -v, -1),
        ][face].normalize();
        const sky = T.MathUtils.smoothstep(dir.y, -0.2, 0.7),
          highlight = Math.pow(
            Math.max(0, dir.dot(new T.Vector3(-0.5, 0.8, -0.3).normalize())),
            24,
          );
        const i = (y * 64 + x) * 4;
        [0, 1, 2].forEach(
          (c) =>
            (pixels.data[i + c] = Math.min(
              255,
              [38, 43, 44][c] + sky * [152, 162, 170][c] + highlight * 65,
            )),
        );
        pixels.data[i + 3] = 255;
      }
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  });
  const texture = new T.CubeTexture(faces);
  texture.colorSpace = T.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
export function loadStandardTrooper() {
  return (loading ??= (async () => {
    const loader = new GLTFLoader(),
      base = `${import.meta.env.BASE_URL}assets/characters/`;
    const [character, rifle, shotgun, rocket] = await Promise.all([
      loader.loadAsync(`${base}standard_trooper_sprint_v8.glb`),
      ...(["rifle", "shotgun", "rocket"] as const).map((k) =>
        loader.loadAsync(
          `${import.meta.env.BASE_URL}assets/weapons/realism-v2/${k}_0.glb`,
        ),
      ),
    ]);
    const env = trooperEnvironment();
    for (const asset of [character, rifle, shotgun, rocket])
      asset.scene.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        for (const material of Array.isArray(o.material)
          ? o.material
          : [o.material])
          if (material instanceof T.MeshStandardMaterial) {
            if (/Armor|Ceramic|Metal|Visor/.test(material.name)) {
              material.envMap = env;
              material.envMapIntensity = material.name === "Visor" ? 1.1 : 0.35;
            }
            for (const map of [
              material.map,
              material.normalMap,
              material.roughnessMap,
            ])
              if (map) map.anisotropy = 4;
          }
      });
    for (const name of TROOPER_BONES)
      if (!(character.scene.getObjectByName(name) instanceof T.Bone))
        throw new Error(`Trooper rig bone missing: ${name}`);
    // Keep modular components in the .blend/GLB; collapse only equivalent runtime
    // primitives. All source meshes were authored in the same armature space.
    character.scene.updateMatrixWorld(true);
    const materials = new Map<T.Material, T.SkinnedMesh[]>();
    character.scene.traverse((o) => {
      if (o instanceof T.SkinnedMesh && !Array.isArray(o.material)) {
        const list = materials.get(o.material) ?? [];
        list.push(o);
        materials.set(o.material, list);
      }
    });
    for (const [material, meshes] of materials) {
      const first = meshes[0];
      if (
        !meshes.every(
          (m) =>
            m.matrixWorld.equals(first.matrixWorld) &&
            m.bindMatrix.equals(first.bindMatrix) &&
            m.skeleton === first.skeleton,
        )
      )
        continue;
      const geometry = mergeGeometries(meshes.map((m) => m.geometry));
      if (!geometry) continue;
      const merged = new T.SkinnedMesh(geometry, material);
      merged.name = `Trooper_${material.name}`;
      // Preserve source module provenance even though runtime geometry is batched.
      let indexStart = 0;
      merged.userData.components = meshes.map((m) => {
        const count =
          m.geometry.index?.count ?? m.geometry.attributes.position.count;
        const range = {
          name: m.parent?.name || m.name,
          start: indexStart,
          count,
        };
        indexStart += count;
        return range;
      });
      merged.position.copy(first.position);
      merged.quaternion.copy(first.quaternion);
      merged.scale.copy(first.scale);
      merged.bind(first.skeleton, first.bindMatrix);
      first.parent!.add(merged);
      for (const m of meshes) m.removeFromParent();
    }
    const assets: Assets = {
      character,
      weapons: {
        rifle: rifle.scene,
        shotgun: shotgun.scene,
        rocket: rocket.scene,
      },
    };
    if (import.meta.env.DEV) {
      const trial = new URLSearchParams(location.search).get("runTrial");
      if (trial === "jog" || trial === "sprint")
        assets.runTrial = await (
          await import("./run-trial")
        ).loadRunTrial(trial);
    }
    return assets;
  })());
}

/** Character clips and weapon profiles are independent of authoritative combat rules. */
export class StandardTrooper {
  readonly model: T.Group;
  readonly mixer: T.AnimationMixer;
  readonly clips = new Map<string, T.AnimationClip>();
  readonly bones: T.Bone[] = [];
  readonly hand: T.Object3D;
  readonly back: T.Object3D[];
  readonly weapons: T.Group[] = [];
  private readonly skinMaterials = new Map<
    T.MeshStandardMaterial,
    T.MeshStandardMaterial
  >();
  private weaponIds: string[] = [];
  private prior?: {
    x: number;
    z: number;
    hp: number;
    slot: number;
    cool: number;
    evade: number;
    heavy: number;
    run: string;
  };
  private shotTime = 10;
  private heavyTime = 10;
  private switchTime = 10;
  private oldSlot = 0;
  private selectedSlot = 0;
  private locomotion = 0;
  private runStride = TROOPER_RUN_STRIDE;
  private moveYaw = 0;
  private stopYaw = 0;
  private stopTurnTime = 0.18;
  private rollTime = 0;
  private rollYaw = 0;
  private mode = "";
  private blend = 1;
  private lowerMode = "";
  private lowerBlend = 1;
  private lowerBlendDuration = 0.18;
  private plantTransition = false;
  private lowerPreviousPose: { p: T.Vector3; q: T.Quaternion; s: T.Vector3 }[] =
    [];
  private basePose: { p: T.Vector3; q: T.Quaternion; s: T.Vector3 }[] = [];
  private feet: {
    hip: T.Bone;
    knee: T.Bone;
    foot: T.Bone;
    sole: T.Vector3[];
    lastP: T.Vector3;
    lastQ: T.Quaternion;
    fromP: T.Vector3;
    fromQ: T.Quaternion;
  }[] = [];
  private previousPose: { p: T.Vector3; q: T.Quaternion; s: T.Vector3 }[] = [];
  constructor(readonly assets: Assets) {
    this.model = clone(assets.character.scene) as T.Group;
    this.model.name = "StandardTrooper_Player";
    this.mixer = new T.AnimationMixer(this.model);
    for (const authored of assets.character.animations) {
      const clip = authored.clone();
      clip.name = clip.name.replace(/^Trial_/, "");
      this.clips.set(clip.name, clip);
    }
    const lower = /^(Root|Pelvis|UpperLeg_|LowerLeg_|Foot_|Toe_)/;
    for (const name of [
      "Idle",
      "Run",
      "Run_Backward",
      "Weapon_Idle_Rocket",
      "Hit_Heavy",
    ]) {
      const clip = this.clips.get(name)!;
      this.clips.set(
        `Lower_${name}`,
        new T.AnimationClip(
          `Lower_${name}`,
          clip.duration,
          clip.tracks.filter((t) => lower.test(t.name)),
        ),
      );
    }
    for (const [name, clip] of [...this.clips]) {
      if (
        name.startsWith("Run") ||
        name.startsWith("Fire_") ||
        name.startsWith("Weapon_Idle_") ||
        name.startsWith("Switch_") ||
        name.startsWith("Reload_")
      )
        this.clips.set(
          `Upper_${name}`,
          new T.AnimationClip(
            `Upper_${name}`,
            clip.duration,
            clip.tracks.filter((t) => !lower.test(t.name)),
          ),
        );
    }
    this.hand = this.model.getObjectByName("RightHandWeaponSocket")!;
    this.back = ["BackWeaponSocket", "BackWeaponSocket_2"].map((n) =>
      this.model.getObjectByName(n)!,
    );
    this.model.traverse((o) => {
      if (o instanceof T.Bone) this.bones.push(o);
      if (o instanceof T.SkinnedMesh) {
        o.frustumCulled = false;
        o.castShadow = true;
        const owned = (material: T.Material) => {
          if (!(material instanceof T.MeshStandardMaterial)) return material;
          let local = this.skinMaterials.get(material);
          if (!local) {
            local = material.clone();
            this.skinMaterials.set(material, local);
          }
          return local;
        };
        o.material = Array.isArray(o.material)
          ? o.material.map(owned)
          : owned(o.material);
      }
    });
    this.model.updateMatrixWorld(true);
    for (const side of ["L", "R"]) {
      const foot = this.model.getObjectByName(`Foot_${side}`) as T.Bone;
      const sole: T.Vector3[] = [];
      this.model.traverse((o) => {
        if (!(o instanceof T.SkinnedMesh)) return;
        o.skeleton.update();
        const indices = o.geometry.attributes.skinIndex,
          weights = o.geometry.attributes.skinWeight;
        for (let i = 0; i < indices.count; i++)
          if (
            [0, 1, 2, 3].some(
              (k) =>
                weights.getComponent(i, k) > 0.5 &&
                [`Foot_${side}`, `Toe_${side}`].includes(
                  o.skeleton.bones[indices.getComponent(i, k)].name,
                ),
            )
          )
            sole.push(
              foot.worldToLocal(
                o
                  .getVertexPosition(i, new T.Vector3())
                  .applyMatrix4(o.matrixWorld),
              ),
            );
      });
      this.feet.push({
        hip: this.model.getObjectByName(`UpperLeg_${side}`) as T.Bone,
        knee: this.model.getObjectByName(`LowerLeg_${side}`) as T.Bone,
        foot,
        sole,
        lastP: new T.Vector3(),
        lastQ: new T.Quaternion(),
        fromP: new T.Vector3(),
        fromQ: new T.Quaternion(),
      });
    }
    const adopted = this.clips.get("UAL_sprint");
    const runMotion =
      assets.runTrial ??
      (adopted
        ? {
            clip: adopted,
            stride: TROOPER_SPRINT_STRIDE,
            name: "Sprint_Loop (provisional B)",
          }
        : undefined);
    if (runMotion) {
      const trial = runMotion.clip.clone();
      const duration = this.clips.get("Run")!.duration;
      for (const track of trial.tracks) track.scale(duration / trial.duration);
      trial.duration = duration;
      trial.name = "Lower_Run";
      this.clips.set("Lower_Run", trial);
      this.runStride = runMotion.stride;
      this.model.userData.runTrial = runMotion.name;
    }
  }
  /** Blend ankle paths, then solve the knees: joint-only blends cut through the floor. */
  private settleFeet(
    weight: number,
    targets: { p: T.Vector3; q: T.Quaternion }[],
  ) {
    this.model.updateMatrixWorld(true);
    for (const [i, leg] of this.feet.entries()) {
      const { hip, knee, foot } = leg;
      const target = targets[i].p.clone().lerp(leg.fromP, 1 - weight);
      const rotation = targets[i].q.clone().slerp(leg.fromQ, 1 - weight);
      let bottom = Infinity;
      for (const point of leg.sole)
        bottom = Math.min(
          bottom,
          point.clone().applyQuaternion(rotation).y + target.y,
        );
      target.y += Math.max(0, 0.002 - bottom);
      const a = hip.getWorldPosition(new T.Vector3()),
        b = knee.getWorldPosition(new T.Vector3()),
        c = foot.getWorldPosition(new T.Vector3());
      const l1 = a.distanceTo(b),
        l2 = b.distanceTo(c),
        axis = target.clone().sub(a);
      const length = T.MathUtils.clamp(
        axis.length(),
        Math.abs(l1 - l2) + 0.00001,
        l1 + l2 - 0.00001,
      );
      axis.normalize();
      const pole = b.clone().sub(a);
      pole.addScaledVector(axis, -pole.dot(axis));
      if (pole.lengthSq() < 0.000001)
        pole.set(0, 0, -1).addScaledVector(axis, axis.z);
      pole.normalize();
      const along = (l1 * l1 - l2 * l2 + length * length) / (2 * length);
      const bend = a
        .clone()
        .addScaledVector(axis, along)
        .addScaledVector(pole, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
      const turn = (bone: T.Bone, current: T.Vector3, desired: T.Vector3) => {
        const q = new T.Quaternion()
          .setFromUnitVectors(current.normalize(), desired.normalize())
          .multiply(bone.getWorldQuaternion(new T.Quaternion()));
        bone.quaternion.copy(
          bone
            .parent!.getWorldQuaternion(new T.Quaternion())
            .invert()
            .multiply(q),
        );
        bone.updateWorldMatrix(false, true);
      };
      turn(hip, b.clone().sub(a), bend.clone().sub(a));
      const joint = knee.getWorldPosition(new T.Vector3());
      turn(
        knee,
        foot.getWorldPosition(new T.Vector3()).sub(joint),
        target.clone().sub(joint),
      );
      foot.quaternion.copy(
        foot
          .parent!.getWorldQuaternion(new T.Quaternion())
          .invert()
          .multiply(rotation),
      );
      foot.updateWorldMatrix(false, true);
    }
  }
  /** Cosmetic-only, per-player material instances. Textures and geometry stay shared. */
  setSkin(skin: TrooperSkin) {
    const palette = TROOPER_SKINS[skin];
    if (!palette) throw new Error(`Unknown trooper skin: ${skin}`);
    for (const [source, material] of this.skinMaterials) {
      const role = (
        source.name === "Study_Cloth" ? "Cloth" : source.name
      ) as keyof typeof palette;
      if (!(role in palette)) continue;
      const base = new T.Color(TROOPER_SKINS.standard[role]);
      const target = new T.Color(palette[role]);
      // Maps carry the authored standard colors. Tint by a linear-light ratio,
      // always from the source so repeated switches never accumulate darkening.
      material.color
        .copy(source.color)
        .multiply(
          new T.Color().setRGB(
            target.r / base.r,
            target.g / base.g,
            target.b / base.b,
          ),
        );
    }
    this.model.userData.skin = skin;
  }
  equip(weapons: Player["weapons"], slot: number) {
    if (
      weapons.every(
        (w, i) =>
          this.weaponIds[i] === w.id + (progressionWeaponModel(w)?.uuid ?? ""),
      )
    )
      return;
    for (const o of this.weapons) o.removeFromParent();
    this.weapons.length = 0;
    weapons.forEach((w) =>
      this.weapons.push(
        (progressionWeaponModel(w) ?? this.assets.weapons[w.kind]).clone(true),
      ),
    );
    this.weaponIds = weapons.map(
      (w) => w.id + (progressionWeaponModel(w)?.uuid ?? ""),
    );
    this.selectedSlot = slot;
    this.switchTime = 10;
    this.attachRest(slot);
  }
  private attach(o: T.Object3D, parent: T.Object3D) {
    if (o.parent === parent) return;
    // Blender-authored sockets carry the Z-up -> Y-up basis. Cancel the
    // standalone weapon GLB's second basis conversion at the attachment root.
    parent.add(o);
    o.position.set(0, 0, 0);
    o.rotation.set(Math.PI / 2, 0, 0);
    o.scale.set(1, 1, 1);
  }
  private attachRest(slot: number) {
    this.weapons.forEach((o, i) =>
      this.attach(o, i === slot ? this.hand : this.back[i]),
    );
  }
  /** Explicit seconds make exported clips inspectable in the same runtime as the game. */
  sample(name: string, time: number, lowerName?: string, lowerTime = 0) {
    this.mixer.stopAllAction();
    for (const [n, t] of [
      [name, time],
      ...(lowerName ? [[lowerName, lowerTime]] : []),
    ] as [string, number][]) {
      const clip = this.clips.get(n);
      if (!clip) throw new Error(`Trooper animation missing: ${n}`);
      const action = this.mixer.clipAction(clip);
      action.reset().setLoop(T.LoopOnce, 1).play();
      action.clampWhenFinished = true;
      action.time = T.MathUtils.clamp(t, 0, clip.duration);
    }
    this.mixer.update(0);
    this.model.updateMatrixWorld(true);
  }
  sampleSwitch(from: number, time: number) {
    const clip = from === 0 ? "Switch_1_to_2" : "Switch_2_to_1";
    this.sample(
      clip,
      (time / TROOPER_SWITCH.duration) * this.clips.get(clip)!.duration,
    );
    this.weapons.forEach((o, i) =>
      this.attach(
        o,
        i === from
          ? time < TROOPER_SWITCH.holster
            ? this.hand
            : this.back[i]
          : time < TROOPER_SWITCH.draw
            ? this.back[i]
            : this.hand,
      ),
    );
    this.model.updateMatrixWorld(true);
  }
  update(
    p: Player,
    yaw: number,
    time: number,
    run: string,
    dt: number,
    motion: { x: number; z: number } = p,
  ) {
    dt = Math.max(0, Math.min(0.1, dt));
    this.equip(p.weapons, p.slot);
    const prev = this.prior,
      fresh = !prev || prev.run !== run;
    if (fresh) {
      this.selectedSlot = p.slot;
      this.oldSlot = 1 - p.slot;
      this.switchTime = 10;
      this.heavyTime = 10;
      this.shotTime = 10;
      this.mode = "";
      this.lowerMode = "";
      this.basePose = [];
    }
    const dx = fresh ? 0 : motion.x - prev.x,
      dz = fresh ? 0 : motion.z - prev.z;
    const distance = Math.hypot(dx, dz);
    const moving = dt > 0 && distance / dt > 0.12;
    let backward = false;
    if (moving) {
      let relative = Math.atan2(
        Math.sin(yaw - Math.atan2(dx, -dz)),
        Math.cos(yaw - Math.atan2(dx, -dz)),
      );
      backward = Math.abs(relative) > Math.PI / 2;
      if (backward) relative -= Math.sign(relative) * Math.PI;
      this.moveYaw +=
        Math.atan2(
          Math.sin(relative - this.moveYaw),
          Math.cos(relative - this.moveYaw),
        ) *
        (1 - Math.exp(-dt / 0.055));
      this.stopYaw = this.moveYaw;
      this.stopTurnTime = 0;
    } else {
      this.stopTurnTime = Math.min(0.18, this.stopTurnTime + dt);
      const turn = this.stopTurnTime / 0.18;
      this.moveYaw = this.stopYaw * (1 - turn * turn * (3 - 2 * turn));
    }
    if (fresh) {
      this.moveYaw = 0;
      this.stopYaw = 0;
      this.stopTurnTime = 0.18;
      this.locomotion = 0;
    }
    // Backpedal has its own forward-playing landing and push-off sequence.
    const runDuration = this.clips.get("Run")!.duration;
    if (moving && p.evade <= 0)
      this.locomotion =
        (this.locomotion +
          (distance / (backward ? TROOPER_RUN_STRIDE : this.runStride)) *
            runDuration) %
        runDuration;
    const runClip = backward ? "Run_Backward" : "Run";
    this.shotTime += dt;
    this.heavyTime += dt;
    if (!fresh && p.cool > prev.cool + 0.025) this.shotTime = 0;
    if (!fresh && p.slot !== this.selectedSlot) {
      this.oldSlot = this.selectedSlot;
      this.selectedSlot = p.slot;
      this.switchTime = 0;
    }
    // The authority gates both firing and attachment progress, including dodge pauses.
    if (p.swapCd > 0) {
      const rate =
        TROOPER_SWITCH.duration / (p.swapDuration ?? TROOPER_SWITCH.duration);
      const elapsed = TROOPER_SWITCH.duration - p.swapCd * rate;
      this.switchTime = Math.min(
        TROOPER_SWITCH.duration - 0.00001,
        Math.max(
          elapsed,
          (this.switchTime >= TROOPER_SWITCH.duration
            ? elapsed
            : this.switchTime) +
            (p.evade > 0 || (p.swapResume ?? 0) > 0 ? 0 : dt * rate),
        ),
      );
    } else this.switchTime = 10;
    const heavy = p.heavyHit ?? 0;
    if (heavy > 0)
      this.heavyTime =
        fresh || heavy > prev.heavy + 0.001
          ? Math.max(0, HEAVY_HIT_DURATION - heavy)
          : Math.max(this.heavyTime, HEAVY_HIT_DURATION - heavy);
    const rolling = p.hp > 0 && p.evade > 0;
    if (rolling && (fresh || prev.evade <= 0 || p.evade > prev.evade)) {
      this.rollTime = Math.max(0, EVADE_DURATION - p.evade);
      this.rollYaw = distance > 0.00001 ? Math.atan2(dx, -dz) : yaw;
    } else if (rolling)
      this.rollTime = Math.max(this.rollTime + dt, EVADE_DURATION - p.evade);
    const profile = TROOPER_PROFILES[p.weapons[p.slot].kind];
    let mode = "",
      clip = "",
      at = 0,
      lower: string | undefined;
    if (p.hp <= 0) {
      mode = "down";
      clip = "Hit_Heavy";
      at = 0.83;
    } else if (rolling) {
      mode = "roll";
      clip = "Dodge_Roll";
      at =
        (this.rollTime / EVADE_DURATION) *
        this.clips.get("Dodge_Roll")!.duration;
    } else if (this.switchTime < TROOPER_SWITCH.duration) {
      mode = "switch";
      clip = this.oldSlot === 0 ? "Switch_1_to_2" : "Switch_2_to_1";
      at =
        (this.switchTime / TROOPER_SWITCH.duration) *
        this.clips.get(clip)!.duration;
      if (heavy > 0) {
        mode = "switch_heavy";
        clip = `Upper_${clip}`;
        lower = "Lower_Hit_Heavy";
      } else if (moving) {
        clip = `Upper_${clip}`;
        lower = `Lower_${runClip}`;
      } else {
        clip = `Upper_${clip}`;
        lower = `Lower_${profile === "Rocket" ? "Weapon_Idle_Rocket" : "Idle"}`;
      }
    } else if (this.heavyTime < HEAVY_HIT_DURATION) {
      mode = "heavy";
      clip = "Hit_Heavy";
      at = this.heavyTime;
    } else if (p.reload > 0) {
      mode = `normal_${profile}_reload_${moving ? runClip : "idle"}`;
      clip = `Upper_Reload_${profile}`;
      const duration = reloadDuration(p.weapons[p.slot], p.ammo[p.slot]);
      at =
        T.MathUtils.clamp(1 - p.reload / duration, 0, 1) *
        this.clips.get(clip)!.duration;
      lower = `Lower_${moving ? runClip : profile === "Rocket" ? "Weapon_Idle_Rocket" : "Idle"}`;
    } else {
      const fire = this.clips.get(`Fire_${profile}`)!;
      const firing = this.shotTime < fire.duration;
      mode = `normal_${profile}_${moving ? runClip : "idle"}`;
      clip = moving
        ? `Upper_${runClip}${profile === "Rocket" ? "_Rocket" : ""}`
        : `Upper_${firing ? "Fire_" : "Weapon_Idle_"}${profile}`;
      at = moving ? this.locomotion : firing ? this.shotTime : time % 3;
      lower = `Lower_${moving ? runClip : profile === "Rocket" ? "Weapon_Idle_Rocket" : "Idle"}`;
    }
    const snapshot = () =>
      this.basePose.map((b) => ({
        p: b.p.clone(),
        q: b.q.clone(),
        s: b.s.clone(),
      }));
    const lowerMode = lower ?? mode;
    if (lowerMode !== this.lowerMode) {
      const ground = /^Lower_(Run.*|Idle|Weapon_Idle_Rocket)$/;
      this.plantTransition =
        ground.test(this.lowerMode) && ground.test(lowerMode);
      this.lowerPreviousPose = snapshot();
      for (const leg of this.feet) {
        leg.fromP.copy(leg.lastP);
        leg.fromQ.copy(leg.lastQ);
      }
      this.lowerBlend = this.lowerMode && mode !== "roll" ? 0 : 1;
      this.lowerBlendDuration = lower?.startsWith("Lower_Run")
        ? 0.1
        : this.lowerMode.startsWith("Lower_Run") && lower?.includes("Idle")
          ? 0.18
          : 0.08;
      this.lowerMode = lowerMode;
    }
    if (mode !== this.mode) {
      // Snapshot before aim/hip overlays: blending an already rotated pose
      // and applying those rotations again caused the stop/restart leg kick.
      this.previousPose = snapshot();
      this.blend = this.mode && mode !== "roll" ? 0 : 1;
      this.mode = mode;
    }
    this.sample(
      clip,
      at,
      lower,
      lower?.startsWith("Lower_Run")
        ? this.locomotion
        : lower === "Lower_Hit_Heavy"
          ? this.heavyTime
          : time % 3,
    );
    // Keep the target ankle transforms before joint blending changes them.
    const targetFeet = this.feet.map((leg) => ({
      p: leg.foot.getWorldPosition(new T.Vector3()),
      q: leg.foot.getWorldQuaternion(new T.Quaternion()),
    }));
    this.blend = Math.min(1, this.blend + dt / 0.08);
    this.lowerBlend = Math.min(
      1,
      this.lowerBlend + dt / this.lowerBlendDuration,
    );
    this.bones.forEach((b, i) => {
      const isLower = /^(Root|Pelvis|UpperLeg_|LowerLeg_|Foot_|Toe_)/.test(
        b.name,
      );
      const progress = isLower ? this.lowerBlend : this.blend;
      const weight = progress * progress * (3 - 2 * progress);
      const from = (isLower ? this.lowerPreviousPose : this.previousPose)[i];
      // slerpQuaternions(from, b.quaternion, weight) aliases its destination:
      // Three copies `from` first, freezing the joints until the last frame.
      if (from && progress < 1) {
        b.position.lerpVectors(from.p, b.position, weight);
        b.quaternion.slerp(from.q, 1 - weight);
        b.scale.lerpVectors(from.s, b.scale, weight);
      }
    });
    if (this.plantTransition && this.lowerBlend < 1) {
      const weight =
        this.lowerBlend * this.lowerBlend * (3 - 2 * this.lowerBlend);
      this.settleFeet(weight, targetFeet);
    }
    this.model.updateMatrixWorld(true);
    this.bones.forEach((b, i) => {
      const pose = (this.basePose[i] ??= {
        p: new T.Vector3(),
        q: new T.Quaternion(),
        s: new T.Vector3(),
      });
      pose.p.copy(b.position);
      pose.q.copy(b.quaternion);
      pose.s.copy(b.scale);
    });
    for (const leg of this.feet) {
      leg.foot.getWorldPosition(leg.lastP);
      leg.foot.getWorldQuaternion(leg.lastQ);
    }
    if (mode.startsWith("normal_")) {
      const spine = this.model.getObjectByName("Spine");
      // The whole upper body, including both grip points, follows vertical aim.
      spine?.rotateX(
        T.MathUtils.clamp(p.pitch || 0, -Math.PI / 2, Math.PI / 2),
      );
      if (moving) {
        const fire = this.clips.get(`Fire_${profile}`)!;
        if (this.shotTime < fire.duration)
          spine?.rotateX(
            -Math.sin((Math.PI * this.shotTime) / fire.duration) *
              (profile === "Rifle" ? 0.025 : 0.055),
          );
      }
    }
    if (
      lower &&
      lower !== "Lower_Hit_Heavy" &&
      Math.abs(this.moveYaw) > 0.00001
    ) {
      // Turn the hips in world up, then cancel at the spine so aim and grips stay aligned.
      for (const [name, angle] of [
        ["Pelvis", this.moveYaw],
        ["Spine", -this.moveYaw],
      ] as const) {
        const bone = this.model.getObjectByName(name)!;
        const axis = new T.Vector3(0, 1, 0).applyQuaternion(
          bone.parent!.getWorldQuaternion(new T.Quaternion()).invert(),
        );
        bone.quaternion.premultiply(
          new T.Quaternion().setFromAxisAngle(axis, angle),
        );
        bone.updateWorldMatrix(false, true);
      }
    }
    this.model.rotation.y = rolling ? yaw - this.rollYaw : 0;
    this.model.updateMatrixWorld(true);
    if (this.switchTime < TROOPER_SWITCH.duration)
      this.weapons.forEach((o, i) =>
        this.attach(
          o,
          i === this.oldSlot
            ? this.switchTime < TROOPER_SWITCH.holster
              ? this.hand
              : this.back[i]
            : this.switchTime < TROOPER_SWITCH.draw
              ? this.back[i]
              : this.hand,
        ),
      );
    else this.attachRest(this.selectedSlot);
    this.prior = {
      x: motion.x,
      z: motion.z,
      hp: p.hp,
      slot: p.slot,
      cool: p.cool,
      evade: p.evade,
      heavy,
      run,
    };
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.model.removeFromParent();
    for (const material of this.skinMaterials.values()) material.dispose();
    this.skinMaterials.clear();
  }
}
