import * as T from "three";
import type { Enemy, World } from "../shared/game";
import {
  BASTION,
  bastionLanes,
  bastionTier,
  type BastionState,
} from "../shared/bastion";
import { BastionView } from "./bastion-view";
import type { ReportMotion } from "./enemy-report-motion";

/** 図鑑の標本で撃つ隊員の位置（既定カメラ側の右手前）。 */
const SHOOTER = new T.Vector3(7, 0, -7);
/** 攻撃の1周（秒）。硬化→予備動作→赤予告→放射→開放→落ち着き→照準弾。 */
export const BASTION_REPORT_CYCLE = 9;
const HARDEN = 1.3,
  BRACE = HARDEN + BASTION.brace,
  WARN = BRACE + BASTION.warn,
  OPEN = WARN + BASTION.open,
  AIM = 6.3,
  AIM_FIRE = AIM + BASTION.aimWind;
/** 標本の外形（トゲ展開を含む）。図鑑のカメラ合わせに使う。 */
export const BASTION_REPORT_BOUNDS = new T.Box3(
  new T.Vector3(-1.1, BASTION.hover - 1.1, -1.1),
  new T.Vector3(1.1, BASTION.hover + 1.1, 1.1),
);

/** 図鑑の各モーションで標本に与える状態（戦闘と同じ BastionState）。 */
export function bastionReportState(mode: ReportMotion, time: number) {
  const state: BastionState = {
    armor: 0,
    phase: "guard",
    phaseAt: 0,
    readyAt: 0,
    counters: 0,
    aimReadyAt: 0,
  };
  let x = 0,
    hit = false;
  if (mode === "move") x = 1.6 * Math.sin(time * 0.7);
  if (mode !== "attack") return { state, x, hit, cycle: 0 };
  const cycle = time % BASTION_REPORT_CYCLE,
    base = time - cycle;
  const at = (offset: number) => base + offset;
  if (cycle < HARDEN) {
    state.armor = Math.min(BASTION.max, (cycle / HARDEN) * BASTION.max * 1.05);
    hit = true;
  } else if (cycle < BRACE) {
    state.armor = BASTION.max;
    state.phase = "brace";
    state.phaseAt = at(HARDEN);
  } else if (cycle < WARN) {
    state.armor = BASTION.max;
    state.phase = "warn";
    state.phaseAt = at(BRACE);
    state.volley = {
      count: BASTION.volley.full,
      turn: 0.26,
      x: 0,
      y: BASTION.hover,
      z: 0,
    };
  } else if (cycle < OPEN) {
    state.phase = "open";
    state.phaseAt = at(WARN);
  } else if (cycle >= AIM && cycle < AIM_FIRE) {
    state.aim = { started: at(AIM) };
    if (cycle >= AIM + BASTION.aimWind / 2) {
      const yaw = Math.atan2(SHOOTER.x, SHOOTER.z);
      state.aim.committed = {
        x: Math.sin(yaw) * BASTION.muzzle,
        y: BASTION.hover,
        z: Math.cos(yaw) * BASTION.muzzle,
        tx: SHOOTER.x,
        ty: SHOOTER.y + 1.2,
        tz: SHOOTER.z,
      };
    }
  }
  return { state, x, hit, cycle };
}

