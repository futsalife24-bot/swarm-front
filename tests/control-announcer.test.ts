import { describe, expect, it } from "vitest";
import { ControlAnnouncer } from "../src/client/control-announcer";
import { supplyCutLine, supplyStatusLine } from "../src/client/supply-voice";
import { createWorld, addPlayer, spawn, type World } from "../src/shared/game";

function battle(players = ["me"]) {
  const w = createWorld("run-1", 7, 1);
  for (const id of players) addPlayer(w, id);
  w.phase = "battle";
  w.wave = 1;
  return w;
}
const tick = (a: ControlAnnouncer, w: World, active = true, id = "me") => {
  w.time += 0.1;
  return a.collect(w, id, active);
};

describe("control announcer", () => {
  it("announces wave clear once, except on the final wave", () => {
    const a = new ControlAnnouncer(),
      w = battle();
    tick(a, w);
    w.waveClearAt = w.time;
    expect(tick(a, w)).toEqual(["wave-clear"]);
    expect(tick(a, w)).toEqual([]);
    w.waveClearAt = null;
    tick(a, w);
    w.wave = 99;
    w.waveClearAt = w.time;
    expect(tick(a, w)).toEqual([]);
  });
  it("warns about low vitals with a cooldown", () => {
    const a = new ControlAnnouncer(),
      w = battle(),
      p = w.players[0];
    tick(a, w);
    p.hp = 30;
    expect(tick(a, w)).toEqual(["hp-danger"]);
    p.hp = 100;
    tick(a, w);
    p.hp = 30;
    expect(tick(a, w)).toEqual([]);
  });
  it("reports downs and revives for the squad", () => {
    const a = new ControlAnnouncer(),
      w = battle(["me", "ally"]);
    tick(a, w);
    w.players[1].hp = 0;
    expect(tick(a, w)).toEqual(["ally-down"]);
    w.players[0].hp = 0;
    w.players[0].down = 10;
    expect(tick(a, w)).toEqual(["self-down"]);
    w.players[0].hp = 50;
    expect(tick(a, w)).toEqual(["revived"]);
  });
  it("detects a new large anomaly and armory damage", () => {
    const a = new ControlAnnouncer(),
      w = battle();
    w.defense = {
      armory: { hp: 100 },
      maxHp: 100,
    } as unknown as NonNullable<World["defense"]>;
    tick(a, w);
    spawn(w, "boss", 10, 10, "crown", 0);
    w.defense.armory.hp = 90;
    expect(tick(a, w)).toEqual(["boss-detected", "base-under-attack"]);
  });
  it("never replays events that happened while inactive", () => {
    const a = new ControlAnnouncer(),
      w = battle();
    tick(a, w);
    w.players[0].hp = 20;
    w.waveClearAt = w.time;
    expect(tick(a, w, false)).toEqual([]);
    expect(tick(a, w)).toEqual([]);
    w.training = true;
    w.players[0].hp = 100;
    tick(a, w);
    w.players[0].hp = 20;
    expect(tick(a, w)).toEqual([]);
  });
});

describe("supply voice mapping", () => {
  it("maps the reveal headings and cut-ins to control lines", () => {
    expect(supplyStatusLine("投下要請")).toBe("supply-request");
    expect(supplyStatusLine("受領完了")).toBe("supply-complete");
    expect(supplyStatusLine("開封 3/10")).toBeUndefined();
    expect(supplyCutLine("SSR")).toBe("supply-ssr");
    expect(supplyCutLine("BUDDY")).toBe("supply-buddy");
  });
});
