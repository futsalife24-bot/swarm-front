import { it, expect } from "vitest";
import * as T from "three";
import { createFrontRun } from "../src/shared/front-run";
import {
  frontEffectiveLevels,
  FRONT_PREVIOUS_IDS,
  FRONT_PREVIOUS_BASE_IDS,
  createFrontUpgradeState,
  isValidFrontUpgradeState,
  grantFrontUpgradeRights,
  selectFrontUpgrade,
  openFrontUpgradeOffer,
} from "../src/shared/front-upgrades";
import {
  collectFrontXp,
  frontDodgeEnded,
  frontManualHit,
} from "../src/shared/front-combat";
import { hurtPlayer, spawn, step, neutral } from "../src/shared/game";
import { FrontMineVisuals } from "../src/client/front-mine-visuals";
import { CombatEffects } from "../src/client/combat-effects";
const make = () =>
  createFrontRun({
    runId: "expansion",
    seed: 11,
    fusion: true,
    players: [{ id: "a" }, { id: "b" }],
  });
it("旧25種の途中状態は新候補を混ぜず選択を継続、欠損は拒否", () => {
  let s = createFrontUpgradeState(
    "prior",
    1,
    undefined,
    FRONT_PREVIOUS_BASE_IDS,
  );
  s = {
    ...s,
    levels: Object.fromEntries(
      FRONT_PREVIOUS_IDS.map((id) => [id, 0]),
    ) as typeof s.levels,
  };
  expect(isValidFrontUpgradeState(s)).toBe(true);
  const o = s.offer!;
  const chosen = selectFrontUpgrade(s, {
    runId: s.runId,
    offerId: o.id,
    revision: 0,
    requestId: "first",
    cardId: o.defaultCardId,
  });
  expect(chosen.ok).toBe(true);
  const next = openFrontUpgradeOffer(grantFrontUpgradeRights(chosen.state, 1));
  expect(next.ok).toBe(true);
  expect(
    next.state.offer!.cardIds.every((id) => FRONT_PREVIOUS_IDS.includes(id)),
  ).toBe(true);
  const corrupt = { ...s, levels: { ...s.levels } };
  delete (corrupt.levels as any).armor;
  expect(isValidFrontUpgradeState(corrupt)).toBe(false);
});
it("経験値は共有、回復は実際の最寄り回収者だけ。連続回収・強制回収・倒れた隊員には重複回復しない", () => {
  const r = make(),
    w = r.world,
    [a, b] = w.players,
    c = w.front!.players;
  a.x = b.x = 0;
  a.z = b.z = 0;
  a.hp = b.hp = 100;
  for (const p of [a, b])
    c[p.id].levels = frontEffectiveLevels({
      ...r.upgrades[p.id].levels,
      "fusion-collector": 3,
    });
  const orb = (id: number) => ({ id, x: 0, y: 0, z: 0, value: 2 });
  w.front!.orbs = [orb(1), orb(2)];
  collectFrontXp(w);
  expect(w.front!.xp).toBe(4);
  expect(a.hp).toBe(106);
  expect(b.hp).toBe(100);
  w.time = 1.49;
  w.front!.orbs = [orb(3)];
  collectFrontXp(w);
  expect(a.hp).toBe(106);
  w.time = 1.5;
  w.front!.orbs = [orb(4)];
  collectFrontXp(w);
  expect(a.hp).toBe(112);
  w.time = 5;
  w.front!.orbs = [orb(5)];
  collectFrontXp(w, true);
  expect(a.hp).toBe(112);
  a.hp = 0;
  w.front!.orbs = [orb(6)];
  collectFrontXp(w);
  expect(a.hp).toBe(0);
  expect(b.hp).toBe(106);
  b.hp = 159;
  w.time = 10;
  w.front!.orbs = [orb(7)];
  collectFrontXp(w);
  expect(b.hp).toBe(160);
});
it("回避融合は防御時間・軽減・回転率を継承し、無敵化しない", () => {
  const r = make(),
    w = r.world,
    p = w.players[0],
    c = w.front!.players.a;
  c.levels = frontEffectiveLevels({
    ...r.upgrades.a.levels,
    "fusion-aegis": 3,
  });
  frontDodgeEnded(w, p);
  expect(c.armorUntil).toBe(3.5);
  p.hp = 160;
  hurtPlayer(w, p, 10);
  const protectedDamage = 160 - p.hp;
  expect(protectedDamage).toBeGreaterThan(0);
  w.time = 3.5;
  p.hp = 160;
  hurtPlayer(w, p, 10);
  expect(protectedDamage / (160 - p.hp)).toBeCloseTo(0.4);
  p.evadeCd = 0;
  step(w, { a: { ...neutral(), dodge: true } }, 0.01);
  expect(p.evadeCd).toBeCloseTo(2.2 * 0.52);
});
it("圧縮爆発は2射に1回、散弾の同一射撃で多重発動せず、融合の中心追加ダメージは周辺へ伝播しない", () => {
  const r = make(),
    w = r.world,
    c = w.front!.players.a;
  c.levels = frontEffectiveLevels({
    ...r.upgrades.a.levels,
    "fusion-reactor": 3,
  });
  const e = spawn(w, "crawler", 25, 25, "crown", 0)!,
    other = spawn(w, "crawler", 26, 25, "crown", 0)!;
  e.hp = other.hp = 10000;
  frontManualHit(w, e, 1, "a", 1);
  frontManualHit(w, e, 1, "a", 1);
  expect(w.events.filter((e) => e.type === "burst")).toHaveLength(0);
  frontManualHit(w, e, 1, "a", 2);
  const center = e.hp,
    edge = other.hp;
  expect(w.events.filter((e) => e.type === "burst")).toHaveLength(1);
  expect(10000 - edge).toBeCloseTo(42 * 2.5 * 1.48);
  expect(edge - center).toBeCloseTo(63);
  frontManualHit(w, e, 1, "a", 2);
  expect(other.hp).toBe(edge);
  expect(e.hp).toBe(center - 1);
});
it("4人分の融合地雷32個を欠けず描き、除去後は残像を残さない", () => {
  const r = make(),
    scene = new T.Scene(),
    v = new FrontMineVisuals(scene);
  const mines = Array.from({ length: 32 }, (_, id) => ({
    id,
    owner: "a",
    x: id,
    y: 0,
    z: 0,
    expires: 90,
  }));
  v.update(mines, r.world.front!.players, 1, "a");
  expect(v.body.count).toBe(32);
  expect(v.core.count).toBe(32);
  expect(v.ring.count).toBe(32);
  v.update([], r.world.front!.players, 2, "a");
  expect(v.body.count).toBe(0);
});
it("共通弾は爆発密集時も描画枠を持ち、演出総数は180以内", () => {
  const fx = new CombatEffects(new T.Scene());
  for (let id = 0; id < 12; id++)
    fx.event({ id, type: "burst", x: 0, y: 1, z: 0, radius: 5 });
  expect(fx.items.length).toBeLessThanOrEqual(156);
  fx.event({
    id: 20,
    type: "shot",
    x: 0,
    y: 1,
    z: 0,
    tx: 10,
    ty: 1,
    tz: 0,
    weapon: "rifle",
  });
  expect(fx.items.some((e) => e.kind === "bullet")).toBe(true);
  for (let id = 21; id < 80; id++)
    fx.event({
      id,
      type: "shot",
      x: 0,
      y: 1,
      z: 0,
      tx: 10,
      ty: 1,
      tz: 0,
      weapon: "rifle",
    });
  expect(fx.items.length).toBeLessThanOrEqual(180);
  fx.update(2);
  expect(fx.items.length).toBe(0);
  fx.clear();
});
