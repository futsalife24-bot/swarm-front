import { expect, it } from "vitest";
import * as T from "three";
import { HarrowEffects } from "../src/client/harrow-effects";
import { HarrowWarningBeacons } from "../src/client/harrow-warning-beacons";
import { createWorld, spawn } from "../src/shared/game";
import { HARROW, type HarrowMissile } from "../src/shared/harrow";
import { stageFor } from "../src/shared/stages";
import type { TerrainProjectedMarkers } from "../src/client/terrain-projected-marker";

const bomb: HarrowMissile = {
  id: 10,
  owner: 1,
  origin: { x: 0, y: 20, z: 0 },
  target: { x: 2, y: 0, z: 8 },
  launch: 2,
  impact: 2.8,
  damage: HARROW.bombDamage,
  radius: HARROW.bombRadius,
  trajectory: "straight",
};
const beacon = (v: HarrowEffects) =>
  v.root.getObjectByName("harrow-warning-beacons") as HarrowWarningBeacons;

it("爆撃の予告開始・着弾・世界解除に追従し、狙撃と曲射へ混入しない", () => {
  const view = new HarrowEffects();
  const missiles = [
    bomb,
    { ...bomb, id: 11, radius: HARROW.snipeRadius },
    { ...bomb, id: 12, trajectory: "arc" as const },
  ];
  const original = structuredClone(missiles);
  try {
    view.update({ time: 1.24, harrowMissiles: missiles });
    expect(beacon(view).count).toBe(0);
    view.update({ time: 1.25, harrowMissiles: missiles });
    expect(beacon(view).count).toBe(1);
    view.update({ time: 2.79, harrowMissiles: missiles });
    expect(beacon(view).visible).toBe(true);
    view.update({ time: 2.8, harrowMissiles: missiles });
    expect(beacon(view).visible).toBe(false);
    view.update({ time: 1.3, harrowMissiles: missiles });
    view.update(null);
    expect(beacon(view).count).toBe(0);
    expect(missiles).toEqual(original);
  } finally {
    view.dispose();
  }
});

it("Dashの実予告端に揃い、攻撃開始時に消え、世界を変更しない", () => {
  const w = createWorld("beacon-dash", 4520, 20);
  const e = spawn(w, "harrow", 0, 0)!;
  Object.assign(e, {
    y: 0,
    harrowAirborne: false,
    harrow: {
      kind: "Dash",
      started: 0,
      fired: false,
      yaw: 0,
      from: { x: 0, y: 0, z: 0 },
      to: { x: 0, y: 0, z: 12 },
    },
  });
  const view = new HarrowEffects(),
    matrix = new T.Matrix4();
  try {
    w.time = 0.39;
    view.update(w);
    expect(beacon(view).count).toBe(0);
    w.time = 0.4;
    const before = structuredClone(w);
    view.update(w);
    expect(w).toEqual(before);
    expect(beacon(view).count).toBe(2);
    const discs = view.root.children[6] as TerrainProjectedMarkers;
    for (const [slot, index] of [
      [0, 0],
      [1, discs.count - 1],
    ]) {
      beacon(view).getMatrixAt(slot, matrix);
      expect(matrix.elements[12]).toBeCloseTo(discs.ringInfo(index)!.x);
      expect(matrix.elements[14]).toBeCloseTo(discs.ringInfo(index)!.z);
    }
    w.time = HARROW.dashWind;
    view.update(w);
    expect(beacon(view).visible).toBe(false);
  } finally {
    view.dispose();
  }
});

it("屋根上の着弾高と奥行き判定を保ち、固定バッファを再利用する", () => {
  const view = new HarrowEffects(),
    matrix = new T.Matrix4(),
    b = beacon(view);
  const geometry = b.geometry,
    buffer = b.instanceMatrix.array;
  try {
    for (let i = 0; i < 50; i++)
      view.update({
        time: 1.5,
        stage: 20,
        campaignPlan: { ...stageFor({ stage: 20 }), map: 1 },
        harrowMissiles: [{ ...bomb, target: { x: -58, y: 6.06, z: -64 } }],
      });
    b.getMatrixAt(0, matrix);
    expect(matrix.elements[13]).toBeCloseTo(6.15);
    expect(b.material.depthTest).toBe(true);
    expect(b.material.transparent).toBe(true);
    expect(b.material.depthWrite).toBe(false);
    expect(b.geometry).toBe(geometry);
    expect(b.instanceMatrix.array).toBe(buffer);
    expect(b.count).toBe(1);
  } finally {
    view.dispose();
  }
});

it("多数の目印でも確保済み容量を超えず、空更新で残像を消す", () => {
  const b = new HarrowWarningBeacons();
  try {
    b.begin();
    for (let i = 0; i < 100; i++) b.addMarker({ x: i, y: 0, z: 0 });
    b.finish();
    expect(b.count).toBe(42);
    b.begin();
    b.finish();
    expect(b.visible).toBe(false);
  } finally {
    b.dispose();
  }
});