/** 図鑑の3D標本。戦闘と同じ BastionView を、台本の状態で動かす。 */
export class BastionSpecimen {
  readonly root = new T.Group();
  private readonly view = new BastionView();
  private readonly orbs = new T.InstancedMesh(
    new T.SphereGeometry(0.15, 14, 10),
    new T.MeshBasicMaterial({ color: 0xff5a2e }),
    BASTION.volley.full + 1,
  );
  private readonly enemy: Enemy;
  private readonly world: World;
  private readonly position = new T.Vector3();
  private readonly dummy = new T.Object3D();
  private last = 0;
  private sparkAt = -Infinity;
  constructor() {
    this.root.add(this.view.root, this.orbs);
    this.orbs.count = 0;
    this.orbs.frustumCulled = false;
    this.enemy = {
      id: 1,
      kind: "bastion",
      x: 0,
      y: 0,
      z: 0,
      hp: 1,
      maxHp: 1,
      hurt: 0,
      heading: Math.atan2(SHOOTER.x, SHOOTER.z),
      bastion: bastionReportState("idle", 0).state,
    } as unknown as Enemy;
    this.world = { time: 0, enemies: [this.enemy] } as unknown as World;
  }
  async load() {
    await this.view.load();
    if (!this.view.ready) throw Error(this.view.error ?? "BASTION unavailable");
  }
  update(mode: ReportMotion, time: number) {
    const dt = time >= this.last ? Math.min(0.1, time - this.last) : 0;
    if (time < this.last) this.sparkAt = -Infinity;
    this.last = time;
    const { state, x, hit, cycle } = bastionReportState(mode, time);
    this.enemy.bastion = state;
    this.enemy.x = x;
    this.enemy.hurt = hit ? 0.15 : 0;
    this.world.time = time;
    // 硬化中は隊員側の装甲に弾かれた火花（ARの間隔）。
    if (hit && time - this.sparkAt >= 0.13) {
      this.sparkAt = time;
      this.view.spark(
        {
          x,
          y: BASTION.hover,
          z: 0,
          guard: Math.max(1, bastionTier(state.armor)),
        },
        SHOOTER,
      );
    }
    this.view.begin(this.world, [], dt);
    this.position.set(x, 0, 0);
    this.view.place(this.enemy, this.position, time, dt);
    this.view.end(this.world);
    this.placeOrbs(mode, cycle);
  }
  /** 放射弾と照準弾。戦闘と同じ速さ・射程・発射口から飛ぶ。 */
  private placeOrbs(mode: ReportMotion, cycle: number) {
    let n = 0;
    if (mode === "attack") {
      const age = cycle - WARN;
      if (age >= 0 && age * BASTION.bulletSpeed < BASTION.bulletRange) {
        const lanes = bastionLanes(
          {
            count: BASTION.volley.full,
            turn: 0.26,
            x: 0,
            y: BASTION.hover,
            z: 0,
          },
          [],
        );
        for (const lane of lanes)
          this.setOrb(
            n++,
            lane.from.x + Math.sin(lane.yaw) * BASTION.bulletSpeed * age,
            lane.from.y,
            lane.from.z + Math.cos(lane.yaw) * BASTION.bulletSpeed * age,
          );
      }
      const flight = cycle - AIM_FIRE;
      const yaw = Math.atan2(SHOOTER.x, SHOOTER.z);
      const from = new T.Vector3(
        Math.sin(yaw) * BASTION.muzzle,
        BASTION.hover,
        Math.cos(yaw) * BASTION.muzzle,
      );
      const to = new T.Vector3(SHOOTER.x, SHOOTER.y + 1.2, SHOOTER.z);
      const travel = flight * BASTION.aimSpeed;
      if (flight >= 0 && travel < from.distanceTo(to)) {
        const p = from.lerp(to, travel / from.distanceTo(to));
        this.setOrb(n++, p.x, p.y, p.z);
      }
    }
    this.orbs.count = n;
    this.orbs.instanceMatrix.needsUpdate = true;
  }
  private setOrb(index: number, x: number, y: number, z: number) {
    this.dummy.position.set(x, y, z);
    this.dummy.scale.set(2, 2, 2.8);
    this.dummy.updateMatrix();
    this.orbs.setMatrixAt(index, this.dummy.matrix);
  }
  dispose() {
    this.view.dispose();
    this.orbs.geometry.dispose();
    (this.orbs.material as T.Material).dispose();
    this.orbs.dispose();
    this.root.removeFromParent();
  }
}
