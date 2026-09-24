import { it, expect } from "vitest";
import {
  ReportEffects,
  HARROW_REPORT_SEQUENCE,
  reportHarrowMissiles,
  reportPose,
  reportWorm,
} from "../src/client/enemy-report-motion";
import { HARROW, harrowMissilePosition } from "../src/shared/harrow";
import * as T from "three";

it("observes HARROW spin, full threat, dive and staggered fall in one grounded loop", () => {
  let start = 0;
  const seen: string[] = [];
  for (const phase of HARROW_REPORT_SEQUENCE) {
    const pose = reportPose("harrow", "attack", start + 0.01);
    expect(pose.clip).toBe(phase.clip);
    expect(pose.height).toBeGreaterThanOrEqual(0);
    seen.push(pose.clip);
    if (phase.clip === "Threat")
      expect(reportPose("harrow", "attack", start + 3.99).clip).toBe("Threat");
    if (phase.clip === "Dive" || phase.clip === "StaggerFall") {
      expect(
        reportPose("harrow", "attack", start + phase.duration - 0.01).height,
      ).toBeLessThan(pose.height);
    }
    start += phase.duration;
  }
  expect(seen).toEqual(
    expect.arrayContaining([
      "Spin",
      "Threat",
      "AirThreat",
      "Takeoff",
      "Flight",
      "Glide",
      "Dive",
      "Land",
      "StaggerFall",
    ]),
  );
  expect(reportPose("harrow", "attack", start + 0.1).clip).toBe("Spin");
  expect(reportPose("harrow", "move", 5)).toMatchObject({
    clip: "Locomotion",
    height: 0,
  });
  expect(reportPose("harrow", "idle", 5)).toMatchObject({
    clip: "Idle",
    height: 0,
  });
});

it("keeps the upright airborne missile phase at combat altitude through release", () => {
  const index = HARROW_REPORT_SEQUENCE.findIndex(
    (phase) => phase.clip === "AirThreat",
  );
  expect(index).toBeGreaterThan(0);
  const start = HARROW_REPORT_SEQUENCE.slice(0, index).reduce(
    (sum, phase) => sum + phase.duration,
    0,
  );
  for (const age of [0.01, 3.5, HARROW.threatDuration - 0.01]) {
    const pose = reportPose("harrow", "attack", start + age);
    expect(pose.clip).toBe("AirThreat");
    expect(pose.sample).toBeCloseTo(age);
    expect(pose.impact).toBe(3.5);
    expect(pose.height * HARROW.scale).toBeCloseTo(HARROW.flightHeight);
  }
  expect(reportPose("harrow", "attack", start - 0.01).clip).toBe("Flight");
  expect(
    reportPose("harrow", "attack", start + HARROW.threatDuration + 0.01),
  ).toMatchObject({
    clip: "Glide",
    height: HARROW.flightHeight / HARROW.scale,
  });
});

it("renders airborne missiles from the upright wing tips without moving ground markers up with the model", () => {
  const index = HARROW_REPORT_SEQUENCE.findIndex(
    (phase) => phase.clip === "AirThreat",
  );
  const start = HARROW_REPORT_SEQUENCE.slice(0, index).reduce(
    (sum, phase) => sum + phase.duration,
    0,
  );
  const airborne = reportHarrowMissiles(true);
  const ground = reportHarrowMissiles();
  const original = JSON.stringify(airborne);
  expect(airborne).toHaveLength(10);
  expect(airborne.filter((missile) => missile.origin.x > 0)).toHaveLength(5);
  expect(airborne.filter((missile) => missile.origin.x < 0)).toHaveLength(5);
  // First physical red-warhead tip measured from v8 AirThreat at 3.5 seconds.
  // The report's heading mirrors the symmetric X coordinates, but not Z.
  expect(airborne[0].origin.x / HARROW.scale).toBeCloseTo(6.35393, 5);
  expect(
    (airborne[0].origin.y - HARROW.flightHeight) / HARROW.scale,
  ).toBeCloseTo(7.861266, 5);
  expect(airborne[0].origin.z / HARROW.scale).toBeCloseTo(0.264011, 5);
  expect(ground[0].origin.y / HARROW.scale).toBeCloseTo(6.446827, 5);
  expect(ground[0].origin.z / HARROW.scale).toBeCloseTo(-2.32226, 5);
  expect(airborne.map((missile) => missile.target)).toEqual(
    ground.map((missile) => missile.target),
  );
  expect(airborne.every((missile) => missile.launch === 3.5)).toBe(true);

  const effects = new ReportEffects();
  const group = effects.root.children.find(
    (child) => child instanceof T.Group,
  )!;
  const markers = group.children[0] as T.Mesh;
  const bodies = group.children[1] as T.InstancedMesh;
  try {
    effects.update("harrow", false, "attack", start + HARROW.markerLead - 0.01);
    expect(bodies.count).toBe(0);
    expect(group.visible).toBe(true);
    effects.root.updateMatrixWorld(true);
    const marker = new T.Vector3()
      .fromBufferAttribute(markers.geometry.getAttribute("position"), 0)
      .applyMatrix4(markers.matrixWorld);
    expect(marker.y).toBeCloseTo(0.12 / HARROW.scale);

    const time = start + HARROW.markerLead + 0.001;
    effects.update("harrow", false, "attack", time);
    effects.root.updateMatrixWorld(true);
    expect(bodies.count).toBe(10);
    const matrix = new T.Matrix4();
    const actual = new T.Vector3();
    const age = reportPose("harrow", "attack", time).sample;
    airborne.forEach((missile, index) => {
      bodies.getMatrixAt(index, matrix);
      actual.setFromMatrixPosition(matrix.premultiply(bodies.matrixWorld));
      const expected = harrowMissilePosition(missile, age);
      expect(actual.x).toBeCloseTo(expected.x / HARROW.scale, 5);
      expect(actual.y).toBeCloseTo(expected.y / HARROW.scale, 5);
      expect(actual.z).toBeCloseTo(expected.z / HARROW.scale, 5);
      expect(actual.y).toBeGreaterThan(HARROW.flightHeight / HARROW.scale);
    });
    effects.update(
      "harrow",
      false,
      "attack",
      start + airborne[0].impact + 0.01,
    );
    expect(bodies.count).toBe(0);
    effects.update("harrow", false, "idle", time);
    expect(group.visible).toBe(false);
    expect(JSON.stringify(airborne)).toBe(original);
  } finally {
    effects.dispose();
  }
});

