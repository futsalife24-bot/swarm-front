import { describe, expect, it } from "vitest";
import { BUDDY_ASSETS } from "../src/client/buddy-assets";
import {
  BUDDY_SKILL_RECOVERY,
  sampleBuddySkillPose,
} from "../src/client/buddy-skill-motion";

const cast = {
  chargeStartedAt: -1,
  skillStartedAt: 10,
  skillImpactAt: 10.65,
  skillCharge: 0,
};
const rest = {
  casting: false,
  charging: false,
  clipProgress: 0,
  jump: 0,
  scaleY: 1,
  scaleXZ: 1,
};

describe("バディ発動の絶対時刻モーション", () => {
  it("タタラは屈んでから跳び、衝撃より前に頂点を越えて接地する", () => {
    const crouch = sampleBuddySkillPose("tatara", cast, 10.08);
    expect(crouch.jump).toBe(0);
    expect(crouch.scaleY).toBeLessThan(0.8);
    const peakAt = 10 + 0.65 * 0.62;
    const peak = sampleBuddySkillPose("tatara", cast, peakAt);
    expect(peakAt).toBeLessThan(cast.skillImpactAt);
    expect(peak.jump).toBeCloseTo(1.05);
    expect(sampleBuddySkillPose("tatara", cast, 10.6).jump).toBeLessThan(
      peak.jump,
    );
    const impact = sampleBuddySkillPose("tatara", cast, cast.skillImpactAt);
    expect(impact.jump).toBe(0);
    expect(impact.scaleY).toBeCloseTo(0.76);
    expect(impact.clipProgress).toBeCloseTo(0.65);
  });

  it("回復終了では高さ・scaleが完全復帰し、古いsnapshotは再発動しない", () => {
    expect(sampleBuddySkillPose("tatara", cast, 10.75).casting).toBe(true);
    expect(
      sampleBuddySkillPose(
        "tatara",
        cast,
        cast.skillImpactAt + BUDDY_SKILL_RECOVERY,
      ),
    ).toEqual(rest);
    expect(sampleBuddySkillPose("tatara", cast, 300)).toEqual(rest);
    expect(sampleBuddySkillPose("tatara", undefined, 10)).toEqual(rest);
    expect(sampleBuddySkillPose("tatara", {}, 10)).toEqual(rest);
    expect(sampleBuddySkillPose("tatara", cast, 9)).toEqual(rest);
  });

  it("同じ時刻はフレーム履歴によらず同じ姿勢で、チャージ強化も有限", () => {
    const time = 10 + 0.65 * 0.62;
    const full = { ...cast, skillCharge: 1 };
    const before = sampleBuddySkillPose("tatara", full, time);
    for (let i = 0; i < 100; i++)
      sampleBuddySkillPose("tatara", full, 10 + i / 150);
    expect(sampleBuddySkillPose("tatara", full, time)).toEqual(before);
    expect(before.jump).toBeCloseTo(1.5);
    expect(
      sampleBuddySkillPose("tatara", { ...full, skillCharge: 100 }, time),
    ).toEqual(before);
    expect(
      sampleBuddySkillPose("tatara", { ...full, skillCharge: NaN }, time).jump,
    ).toBeCloseTo(1.05);
    expect(
      sampleBuddySkillPose(
        "tatara",
        { ...cast, skillImpactAt: Infinity },
        time,
      ),
    ).toEqual(rest);
    expect(sampleBuddySkillPose("tatara", cast, NaN)).toEqual(rest);
  });

  it("チャージは前回の強さを使わず、解除時に残留変形がない", () => {
    const held = {
      ...cast,
      skillStartedAt: -1,
      skillImpactAt: -1,
      chargeStartedAt: 20,
    };
    const first = sampleBuddySkillPose("tatara", held, 20.1);
    const stale = sampleBuddySkillPose(
      "tatara",
      { ...held, skillCharge: 1 },
      20.1,
    );
    expect(first).toEqual(stale);
    expect(first.charging).toBe(true);
    expect(first.jump).toBe(0);
    expect(sampleBuddySkillPose("tatara", held, 22).scaleY).toBeLessThan(
      first.scaleY,
    );
    expect(
      sampleBuddySkillPose("tatara", { ...held, chargeStartedAt: -1 }, 22),
    ).toEqual(rest);
  });

  it("軽減設定では跳躍・変形を抑え、他3体には跳躍を追加しない", () => {
    const time = 10 + 0.65 * 0.62;
    expect(sampleBuddySkillPose("tatara", cast, time, true).jump).toBeCloseTo(
      1.05 * 0.15,
    );
    expect(
      sampleBuddySkillPose("tatara", cast, 10.08, true).scaleY,
    ).toBeGreaterThan(0.9);
    for (const kind of Object.keys(
      BUDDY_ASSETS,
    ) as (keyof typeof BUDDY_ASSETS)[]) {
      if (kind === "tatara") continue;
      const state = { ...cast, skillImpactAt: 10.35 };
      for (let i = 0; i < 55; i++) {
        const pose = sampleBuddySkillPose(kind, state, 10 + i / 100);
        expect(pose.jump).toBe(0);
        expect(pose.clipProgress).toBeGreaterThanOrEqual(0);
        expect(pose.clipProgress).toBeLessThanOrEqual(1);
      }
      expect(sampleBuddySkillPose(kind, state, 11)).toEqual(rest);
    }
  });
});
