import { describe, expect, it } from "vitest";
import {
  addPlayer,
  createWorld,
  fire,
  hurtEnemy,
  neutral,
  spawn,
  type Player,
  type World,
  type Enemy,
} from "../src/shared/game";
import { BASTION, bastionShot, stepBastion } from "../src/shared/bastion";
import { stats } from "../src/shared/defs";
import { CombatAudio } from "../src/client/combat-audio";
import { prepareState } from "../src/shared/state-wire";

function fixture() {
  const w = createWorld("bastion-open", 7, 1);
  w.phase = "battle";
  const ar = addPlayer(w, "ar"),
    sr = addPlayer(w, "sr");
  const e = spawn(w, "bastion", 0, 0)!;
  e.hp = e.maxHp = 1e6;
  e.bastion!.readyAt = 1e9;
  for (const [p, kind] of [
    [ar, "rifle"],
    [sr, "sniper"],
  ] as const) {
    Object.assign(p, { x: 0, y: 0, z: 12 });
    p.weapons = [0, 1].map((slot) => ({
      id: p.id + slot,
      kind,
      rarity: 0,
      power: 1,
      effect: "none",
    })) as Player["weapons"];
    p.ammo = [1000, 1000];
  }
  return { w, e, ar, sr };
}
// 発射・命中・軽減・イベントは本体 fire()。時刻と照準だけを固定する。
function shoot(w: World, e: Enemy, p: Player, time: number) {
  w.time = time;
  p.cool = 0;
  const before = e.hp;
  fire(w, p, {
    ...neutral(),
    fire: true,
    pitch: Math.atan2(BASTION.hover - 1.5, 12),
  });
  expect(e.hp).toBeLessThan(before);
  return before - e.hp;
}
function open(w: World, e: Enemy, p: Player) {
  Object.assign(e.bastion!, {
    armor: 100,
    phase: "warn",
    phaseAt: w.time - BASTION.warn,
    volley: { count: 12, turn: 0, x: 0, y: 1.7, z: 0 },
  });
  stepBastion(w, e, p, 0.05);
  expect(e.bastion!.phase).toBe("open");
}

describe("BASTION 開放と敵共有の連射履歴", () => {
  it("装甲と連射耐性を重ねず、命中表現をJSON配信と既存音で区別する", () => {
    const { w, e, ar } = fixture();
    const audio = new CombatAudio();
    audio.collect(w);
    e.bastion!.armor = 100;
    expect(shoot(w, e, ar, 0)).toBeCloseTo(24, 6);
    expect(shoot(w, e, ar, 0.15)).toBeCloseTo(24 * 0.7, 6);
    let hit = w.events.filter((ev) => ev.type === "hit").at(-1)!;
    expect(hit).toMatchObject({ guard: 1, guardKind: "rapid" });
    expect(
      audio.collect(JSON.parse(JSON.stringify(w))).map((c) => c.type),
    ).toContain("impactHard");
    w.time += 0.05;
    const before = e.hp;
    hurtEnemy(w, e, 100, ar.id); // 爆風は連射耐性ではなく装甲60%軽減
    expect(before - e.hp).toBeCloseTo(40, 6);
    hit = w.events.filter((ev) => ev.type === "hit").at(-1)!;
    expect(hit).toMatchObject({ guard: 3, guardKind: "armor" });
    expect(
      audio.collect(JSON.parse(JSON.stringify(w))).map((c) => c.type),
    ).toContain("impactShell");
    open(w, e, ar);
    expect(shoot(w, e, ar, w.time)).toBeCloseTo(24, 6);
    const packet = JSON.parse(
      prepareState(w, 0, { room: "test" }).packet(ar.id),
    );
    hit = packet.world.events
      .filter((ev: { type: string }) => ev.type === "hit")
      .at(-1);
    expect(hit.guard).toBeUndefined();
    expect(hit.guardKind).toBe("open");
    expect(audio.collect(packet.world).map((c) => c.type)).toContain(
      "impactSoft",
    );
  });
  it("通常時は味方ARの連射で別プレイヤーの狙撃単発も4%まで減衰する", () => {
    const { w, e, ar, sr } = fixture();
    for (let n = 0; n < 10; n++) shoot(w, e, ar, n * 0.15);
    expect(shoot(w, e, sr, 1.5)).toBeCloseTo(
      stats(sr.weapons[0]).damage * 0.04,
      6,
    );
    expect(e.bastion!.streak).toBe(11);
  });
  it("反撃直後から2.2秒だけ誰の連射も全量通り、終了直後は共有履歴に戻る", () => {
    const { w, e, ar, sr } = fixture();
    for (let n = 0; n < 10; n++) shoot(w, e, ar, n * 0.15);
    open(w, e, ar);
    const opened = w.time;
    expect(shoot(w, e, sr, opened)).toBeCloseTo(165, 6);
    for (let n = 1; n <= 14; n++)
      expect(shoot(w, e, ar, opened + n * 0.15)).toBeCloseTo(24, 6);
    expect(e.bastion!.armor).toBe(0);
    w.time = opened + BASTION.open - 0.05;
    stepBastion(w, e, ar, 0.05);
    expect(e.bastion!.phase).toBe("open");
    expect(shoot(w, e, sr, w.time)).toBeCloseTo(165, 6);
    // 同じtick内の相変更でも免除が残らない。履歴も武器・所有者ごとには分けない。
    w.time = opened + BASTION.open;
    expect(shoot(w, e, ar, w.time)).toBeCloseTo(24, 6);
    stepBastion(w, e, ar, 0.05);
    expect(e.bastion!.phase).toBe("guard");
    expect(shoot(w, e, sr, w.time)).toBeCloseTo(165 * 0.04, 6);
    expect(e.bastion!.armor).toBe(BASTION.gain); // 装甲は段階0でも連射耐性は4%
    expect(shoot(w, e, sr, w.time + 0.4)).toBeCloseTo(165, 6);
  });
  it("開放中に撃ち止めた場合、0.35秒超の共有間隔があれば終了後の初弾は全量", () => {
    const { w, e, ar, sr } = fixture();
    open(w, e, ar);
    shoot(w, e, ar, 0.1);
    w.time = BASTION.open;
    stepBastion(w, e, ar, 0.05);
    expect(shoot(w, e, sr, w.time)).toBeCloseTo(165, 6);
  });
  it("別スロットや別武器へ変更しても敵の共有連射履歴はリセットされない", () => {
    const { w, e, ar } = fixture();
    shoot(w, e, ar, 0);
    shoot(w, e, ar, 0.15);
    ar.slot = 1;
    ar.weapons[1].kind = "sniper";
    expect(shoot(w, e, ar, 0.3)).toBeCloseTo(165 * 0.49, 6);
  });
  it("0.35秒ちょうどは継続、超えた場合だけリセットし、別個体には共有しない", () => {
    const { w, e } = fixture();
    expect(bastionShot(w, e, "rifle")).toBe(1);
    w.time = 0.35;
    expect(bastionShot(w, e, "sniper")).toBeCloseTo(0.7);
    w.time += 0.35001;
    expect(bastionShot(w, e, "rifle")).toBe(1);
    const other = spawn(w, "bastion", 6, 0)!;
    expect(bastionShot(w, other, "rifle")).toBe(1);
  });
});
