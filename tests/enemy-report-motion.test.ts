import { it, expect } from "vitest";
import {
  ReportEffects,
  HARROW_REPORT_SEQUENCE,
  reportHarrowMissiles,
  reportPose,
  reportWorm,
} from "../src/client/enemy-report-motion";
import { HARROW } from "../src/shared/harrow";
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
      group.children.map((child) => (child as T.InstancedMesh).count),
    ).toEqual([10, 10, 10, 0]);
    effects.update("harrow", false, "idle", start + 0.1);
    expect(group.visible).toBe(false);
    expect(
      group.children.map((child) => (child as T.InstancedMesh).count),
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
