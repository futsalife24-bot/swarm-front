import { it, expect } from "vitest";
import { reportPose, reportWorm } from "../src/client/enemy-report-motion";

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
