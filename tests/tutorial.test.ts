import { describe, expect, it } from "vitest";
import type { Input } from "../src/shared/game";
import { TARGETS } from "../src/shared/training";
import { maxHp, useMedkit } from "../src/shared/solo-progression";
import {
  HEALTH_DRILL_HP,
  SAMPLE_DROP_ID,
  TUTORIAL_KILL_TARGETS,
  TUTORIAL_PLAYER,
  clearTutorialLoot,
  createTutorialWorld,
  placeKillTargets,
  placeSampleDrop,
  prepareHealthDrill,
  stepTutorial,
} from "../src/shared/tutorial";
import {
  HIT_GOAL,
  KILL_GOAL,
  LOOK_GOAL_DEG,
  MEDKIT_SHOW_S,
  MOVE_GOAL_M,
  NUDGE_AFTER_S,
  SKIP_AFTER_S,
  TUTORIAL_STEPS,
  TutorialRun,
  lineSeconds,
  type TutorialAction,
} from "../src/client/tutorial-run";

const idle = (): Input => ({ mx: 0, mz: 0, yaw: 0, pitch: 0, seq: 0 });
const said = (actions: TutorialAction[]) =>
  actions.flatMap((a) => (a.type === "say" ? [a.id] : []));

describe("tutorial world (W2)", () => {
  it("starts on the training range with durable targets and no loot", () => {
    const w = createTutorialWorld();
    expect(w.training).toBe(true);
    expect(w.enemies).toHaveLength(TARGETS.length);
    stepTutorial(w, idle(), "practice");
    expect(w.rewards).toEqual({});
    expect(w.drops).toEqual([]);
    expect(w.pending[TUTORIAL_PLAYER]).toEqual([]);
  });
  it("restores practice targets but lets kill targets stay down", () => {
    const w = createTutorialWorld();
    w.enemies[0].hp = 0;
    stepTutorial(w, idle(), "practice");
    expect(w.enemies).toHaveLength(TARGETS.length);
    placeKillTargets(w);
    expect(w.enemies).toHaveLength(TUTORIAL_KILL_TARGETS);
    expect(w.enemies.every((e) => e.hp < 1000)).toBe(true);
    w.enemies[0].hp = 0;
    stepTutorial(w, idle(), "kill");
    expect(w.enemies).toHaveLength(TUTORIAL_KILL_TARGETS - 1);
    // 撃破で落ちた物は残さない。
    expect(w.drops).toEqual([]);
  });
  it("lets the soldier collect only the sample weapon, never as a reward", () => {
    const w = createTutorialWorld();
    placeSampleDrop(w);
    expect(w.drops.map((d) => d.id)).toEqual([SAMPLE_DROP_ID]);
    const drop = w.drops[0];
    const p = w.players[0];
    p.x = drop.x;
    p.z = drop.z;
    stepTutorial(w, idle(), "drop");
    expect(w.pending[TUTORIAL_PLAYER]).toHaveLength(1);
    expect(w.drops).toEqual([]);
    expect(w.rewards).toEqual({});
    stepTutorial(w, idle(), "practice");
    expect(w.pending[TUTORIAL_PLAYER]).toEqual([]);
    placeSampleDrop(w);
    clearTutorialLoot(w);
    expect(w.drops).toEqual([]);
    expect(w.pending[TUTORIAL_PLAYER]).toEqual([]);
  });
});

function runTo(index: number) {
  const run = new TutorialRun(() => 0);
  const w = createTutorialWorld();
  run.begin();
  while (run.index < index) apply(run, w, skipNow(run));
  return { run, w };
}
function apply(
  run: TutorialRun,
  w: ReturnType<typeof createTutorialWorld>,
  a: TutorialAction[],
) {
  for (const action of a)
    if (action.type === "arena") {
      if (action.arena === "kill") placeKillTargets(w);
      else if (action.arena === "drop") placeSampleDrop(w);
      else if (action.arena === "health") prepareHealthDrill(w);
    }
  return a;
}
/** テスト用: 10秒待って「この手順を飛ばす」（T10 は「次へ」）。 */
function skipNow(run: TutorialRun) {
  run.elapsed = SKIP_AFTER_S;
  return run.step.id === "T10" ? run.next() : run.skip();
}

