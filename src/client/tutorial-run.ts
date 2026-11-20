/**
 * 基礎訓練の進行役（tutorial-proposal §4-1・§8-3 W3）。
 * ステップの状態機械と達成判定だけを持つ（DOM と音声の実体は training-app 側）。
 * - 声は「何をするか」、画面テキストは「どう操作するか」。タッチと PC は画面テキストで出し分ける。
 * - 音声の終了を進行条件にしない。台詞の長さは文字数からの見込みで扱い、声が無くても同じ速さで進む。
 * - 時間は一時停止中に進まないよう、呼び出し側が渡す dt だけで数える。
 * - 進行はメモリ上だけ。保存しない（中断したら最初から）。
 */
import type { World } from "../shared/game";
import type { TutorialArena } from "../shared/tutorial";
import { TUTORIAL_KILL_TARGETS, TUTORIAL_PLAYER } from "../shared/tutorial";
import { controlVoiceLine } from "./control-voice-lines";

export type TutorialDevice = "touch" | "pc";
export type TutorialStepId =
  | "T0"
  | "T1"
  | "T2"
  | "T3"
  | "T4"
  | "T5"
  | "T6"
  | "T7"
  | "T8"
  | "T9"
  | "T10"
  | "T11";

/** 進行条件の数値（画面テキストは定義値から作る。台詞には数値を入れない）。 */
export const MOVE_GOAL_M = 8;
export const LOOK_GOAL_DEG = 90;
export const HIT_GOAL = 5;
export const KILL_GOAL = TUTORIAL_KILL_TARGETS;
/** 回避の再使用時間（game.ts / hud.ts の 2.2 秒）。画面では「約2秒」と出す。 */
export const DODGE_COOLDOWN_S = 2.2;
/** 20秒たっても達成しなければ促しを1回。10秒たつと「この手順を飛ばす」を出す。 */
export const NUDGE_AFTER_S = 20;
export const SKIP_AFTER_S = 10;
/** 音声が無いときも同じ間で進めるための、台詞の長さの見込み（実測は約5.6字/秒）。 */
export const lineSeconds = (id: string) =>
  (controlVoiceLine(id)?.text.length ?? 0) / 5.5 + 0.3;
const ACKS = ["tut-ack-1", "tut-ack-2", "tut-ack-3"] as const;

export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  /** 開始時に流す台詞。T10 は2本を順に流す。 */
  lines: readonly string[];
  /** 達成で流す台詞（T9 の tut-drop-rule）。 */
  after?: string;
  goal: number;
  /** 画面テキスト（操作方法）。 */
  how: Record<TutorialDevice, string>;
  arena: TutorialArena;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "T0",
    title: "基礎訓練",
    lines: ["tut-intro"],
    goal: 0,
    how: {
      touch:
        "報酬なし · いつでも終了できます（ボタン配置は「設定・操作」で変更可）",
      pc: "報酬なし · いつでも終了できます（ボタン配置は「設定・操作」で変更可）",
    },
    arena: "practice",
  },
  {
    id: "T1",
    title: "移動",
    lines: ["tut-move"],
    goal: MOVE_GOAL_M,
    how: { touch: "タッチ：左スティック", pc: "PC：W A S D" },
    arena: "practice",
  },
  {
    id: "T2",
    title: "視点",
    lines: ["tut-look"],
    goal: LOOK_GOAL_DEG,
    how: { touch: "タッチ：画面右側をドラッグ", pc: "PC：右ドラッグ" },
    arena: "practice",
  },
  {
    id: "T3",
    title: "射撃",
    lines: ["tut-fire"],
    goal: HIT_GOAL,
    how: {
      touch: "タッチ：射撃ボタンを長押し（押したままドラッグで照準）",
      pc: "PC：左クリック長押し",
    },
    arena: "practice",
  },
  {
    id: "T4",
    title: "装填",
    lines: ["tut-reload"],
    goal: 1,
    how: {
      touch: "タッチ：装填ボタン　※弾切れのときは自動",
      pc: "PC：R　※弾切れのときは自動",
    },
    arena: "practice",
  },
  {
    id: "T5",
    title: "武器切替",
    lines: ["tut-swap"],
    goal: 1,
    how: { touch: "タッチ：切替ボタン", pc: "PC：Q" },
    arena: "practice",
  },
  {
    id: "T6",
    title: "回避",
    lines: ["tut-dodge"],
    goal: 1,
    how: {
      touch: `タッチ：回避ボタン　※再使用まで約${Math.round(DODGE_COOLDOWN_S)}秒`,
      pc: `PC：Space　※再使用まで約${Math.round(DODGE_COOLDOWN_S)}秒`,
    },
    arena: "practice",
  },
  {
    id: "T7",
    title: "ジャンプ",
    lines: ["tut-jump"],
    goal: 1,
    how: { touch: "タッチ：ジャンプボタン", pc: "PC：F" },
    arena: "practice",
  },
  {
    id: "T8",
    title: "訓練標的を撃破",
    lines: ["tut-kill"],
    goal: KILL_GOAL,
    how: {
      touch: "※スコープボタンで照準を拡大できます",
      pc: "※スコープ（Z）で照準を拡大できます",
    },
    arena: "kill",
  },
  {
    id: "T9",
    title: "回収",
    lines: ["tut-drop"],
    after: "tut-drop-rule",
    goal: 1,
    how: {
      touch: "落ちている武器に近づいて回収",
      pc: "落ちている武器に近づいて回収",
    },
    arena: "drop",
  },
  {
    id: "T10",
    title: "体力",
    lines: ["tut-recover", "tut-medkit"],
    goal: 0,
    how: {
      touch:
        "時間がたつと半分まで自動回復 · 救急箱ボタンで全回復（1出撃に1回）",
      pc: "時間がたつと半分まで自動回復 · H／救急箱で全回復（1出撃に1回）",
    },
    arena: "health",
  },
  {
    id: "T11",
    title: "基礎訓練 修了",
    lines: ["tut-complete"],
    goal: 0,
    how: { touch: "出撃準備へ", pc: "出撃準備へ" },
    arena: "practice",
  },
];

