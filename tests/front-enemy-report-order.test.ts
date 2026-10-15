import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/shared/defs";
import { ENEMY_REPORT_ORDER } from "../src/shared/enemy-report-order";
import { STAGES } from "../src/shared/stages";

describe("エネミーレポートの遭遇順", () => {
  it("通常の作戦編成で初めて登場する順に並ぶ", () => {
    const encountered = new Set<string>();
    for (const stage of STAGES) {
      for (const wave of stage.waves) {
        for (const [kind, count] of Object.entries(wave.troops)) {
          if (count > 0) encountered.add(kind);
        }
        for (const boss of wave.bosses) {
          encountered.add(boss === "crown" ? "boss" : boss);
        }
      }
    }
    expect([...ENEMY_REPORT_ORDER]).toEqual([...encountered]);
  });

  it("PLEATからHARROWまで、連結個体を含む全種を一度ずつ載せる", () => {
    expect(ENEMY_REPORT_ORDER[0]).toBe("crawler");
    expect(ENEMY_REPORT_ORDER.at(-1)).toBe("harrow");
    expect(new Set(ENEMY_REPORT_ORDER).size).toBe(ENEMY_REPORT_ORDER.length);
    expect([...ENEMY_REPORT_ORDER].sort()).toEqual(
      [...Object.keys(ENEMIES), "worm"].sort(),
    );
  });
});
