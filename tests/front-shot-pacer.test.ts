import { describe, expect, it } from "vitest";
import { STARTERS, type Weapon } from "../src/shared/defs";
import type { Event, World } from "../src/shared/game";
import { ShotPacer, withPresentedEvents } from "../src/client/shot-pacer";

const weapon = (kind: Weapon["kind"]): Weapon => ({
  ...STARTERS[0],
  kind,
  id: `pacer-${kind}`,
});
function world(events: Partial<Event>[], kind: Weapon["kind"] = "rifle") {
  return {
    run: "pacer-run",
    events: events.map((e) => ({ type: "shot", x: 0, y: 0, z: 0, ...e })),
    players: [
      { id: "a", slot: 0, weapons: [weapon(kind)] },
      { id: "b", slot: 0, weapons: [weapon(kind)] },
    ],
  } as unknown as World;
}
/** 表示された時刻を1発ずつ集める。フレームは1msごとに回す。 */
function play(
  pacer: ShotPacer,
  arrivals: { at: number; world: World }[],
  until: number,
) {
  const shown = new Map<number, number>();
  let consumed = 0,
    next = 0;
  for (let ms = 0; ms <= until; ms++) {
    while (next < arrivals.length && arrivals[next].at <= ms)
      pacer.ingest(arrivals[next++].world, ms / 1000);
    for (const event of pacer.present(ms / 1000, consumed)) {
      if (event.id <= consumed) continue;
      shown.set(event.id, ms);
      consumed = event.id;
    }
  }
  return shown;
}
const gaps = (times: number[]) => times.slice(1).map((t, i) => t - times[i]);

describe("連射の表示間隔を均す", () => {
  it("100/200msで届くARの射撃を、最初の数発の後は連射間隔どおりに並べる", () => {
    // 協力のAR-9（130ms）が10Hzの状態に載って届く時刻。
    const at = [0, 200, 300, 400, 600, 700, 800, 1000, 1100, 1200, 1300, 1500];
    const shown = play(
      new ShotPacer(),
      at.map((time, i) => ({
        at: time,
        world: world([{ id: i + 1, owner: "a" }]),
      })),
      2000,
    );
    const times = at.map((_, i) => shown.get(i + 1)!);
    expect(times[0]).toBe(0); // 最初の1発は遅らせない。
    expect(times.every((t, i) => t >= at[i])).toBe(true); // 届く前には出さない。
    expect(Math.max(...times.map((t, i) => t - at[i]))).toBeLessThanOrEqual(
      160,
    );
    const settled = gaps(times).slice(2);
    expect(Math.min(...settled)).toBeGreaterThanOrEqual(129);
    expect(Math.max(...settled)).toBeLessThanOrEqual(141);
  });

  it("同じ状態で2発届く速い武器を1発ずつに分け、発数は変えない", () => {
    // SMG-3（70ms）は100msごとに1〜2発が同時に届く。
    const batches = [1, 2, 1, 2, 1, 1, 2, 1, 2, 1];
    let id = 0;
    const arrivals = batches.map((count, i) => ({
      at: i * 100,
      world: world(
        Array.from({ length: count }, () => ({ id: ++id, owner: "a" })),
        "smg",
      ),
    }));
    const shown = play(new ShotPacer(), arrivals, 1500);
    expect(shown.size).toBe(id);
    const times = [...shown.values()];
    expect(Math.min(...gaps(times))).toBeGreaterThanOrEqual(69);
    expect(new Set(times).size).toBe(id); // 同じフレームに2発を重ねない。
  });

  it("順番を保ち、後続の命中は射撃より先に出さない", () => {
    const pacer = new ShotPacer();
    pacer.ingest(world([{ id: 1, owner: "a" }]), 0);
    pacer.ingest(
      world([
        { id: 2, owner: "a" },
        { id: 3, type: "hit", owner: "a" },
      ]),
      0.05,
    );
    expect(pacer.present(0.05, 0).map((e) => e.id)).toEqual([1]);
    expect(pacer.present(0.12, 1).map((e) => e.id)).toEqual([]);
    expect(pacer.present(0.13, 1).map((e) => e.id)).toEqual([2, 3]);
  });

  it("描画前に次の戦況が届いても、未表示のイベントを失わない", () => {
    const pacer = new ShotPacer();
    pacer.ingest(world([{ id: 1, type: "hit", owner: "a" }]), 0);
    pacer.ingest(world([{ id: 2, type: "kill", owner: "a" }]), 0.001);
    expect(pacer.present(0.002, 0).map((e) => e.id)).toEqual([1, 2]);
    // 取り込み済みは返さず、同じイベントを再度届けても増えない。
    pacer.ingest(world([{ id: 2, type: "kill", owner: "a" }]), 0.003);
    expect(pacer.present(0.004, 2)).toEqual([]);
  });

  it("遅い武器・追加効果・敵の射撃・別の射手は遅らせない", () => {
    const pacer = new ShotPacer();
    pacer.ingest(
      world(
        [
          { id: 1, owner: "a" },
          { id: 2, owner: "a" },
        ],
        "shotgun",
      ),
      0,
    );
    expect(pacer.present(0, 0)).toHaveLength(2);
    pacer.reset();
    pacer.ingest(
      world([
        { id: 1, owner: "a" },
        { id: 2, owner: "a", frontEffect: "ricochet" } as Partial<Event>,
        { id: 3, owner: "enemy" },
        { id: 4, owner: "b" },
      ]),
      0,
    );
    expect(pacer.present(0, 0)).toHaveLength(4);
  });

  it("遅延は上限で止まり、射撃が途切れた後は即時に戻る", () => {
    const pacer = new ShotPacer();
    // 止まっていた通信が戻り、6発が一度に届く。
    pacer.ingest(
      world(Array.from({ length: 6 }, (_, i) => ({ id: i + 1, owner: "a" }))),
      1,
    );
    expect(pacer.present(1.16, 0)).toHaveLength(6);
    pacer.ingest(world([{ id: 7, owner: "a" }]), 3);
    expect(pacer.present(3, 6).map((e) => e.id)).toEqual([7]);
  });

  it("別の出撃では持ち越さない", () => {
    const pacer = new ShotPacer();
    pacer.ingest(world([{ id: 5, owner: "a" }]), 0);
    const next = world([{ id: 1, owner: "a" }]);
    next.run = "next-run";
    pacer.ingest(next, 0.01);
    expect(pacer.present(0.01, 0).map((e) => e.id)).toEqual([1]);
  });

  it("描画と音へ見せる間だけ差し替え、戦況のイベントは元へ戻す", () => {
    const w = world([{ id: 1, owner: "a" }]);
    const actual = w.events;
    const seen = withPresentedEvents(w, [], () => w.events.length);
    expect(seen).toBe(0);
    expect(w.events).toBe(actual);
    expect(() =>
      withPresentedEvents(w, [], () => {
        throw Error("render failed");
      }),
    ).toThrow("render failed");
    expect(w.events).toBe(actual);
  });
});