describe("tutorial run (W3)", () => {
  it("defines the 12 steps of the proposal", () => {
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual([
      "T0",
      "T1",
      "T2",
      "T3",
      "T4",
      "T5",
      "T6",
      "T7",
      "T8",
      "T9",
      "T10",
      "T11",
    ]);
  });
  it("opens with the intro and the first step, then advances on movement", () => {
    const run = new TutorialRun(() => 0);
    const w = createTutorialWorld();
    expect(said(run.begin())).toEqual(["tut-intro", "tut-move"]);
    expect(run.step.id).toBe("T1");
    run.observe(w, 0, 0.1);
    w.players[0].z -= MOVE_GOAL_M / 2;
    run.observe(w, 0, 0.1);
    expect(run.text("pc")).toContain(`${MOVE_GOAL_M / 2}/${MOVE_GOAL_M}m`);
    w.players[0].z -= MOVE_GOAL_M / 2 + 0.1;
    const done = run.observe(w, 0, 0.1);
    expect(said(done)).toEqual(["tut-ack-1", "tut-look"]);
    expect(run.step.id).toBe("T2");
  });
  it("counts look rotation, hits, reload, swap, dodge and jump", () => {
    const { run, w } = runTo(2);
    run.observe(w, 0, 0.1);
    run.observe(w, ((LOOK_GOAL_DEG + 1) * Math.PI) / 180, 0.1);
    expect(run.step.id).toBe("T3");
    run.observe(w, 0, 0.1);
    for (let i = 0; i < HIT_GOAL; i++)
      w.events.push({
        id: 1000 + i,
        type: "hit",
        owner: TUTORIAL_PLAYER,
        x: 0,
        y: 0,
        z: 0,
      });
    run.observe(w, 0, 0.1);
    expect(run.step.id).toBe("T4");
    const p = w.players[0];
    run.observe(w, 0, 0.1);
    p.reload = 1;
    run.observe(w, 0, 0.1);
    expect(run.step.id).toBe("T4");
    p.reload = 0;
    run.observe(w, 0, 0.1);
    expect(run.step.id).toBe("T5");
    run.observe(w, 0, 0.1);
    p.slot = 1;
    run.observe(w, 0, 0.1);
    expect(run.step.id).toBe("T6");
    run.observe(w, 0, 0.1);
    p.evade = 0.2;
    run.observe(w, 0, 0.1);
    expect(run.step.id).toBe("T7");
    run.observe(w, 0, 0.1);
    p.y = 0.5;
    run.observe(w, 0, 0.1);
    expect(run.step.id).toBe("T8");
  });
  it("needs three kills, then the sample pickup with the drop rule", () => {
    const { run, w } = runTo(8);
    run.observe(w, 0, 0.1);
    for (let i = 0; i < KILL_GOAL; i++)
      w.events.push({
        id: 2000 + i,
        type: "kill",
        owner: TUTORIAL_PLAYER,
        x: 0,
        y: 0,
        z: 0,
      });
    apply(run, w, run.observe(w, 0, 0.1));
    expect(run.step.id).toBe("T9");
    run.observe(w, 0, 0.1);
    w.pending[TUTORIAL_PLAYER] = [w.drops[0].weapon];
    const picked = run.observe(w, 0, 0.1);
    expect(said(picked)).toContain("tut-drop-rule");
    expect(run.step.id).toBe("T9");
    run.observe(w, 0, lineSeconds("tut-drop-rule") + 0.1);
    expect(run.step.id).toBe("T10");
  });
  it("plays both health lines in turn and advances by itself after the medkit", () => {
    const { run, w } = runTo(10);
    expect(run.manual).toBe("next");
    const second = run.observe(w, 0, lineSeconds("tut-recover") + 0.4);
    expect(said(second)).toEqual(["tut-medkit"]);
    // 救急箱を使うまでは、台詞が終わっても自動では進まない（「次へ」は出たまま）。
    expect(said(run.observe(w, 0, lineSeconds("tut-medkit") + 1))).toEqual([]);
    expect(run.step.id).toBe("T10");
    expect(run.manual).toBe("next");
    stepTutorial(w, { ...idle(), revive: true }, "health");
    expect(w.tutorialKit?.medkit).toBe(false);
    expect(said(run.observe(w, 0, 0.1))).toEqual([]);
    const end = run.observe(w, 0, MEDKIT_SHOW_S);
    expect(said(end)).toEqual(["tut-complete"]);
    expect(end.some((a) => a.type === "complete")).toBe(true);
    expect(run.step.id).toBe("T11");
    expect(run.manual).toBe("finish");
    expect(run.done).toBe(true);
  });
  it("never repeats the previous acknowledgement", () => {
    const run = new TutorialRun(() => 0);
    const w = createTutorialWorld();
    run.begin();
    const acks: string[] = [];
    for (let i = 0; i < 3; i++) {
      run.observe(w, 0, 0.1);
      w.players[0].z -= 20;
      w.events.push({
        id: 3000 + i * 10,
        type: "hit",
        owner: TUTORIAL_PLAYER,
        x: 0,
        y: 0,
        z: 0,
      });
      const a = said(run.observe(w, Math.PI, 0.1)).filter((id) =>
        id.startsWith("tut-ack"),
      );
      acks.push(...a);
    }
    for (let i = 1; i < acks.length; i++) expect(acks[i]).not.toBe(acks[i - 1]);
  });
  it("nudges once after 20 seconds and offers a skip after 10", () => {
    const { run, w } = runTo(1);
    run.observe(w, 0, 0.1);
    expect(run.canSkip).toBe(false);
    run.observe(w, 0, SKIP_AFTER_S);
    expect(run.canSkip).toBe(true);
    expect(said(run.observe(w, 0, NUDGE_AFTER_S))).toEqual(["tut-nudge"]);
    expect(said(run.observe(w, 0, NUDGE_AFTER_S))).toEqual([]);
    expect(said(run.skip())).toEqual(["tut-look"]);
  });
  it("ends from the pause menu with the skip line", () => {
    const { run } = runTo(3);
    expect(said(run.quit())).toEqual(["tut-skip"]);
    expect(run.quit()).toEqual([]);
  });
  it("T9: the sample weapon survives the first tick after T8 and is collected by walking to it", () => {
    // 不具合1（2026-11-15）: T8 で標的を倒した後に見本を置くと、最初の tick の
    // 練習標的リセット（resetTargets）がドロップまで消していた。
    for (const killed of [true, false]) {
      const { run, w } = runTo(8);
      run.observe(w, 0, 0.1);
      if (killed) {
        for (const e of w.enemies) e.hp = 0;
        stepTutorial(w, idle(), "kill");
        expect(w.enemies).toHaveLength(0);
      }
      apply(run, w, skipNow(run));
      expect(run.step.id).toBe("T9");
      for (let i = 0; i < 5; i++) stepTutorial(w, idle(), "drop");
      expect(w.drops.map((d) => d.id)).toEqual([SAMPLE_DROP_ID]);
      expect(w.enemies).toHaveLength(TARGETS.length);
      run.observe(w, 0, 0.1);
      // 兵士が見本の武器へ歩いて近づくだけで回収でき、手順が達成になる。
      let picked: TutorialAction[] = [];
      for (let i = 0; i < 200 && w.drops.length; i++) {
        const p = w.players[0],
          d = w.drops[0];
        const yaw = Math.atan2(d.x - p.x, -(d.z - p.z));
        stepTutorial(w, { ...idle(), mz: 1, yaw }, "drop");
        picked = run.observe(w, yaw, 0.05);
        if (said(picked).length) break;
      }
      expect(w.drops).toEqual([]);
      expect(w.pending[TUTORIAL_PLAYER]).toHaveLength(1);
      expect(said(picked)).toContain("tut-drop-rule");
      expect(w.rewards).toEqual({});
    }
  });
  it("T9: places the sample in view, inside the range and clear of the targets", () => {
    const w = createTutorialWorld();
    const p = w.players[0];
    const spots = [
      { x: 0, z: 16, yaw: 0 },
      { x: 0, z: 12, yaw: 0 }, // 正面に練習標的（0, 6）がある
      { x: 20, z: -44, yaw: Math.PI / 2 }, // 壁際の隅で壁を向いている
      { x: -10, z: 0, yaw: Math.PI },
    ];
    for (const s of spots) {
      p.x = s.x;
      p.z = s.z;
      placeSampleDrop(w, s.yaw);
      const d = w.drops[0];
      expect(w.drops).toHaveLength(1);
      expect(Math.abs(d.x)).toBeLessThanOrEqual(20);
      expect(d.z).toBeGreaterThanOrEqual(-44);
      expect(d.z).toBeLessThanOrEqual(20);
      // 回収半径（3m）より遠いので、近づく操作が必要。
      expect(Math.hypot(d.x - p.x, d.z - p.z)).toBeGreaterThan(3);
      for (const e of w.enemies)
        expect(Math.hypot(e.x - d.x, e.z - d.z)).toBeGreaterThanOrEqual(2.5);
    }
    // 開けた場所では、向いている方向の正面に置く。
    p.x = 0;
    p.z = 16;
    placeSampleDrop(w, 0);
    expect(w.drops[0].x).toBeCloseTo(0);
    expect(w.drops[0].z).toBeLessThan(p.z);
  });
  it("T10: the medkit works in training like solo (once, full heal) and regen stops at half", () => {
    const { run, w } = runTo(10);
    expect(run.step.arena).toBe("health");
    const p = w.players[0];
    const max = maxHp(w);
    expect(p.hp).toBeCloseTo(max * HEALTH_DRILL_HP);
    expect(w.tutorialKit).toEqual({ medkit: true });
    // 時間がたつと半分まで自動回復（半分を超えない）。
    for (let i = 0; i < 20 * 40; i++) stepTutorial(w, idle(), "health");
    expect(p.hp).toBeCloseTo(max * 0.5);
    // 救急箱ボタン（入力の revive）で全回復。1回だけ。
    stepTutorial(w, { ...idle(), revive: true }, "health");
    expect(p.hp).toBe(max);
    expect(w.tutorialKit?.medkit).toBe(false);
    p.hp = max * 0.3;
    stepTutorial(w, { ...idle(), revive: true }, "health");
    expect(p.hp).toBeLessThan(max * 0.5);
    expect(useMedkit(w, w.tutorialKit)).toBe(false);
    // 本編ソロ用の状態（w.solo）は作らない。
    expect(w.solo).toBeUndefined();
  });
  it("T10: the medkit cannot be used at full health and is not spent", () => {
    const w = createTutorialWorld();
    stepTutorial(w, { ...idle(), revive: true }, "practice");
    expect(w.tutorialKit?.medkit).toBe(true);
    expect(w.players[0].hp).toBe(maxHp(w));
  });
  it("shows touch and PC instructions separately", () => {
    const { run } = runTo(3);
    expect(run.text("touch")).toContain("射撃ボタンを長押し");
    expect(run.text("pc")).toContain("左クリック長押し");
    expect(run.text("pc")).toContain(`0/${HIT_GOAL}`);
  });
});