export type TutorialAction =
  | { type: "say"; id: string }
  | { type: "arena"; arena: TutorialArena }
  | { type: "step"; id: TutorialStepId }
  | { type: "complete" };

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** 練習ステップ（T1〜T9）だけが達成判定・促し・飛ばしを持つ。 */
const practice = (id: TutorialStepId) => !["T0", "T10", "T11"].includes(id);

export class TutorialRun {
  index = 0;
  progress = 0;
  /** ステップ内の経過秒（一時停止中は進まない）。 */
  elapsed = 0;
  started = false;
  done = false;
  private nudged = false;
  private lastAck?: string;
  private queue: { at: number; action: TutorialAction }[] = [];
  private base?: {
    x: number;
    z: number;
    yaw: number;
    slot: number;
    event: number;
    reloadSeen: boolean;
    pending: number;
  };
  /** T9 達成後、tut-drop-rule を聞く間（見込み）だけ待つ。 */
  private holdUntil?: number;
  constructor(private random: () => number = Math.random) {}

  get step() {
    return TUTORIAL_STEPS[this.index];
  }
  /** 進行表示（T1〜T11 の番号。T0 は開始画面）。 */
  get number() {
    return this.index;
  }
  get total() {
    return TUTORIAL_STEPS.length - 1;
  }
  /** 1行の案内（字幕を兼ねる画面テキスト）。 */
  text(device: TutorialDevice) {
    const s = this.step;
    const count =
      s.goal > 1
        ? `　${Math.min(s.goal, Math.floor(this.progress))}/${s.goal}${s.id === "T1" ? "m" : s.id === "T2" ? "°" : ""}`
        : "";
    return `${s.title}｜${s.how[device]}${count}`;
  }
  get canSkip() {
    return (
      this.started &&
      !this.done &&
      practice(this.step.id) &&
      this.holdUntil === undefined &&
      this.elapsed >= SKIP_AFTER_S
    );
  }
  /** T10 の「次へ」と T11 の「訓練を終える」。 */
  get manual(): "next" | "finish" | undefined {
    if (this.step.id === "T10") return "next";
    if (this.step.id === "T11") return "finish";
    return undefined;
  }

  /** T0「訓練を始める」。T0 の台詞に続けて T1 を始める（台詞は再生キューが順に流す）。 */
  begin(): TutorialAction[] {
    if (this.started) return [];
    this.started = true;
    const actions: TutorialAction[] = [{ type: "say", id: "tut-intro" }];
    return [...actions, ...this.enter(1)];
  }

