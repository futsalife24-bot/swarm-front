import { describe, expect, it } from "vitest";
import { STARTERS } from "../src/shared/defs";
import {
  addPlayer,
  createWorld,
  neutral,
  start,
  step,
  type World,
} from "../src/shared/game";
import { FIRE_FLAG, fireTraceRow } from "../src/shared/fire-trace";
import { FireCadenceTrace } from "../src/client/fire-cadence-trace";
import { RoomNetworkTrace } from "../server/room-network-trace";
import { summarizeTrace } from "../scripts/summarize-fire-cadence.mjs";

function battle(kind: "rifle" | "smg") {
  const w = createWorld("fire-trace", 4520);
  addPlayer(w, "a", [{ ...STARTERS[0], kind, id: "fire-trace-weapon" }]);
  start(w);
  w.nextSpawn = 1e9;
  w.enemies = [];
  return w;
}
/** 押しっぱなしで権威側の50ms刻みを進め、1tickずつ診断行を作る。 */
function hold(w: World, ticks: number) {
  const rows = [];
  for (let tick = 1; tick <= ticks; tick++) {
    const input = { ...neutral(), fire: true, seq: tick };
    const floor = w.eventSerial;
    step(w, { a: input });
    rows.push(
      fireTraceRow(w, "a", floor, tick, tick * 50, input, 20, false, false)!,
    );
  }
  return rows;
}

