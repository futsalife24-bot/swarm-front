import { ownPrimaryShots, type FireTraceRow } from "../shared/fire-trace";
import type { World } from "../shared/game";

/** 効果音の結果。1=再生、2=同じ更新内の別の射撃音へ統合、3=最短間隔で省略、4=音声が無効。 */
export type ShotSound = 1 | 2 | 3 | 4;

const trim = (rows: unknown[], limit: number) => {
  if (rows.length > limit) rows.splice(0, rows.length - limit);
};
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * 連射の間隔を、押下→入力採取→送信→権威側の適用/射出→受信→表示/音 の順に
 * 1発ずつ対応させる端末内の記録。詳細診断がオンの時だけ生成する。
 * 数値のみ・上限付き・自動送信なし。照準や移動は記録しない。
 */
export class FireCadenceTrace {
  private presses: number[][] = [];
  private inputs: number[][] = [];
  private inputIndex = new Map<number, number[]>();
  private ticks: number[][] = [];
  private states: number[][] = [];
  private shots: number[][] = [];
  private shotIndex = new Map<number, number[]>();
  private frames: number[][] = [];
  private frameCount = 0;
  private lastFrame: number | undefined;
  private run = "";
  private generation = 0;
  private lastShot = 0;

  /** 射撃ボタンの保持が変わった時刻。eventTimeは端末が入力を検出した時刻。 */
  press(held: boolean, eventTime: number, at = performance.now()) {
    this.presses.push([at, held ? 1 : 0, finite(eventTime) ? eventTime : at]);
    trim(this.presses, 1024);
  }
  /** 50ms周期の入力採取。 */
  sampled(seq: number, fire: boolean, at = performance.now()) {
    if (!Number.isSafeInteger(seq) || this.inputIndex.has(seq)) return;
    const row = [seq, at, fire ? 1 : 0, 0];
    this.inputs.push(row);
    this.inputIndex.set(seq, row);
    if (this.inputs.length > 8192)
      this.inputIndex.delete(this.inputs.shift()![0]);
  }
  sent(seq: number, at = performance.now()) {
    const row = this.inputIndex.get(seq);
    if (row && !row[3]) row[3] = at;
  }
  /** サーバーが状態へ載せたtickごとの行。数値の行だけ受け取る。 */
  server(rows: unknown, at: number, stateId: unknown) {
    if (!Array.isArray(rows)) return;
    for (const row of rows.slice(0, 64))
      if (Array.isArray(row) && row.length === 9 && row.every(finite))
        this.tick(row as FireTraceRow, at, finite(stateId) ? stateId : 0);
  }
  /** ソロの1tick。受信時刻は権威側の時計と同じ端末の時計。 */
  local(row: FireTraceRow | undefined) {
    if (row) this.tick(row, row[1], 0);
  }
  private tick(row: FireTraceRow, at: number, stateId: number) {
    this.ticks.push([...row, at, stateId]);
    trim(this.ticks, 12000);
  }
  /** 新しい戦況を受け取った時。本人の主射撃イベントを1発ずつ登録する。 */
  received(w: World, id: string, at: number, stateId: unknown) {
    if (w.run !== this.run) {
      this.run = w.run;
      this.generation++;
      this.lastShot = 0;
      this.shotIndex.clear();
    }
    const ids = ownPrimaryShots(w, id, this.lastShot);
    const state = finite(stateId) ? stateId : 0;
    for (const shot of ids) {
      // [世代, イベントID, 受信, 状態ID, 表示, 音, 音の結果]
      const row = [this.generation, shot, at, state, 0, 0, 0];
      this.shots.push(row);
      this.shotIndex.set(shot, row);
      this.lastShot = Math.max(this.lastShot, shot);
    }
    if (this.shots.length > 8192)
      for (const old of this.shots.splice(0, this.shots.length - 8192))
        if (this.shotIndex.get(old[1]) === old) this.shotIndex.delete(old[1]);
    if (state || ids.length) {
      this.states.push([state, at, ids.length, w.events.length]);
      trim(this.states, 6000);
    }
  }
  /** 描画がイベントを取り込んだ直後。before < id <= after が今回表示された分。 */
  displayed(
    w: World,
    id: string,
    before: number,
    after: number,
    at = performance.now(),
  ) {
    if (after <= before || w.run !== this.run) return;
    for (const shot of ownPrimaryShots(w, id, before)) {
      if (shot > after) break;
      const row = this.shotIndex.get(shot);
      if (row && !row[4]) row[4] = at;
    }
  }
  sounded(shot: number, result: ShotSound, at = performance.now()) {
    const row = this.shotIndex.get(shot);
    if (!row || row[6]) return;
    row[5] = at;
    row[6] = result;
  }
  /** 描画フレームの間隔。25msを超えたものだけ残す。 */
  frame(at: number) {
    this.frameCount++;
    if (this.lastFrame !== undefined && at - this.lastFrame > 25) {
      this.frames.push([at, at - this.lastFrame]);
      trim(this.frames, 2048);
    }
    this.lastFrame = at;
  }
  details() {
    const copy = (rows: number[][]) => rows.map((row) => [...row]);
    return {
      format: 1,
      columns: {
        presses: ["at", "held", "eventTime"],
        inputs: ["seq", "sampledAt", "fire", "sentAt"],
        ticks: [
          "tick",
          "authorityAt",
          "appliedSeq",
          "flags",
          "shots",
          "firstShot",
          "coolMs",
          "ammo",
          "inputAgeMs",
          "receivedAt",
          "stateId",
        ],
        states: ["stateId", "receivedAt", "ownShots", "events"],
        shots: [
          "generation",
          "event",
          "receivedAt",
          "stateId",
          "displayedAt",
          "soundAt",
          "sound",
        ],
        frames: ["at", "gapMs"],
      },
      frameCount: this.frameCount,
      presses: copy(this.presses),
      inputs: copy(this.inputs),
      ticks: copy(this.ticks),
      states: copy(this.states),
      shots: copy(this.shots),
      frames: copy(this.frames),
    };
  }
}