  /** 毎フレーム。dt は一時停止中なら呼ばない。 */
  observe(w: World, yaw: number, dt: number): TutorialAction[] {
    if (!this.started || this.done) return [];
    this.elapsed += dt;
    const actions = this.flush();
    const p = w.players.find((v) => v.id === TUTORIAL_PLAYER);
    if (!p) return actions;
    const event = w.events.reduce((m, e) => Math.max(m, e.id), 0);
    if (!this.base) this.rebase(w, yaw);
    const base = this.base!;
    if (this.holdUntil !== undefined) {
      if (this.elapsed >= this.holdUntil) {
        this.holdUntil = undefined;
        actions.push(...this.enter(this.index + 1));
      }
      return actions;
    }
    const s = this.step;
    switch (s.id) {
      case "T1":
        this.progress += Math.hypot(p.x - base.x, p.z - base.z);
        base.x = p.x;
        base.z = p.z;
        break;
      case "T2":
        this.progress += (Math.abs(wrap(yaw - base.yaw)) * 180) / Math.PI;
        base.yaw = yaw;
        break;
      case "T3":
      case "T8": {
        const type = s.id === "T3" ? "hit" : "kill";
        this.progress += w.events.filter(
          (e) =>
            e.id > base.event && e.type === type && e.owner === TUTORIAL_PLAYER,
        ).length;
        break;
      }
      case "T4":
        if (p.reload > 0) base.reloadSeen = true;
        else if (base.reloadSeen) this.progress = 1;
        break;
      case "T5":
        if (p.slot !== base.slot) this.progress = 1;
        break;
      case "T6":
        if (p.evade > 0) this.progress = 1;
        break;
      case "T7":
        if ((p.y ?? 0) > 0.05) this.progress = 1;
        break;
      case "T9":
        if ((w.pending[TUTORIAL_PLAYER]?.length ?? 0) > base.pending)
          this.progress = 1;
        break;
      case "T10":
        // 音声の長さで操作前に終了させず、救急箱の実使用（または「次へ」）を待つ。
        if (w.solo && !w.solo.medkit)
          actions.push(...this.enter(this.index + 1));
        return actions;
      default:
        return actions;
    }
    base.event = Math.max(base.event, event);
    if (practice(s.id) && this.progress >= s.goal) {
      actions.push(...this.achieve());
      return actions;
    }
    if (practice(s.id) && !this.nudged && this.elapsed >= NUDGE_AFTER_S) {
      this.nudged = true;
      actions.push({ type: "say", id: "tut-nudge" });
    }
    return actions;
  }

  /** 「この手順を飛ばす」。相づちは流さない。 */
  skip(): TutorialAction[] {
    if (!this.canSkip) return [];
    return this.enter(this.index + 1);
  }
  /** T10 の「次へ」。 */
  next(): TutorialAction[] {
    if (this.step.id !== "T10") return [];
    return this.enter(this.index + 1);
  }
  /** 一時停止から「訓練を終了」。 */
  quit(): TutorialAction[] {
    if (this.done) return [];
    this.done = true;
    return [{ type: "say", id: "tut-skip" }];
  }

  private achieve(): TutorialAction[] {
    const actions: TutorialAction[] = [{ type: "say", id: this.pickAck() }];
    const after = this.step.after;
    if (after) {
      actions.push({ type: "say", id: after });
      this.holdUntil = this.elapsed + lineSeconds(after);
      return actions;
    }
    return [...actions, ...this.enter(this.index + 1)];
  }
  private pickAck() {
    const choices = ACKS.filter((id) => id !== this.lastAck);
    const id = choices[Math.floor(this.random() * choices.length)] ?? ACKS[0];
    this.lastAck = id;
    return id;
  }
  private enter(index: number): TutorialAction[] {
    this.index = Math.min(index, TUTORIAL_STEPS.length - 1);
    this.progress = 0;
    this.elapsed = 0;
    this.nudged = false;
    this.base = undefined;
    this.holdUntil = undefined;
    this.queue = [];
    const s = this.step;
    const actions: TutorialAction[] = [
      { type: "step", id: s.id },
      { type: "arena", arena: s.arena },
    ];
    // 2本目以降は、前の台詞の長さの見込みだけ遅らせて出す（待ちは最新1本のため）。
    let at = 0;
    s.lines.forEach((id, i) => {
      if (i === 0) actions.push({ type: "say", id });
      else this.queue.push({ at, action: { type: "say", id } });
      at += lineSeconds(id) + 0.3;
    });
    if (s.id === "T11") {
      this.done = true;
      actions.push({ type: "complete" });
    }
    return actions;
  }
  private flush() {
    const ready = this.queue.filter((q) => this.elapsed >= q.at);
    this.queue = this.queue.filter((q) => this.elapsed < q.at);
    return ready.map((q) => q.action);
  }
  private rebase(w: World, yaw: number) {
    const p = w.players.find((v) => v.id === TUTORIAL_PLAYER)!;
    this.base = {
      x: p.x,
      z: p.z,
      yaw,
      slot: p.slot,
      event: w.events.reduce((m, e) => Math.max(m, e.id), 0),
      reloadSeen: p.reload > 0 && this.step.id !== "T4",
      pending: w.pending[TUTORIAL_PLAYER]?.length ?? 0,
    };
  }
}
