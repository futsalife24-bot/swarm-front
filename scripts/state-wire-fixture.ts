import { createFrontRun } from "../src/shared/front-run";
import { event, spawn, type Enemy, type World } from "../src/shared/game";
import { createPleat } from "../src/shared/pleat-locomotion";

/** 固定条件の混雑状態。実プレイでの発生頻度を示すものではない。 */
export function denseWireFixture(projectiles = 180) {
  const ids = Array.from({ length: 4 }, (_, i) => String(i).padStart(32, "0"));
  const run = createFrontRun(
    {
      runId: "wire-dense-fixed",
      seed: 4520,
      mode: "survival",
      fusion: true,
      clearedStage: 10,
      players: ids.map((id) => ({ id })),
    },
    0,
  );
  const w = run.world;
  populateDenseWireWorld(w, ids, projectiles);
  const metadata = {
    members: ids.map((id) => ({
      id,
      name: "隊員",
      ready: true,
      connected: true,
    })),
    stage: 1,
    preparationGeneration: 0,
  };
  return { w, ids, metadata };
}

/** 実Worker試験でも同じ敵・オーブ・弾の密集を再現する。 */
export function populateDenseWireWorld(
  w: World,
  ids: string[],
  projectiles = 180,
) {
  if (!w.front || ids.length !== 4) throw new Error("4人の生存戦が必要です");
  w.enemies = [];
  w.events = [];
  const kinds: Enemy["kind"][] = [
    "hornet",
    "ant",
    "spitter",
    "spider",
    "bastion",
    "calyx",
    "harrow",
    "boss",
  ];
  for (let i = 0; i < 96; i++) {
    const kind = i < 48 ? "crawler" : kinds[(i - 48) % kinds.length];
    const e = spawn(
      w,
      kind,
      (i % 12) * 3 - 18,
      Math.floor(i / 12) * 3 - 12,
      "crown",
    )!;
    Object.assign(e, {
      x: (i % 12) * 3.123456 - 18,
      z: Math.floor(i / 12) * 3.123456 - 12,
      active: true,
      targetId: ids[i % 4],
      heading: 1.234567,
      wallYaw: 1.234567,
      navigation: {
        until: 71.123456789,
        point: { x: 42.123456789, z: -13.123456789 },
      },
      steerUntil: 14.987654321,
      steerAngle: 1.23456789,
      wallCooldown: 9.123456789,
      jumpFrom: 3.123456789,
      jumpWait: 1.123456789,
      flightUntil: 91.123456789,
      flightHeight: 6.123456789,
    });
    if (kind === "crawler")
      e.pleat = createPleat(
        { x: e.x, y: e.y, z: e.z },
        { x: 0, y: 0, z: 1 },
        1.123456,
        { ray: () => undefined },
      );
    // 通信形状の試験用に節と内部経路を合成する。実マップ生成の成否とは区別する。
    if (i === 55)
      e.segments = Array.from({ length: 7 }, (_, n) => ({
        x: e.x + n,
        y: 0,
        z: e.z - n,
        partHp: 100,
        heading: 1.123456,
        acidAt: 15.123456,
        pulseAim: { x: 0, y: 1, z: 0 },
        trail: [{ x: 2.123456789, z: 3.123456789 }],
      }));
  }
  w.front!.orbs = Array.from({ length: 160 }, (_, i) => ({
    id: 10000 + i,
    x: (i % 16) * 2.123456,
    y: 0.123456,
    z: Math.floor(i / 16) * 2.123456,
    value: 2,
  }));
  w.projectiles = Array.from({ length: projectiles }, (_, i) => ({
    id: 20000 + i,
    owner: ids[i % 4],
    x: 4.123456,
    y: 5.123456,
    z: 6.123456,
    dx: 0.123456,
    dy: 0.654321,
    dz: 0.987654,
    life: 3.123456,
    damage: 40,
    rocket: false,
    style: "laser",
  }));
  for (let i = 0; i < 120; i++)
    event(w, {
      type: "shot",
      weapon: "shotgun",
      x: 4.123456,
      y: 5.123456,
      z: 6.123456,
      tx: 7.123456,
      ty: 8.123456,
      tz: 9.123456,
      owner: ids[i % 4],
    });
}