describe("連射診断", () => {
  it("AR-9（130ms）は権威側で100msと150msが交互に並び、発数は公称どおり", () => {
    const rows = hold(battle("rifle"), 60);
    const fired = rows.filter((row) => row[4] > 0);
    const gaps = fired.slice(1).map((row, i) => row[0] - fired[i][0]);
    expect(new Set(gaps)).toEqual(new Set([2, 3]));
    // 3秒で 3/0.13 = 23.08発。繰り越しにより平均の発射数は落ちない。
    expect(fired.length).toBe(24);
    expect(rows.every((row) => row[3] === FIRE_FLAG.held)).toBe(true);
    expect(rows.every((row) => row[6] > -50 && row[6] <= 130)).toBe(true);
  });

  it("SMG-3（70ms）は権威側で50msと100msが混ざり、発数は公称どおり", () => {
    const rows = hold(battle("smg"), 40);
    const fired = rows.filter((row) => row[4] > 0);
    expect(Math.max(...rows.map((row) => row[4]))).toBe(1);
    const gaps = fired.slice(1).map((row, i) => row[0] - fired[i][0]);
    expect(new Set(gaps)).toEqual(new Set([1, 2]));
    expect(fired.length).toBe(29); // 2秒で 2/0.07 = 28.6発
  });

  it("失効・未入力・装填を区別して残す", () => {
    const w = battle("rifle");
    const floor = w.eventSerial;
    step(w, { a: neutral() });
    expect(
      fireTraceRow(w, "a", floor, 1, 50, neutral(), 260, true, false)![3],
    ).toBe(FIRE_FLAG.expired);
    expect(
      fireTraceRow(w, "a", floor, 1, 50, undefined, -1, false, true)![3],
    ).toBe(FIRE_FLAG.missing | FIRE_FLAG.paused);
    w.players[0].reload = 1;
    const row = fireTraceRow(w, "a", floor, 1, 50, neutral(), 0, false, false)!;
    expect(row[3] & FIRE_FLAG.reloading).toBe(FIRE_FLAG.reloading);
    expect(row[8]).toBe(0);
    expect(
      fireTraceRow(w, "missing", 0, 1, 0, undefined, 0, false, false),
    ).toBeUndefined();
  });

  it("サーバーは届いた分だけ行を消し、上限を超えた古い行を捨てる", () => {
    const trace = new RoomNetworkTrace();
    expect(trace.snapshot(1, 0, 0, 1000)).not.toHaveProperty("fire");
    for (let tick = 1; tick <= 60; tick++)
      trace.fireRow([tick, tick * 50, tick, 1, 0, 0, 0, 30, 10]);
    trace.fireRow(undefined);
    const first = trace.snapshot(60, 0, 0, 4000).fire!;
    expect(first).toHaveLength(48);
    expect(first[0][0]).toBe(13);
    trace.fireRow([61, 3050, 61, 1, 1, 9, 80, 29, 10]);
    trace.sentFire(first.at(-1)![0]);
    expect(trace.snapshot(61, 0, 0, 4100).fire).toEqual([
      [61, 3050, 61, 1, 1, 9, 80, 29, 10],
    ]);
    trace.sentFire(61);
    expect(trace.snapshot(62, 0, 0, 4200)).not.toHaveProperty("fire");
  });

  it("押下から表示・音までを1発ずつ対応づけ、段ごとの間隔を集計できる", () => {
    const w = battle("rifle");
    const trace = new FireCadenceTrace();
    trace.press(true, 0, 0);
    for (let tick = 1; tick <= 30; tick++) {
      const input = { ...neutral(), fire: true, seq: tick };
      const floor = w.eventSerial;
      step(w, { a: input });
      const row = fireTraceRow(
        w,
        "a",
        floor,
        tick,
        tick * 50,
        input,
        20,
        false,
        false,
      )!;
      trace.sampled(row[2], true, row[1] - 30);
      trace.sent(row[2], row[1] - 29);
      // 10Hzの配信：偶数tickで直前2tick分が届き、次のフレームで表示される。
      if (row[0] % 2) {
        trace.server([row], row[1] + 60, row[0] + 1);
        continue;
      }
      trace.server([row], row[1] + 10, row[0]);
      trace.received(w, "a", row[1] + 10, row[0]);
      trace.displayed(w, "a", 0, w.eventSerial, row[1] + 18);
      for (const e of w.events)
        if (e.type === "shot") trace.sounded(e.id, 1, row[1] + 18);
      w.events = [];
    }
    trace.press(false, 1500, 1500);
    trace.frame(0);
    trace.frame(40);
    const details = trace.details();
    expect(details.shots.length).toBe(12);
    expect(details.shots.every((row) => row[4] > row[2] && row[6] === 1)).toBe(
      true,
    );
    expect(details.frames).toEqual([[40, 40]]);
    expect(JSON.stringify(details)).not.toMatch(/yaw|pitch|token|name/);
    const summary = summarizeTrace(details, 130);
    expect(summary.shots).toBe(12);
    expect(summary.unmatchedAuthorityShots).toBe(0);
    // 130msは50ms刻みで2tickと3tickに分かれる。11間隔で1.3秒分。
    expect(Object.keys(summary.authorityTickGaps).sort()).toEqual(["2", "3"]);
    expect(
      2 * summary.authorityTickGaps[2] + 3 * summary.authorityTickGaps[3],
    ).toBe(28);
    // 権威側は100/150ms、端末へ届く段では100/200msへ広がる。
    expect(summary.interval.authority.max).toBe(150);
    expect(summary.interval.received.max).toBe(200);
    expect(summary.interval.displayed.max).toBe(200);
    expect(summary.notDisplayed).toBe(0);
    expect(summary.sounds.played).toBe(12);
    expect(summary.input.notHeldTicks).toBe(0);
  });

  it("数値以外の行や別の出撃のイベントを混ぜない", () => {
    const trace = new FireCadenceTrace();
    trace.server(
      [["x"], [1, 2, 3], null, [1, 50, 1, 1, 0, 0, 0, 30, 10]],
      60,
      5,
    );
    trace.server({ not: "rows" }, 60, 5);
    expect(trace.details().ticks).toEqual([
      [1, 50, 1, 1, 0, 0, 0, 30, 10, 60, 5],
    ]);
    const w = battle("rifle");
    hold(w, 2);
    trace.received(w, "a", 100, 1);
    const next = battle("rifle");
    next.run = "another-run";
    hold(next, 2);
    trace.received(next, "a", 200, 2);
    const generations = trace.details().shots.map((row) => row[0]);
    expect(generations).toEqual([1, 2]);
  });
});
