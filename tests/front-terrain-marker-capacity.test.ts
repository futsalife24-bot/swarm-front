import { expect, it } from "vitest";
import * as T from "three";
import { HarrowEffects } from "../src/client/harrow-effects";
import { TerrainProjectedMarkers } from "../src/client/terrain-projected-marker";
import { HARROW } from "../src/shared/harrow";
import type { Enemy } from "../src/shared/game";
import { MAPS, stageFor } from "../src/shared/stages";
import { supportHeight } from "../src/shared/terrain";

it("合法なHARROW Dash予告のfilled discが既存草原の小数座標で容量超過しない", () => {
  const blocks = MAPS[3].blocks;
  const from = {
    x: 5.25,
    y: supportHeight(5.25, 10.3, blocks),
    z: 10.3,
  };
  const control = new TerrainProjectedMarkers(
    new T.MeshBasicMaterial(),
    1,
    1024,
  );
  try {
    control.setDisc(0, { ...from, z: 10.25 }, HARROW.dashRadius, blocks);
    expect(control.ringInfo(0)?.triangles).toBe(1012);
  } finally {
    control.dispose();
    control.material.dispose();
  }

  const enemy: Enemy = {
    id: 1,
    kind: "harrow",
    ...from,
    hp: 100,
    maxHp: 100,
    cool: 0,
    wind: 0,
    hurt: 0,
    tx: from.x,
    tz: from.z + HARROW.dashDistance,
    harrow: {
      kind: "Dash",
      started: 0,
      fired: false,
      yaw: 0,
      from,
      to: { ...from, z: from.z + HARROW.dashDistance },
    },
  };
  const effects = new HarrowEffects();
  try {
    expect(() =>
      effects.update({
        time: HARROW.dashWind * 0.75,
        enemies: [enemy],
        harrowMissiles: [],
        campaignPlan: { ...stageFor({}), map: 3 },
      }),
    ).not.toThrow();
    const dash = effects.root.children[6] as TerrainProjectedMarkers;
    expect(dash.count).toBe(13);
    expect(dash.ringInfo(0)?.filled).toBe(true);
  } finally {
    effects.dispose();
  }
});