it("observes ten upward missiles and clears them when leaving attack playback", () => {
  const missiles = reportHarrowMissiles();
  expect(missiles).toHaveLength(10);
  expect(missiles.filter((m) => m.origin.x > 0)).toHaveLength(5);
  expect(missiles.filter((m) => m.origin.x < 0)).toHaveLength(5);
  const effects = new ReportEffects();
  try {
    const start = HARROW.spinDuration + 0.8;
    effects.update("harrow", false, "attack", start + HARROW.markerLead + 0.1);
    const group = effects.root.children.find(
      (child) => child instanceof T.Group,
    )!;
    expect(group.visible).toBe(true);
    expect(
      group.children
        .filter((child) => !(child instanceof T.Group))
        .map((child) => (child as T.InstancedMesh).count),
    ).toEqual([10, 10, 10, 0]);
    expect(group.getObjectByName("HARROW_SPIN_PRESSURE")?.visible).toBe(false);
    effects.update("harrow", false, "idle", start + 0.1);
    expect(group.visible).toBe(false);
    expect(
      group.children
        .filter((child) => !(child instanceof T.Group))
        .map((child) => (child as T.InstancedMesh).count),
    ).toEqual([0, 0, 0, 0]);
  } finally {
    effects.dispose();
  }
});

it("shows VOLLEY release at its actual wind-up time and keeps PLEAT independent", () => {
  expect(reportPose("ant", "attack", 0.4).sample).toBeCloseTo(0.225);
  expect(reportPose("ant", "attack", 0.8).sample).toBeCloseTo(0.45);
  expect(reportPose("crawler", "attack", 0.45).sample).toBeCloseTo(0.45);
});
it("keeps the LEAPER ground/air cycle bounded and stops at a grounded idle pose", () => {
  expect(reportPose("spider", "move", 0.4)).toMatchObject({
    height: 0,
    sample: 0.4,
  });
  expect(reportPose("spider", "move", 0.825).height).toBeCloseTo(0.65);
  expect(reportPose("spider", "move", 1.4)).toMatchObject({
    height: 0,
    sample: 1.4,
  });
  expect(reportPose("spider", "move", 2)).toMatchObject({
    height: 0,
    sample: 0,
  });
  expect(reportPose("spider", "idle", 0)).toMatchObject({
    clip: "Idle",
    height: 0,
    sample: 0,
  });
});
it("builds independent foundry snapshots and resets movement for attack/idle", () => {
  const move = reportWorm("move", 2),
    before = JSON.stringify(move);
  const attack = reportWorm("attack", 2);
  expect(move.z).toBe(-8.4);
  expect(attack.z).toBe(0);
  expect(attack.segments).toHaveLength(7);
  expect(attack.pulseAim).toBeDefined();
  expect(reportWorm("idle", 0).pulseAim).toBeUndefined();
  attack.segments![0].x = 100;
  expect(JSON.stringify(move)).toBe(before);
});
