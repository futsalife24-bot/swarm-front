import { describe, expect, it } from "vitest";
import {
  createFrontRun,
  chooseFrontUpgrade,
  stepFrontRun,
  getFrontRunView,
} from "../src/shared/front-run";
import {
  createFrontRun as oldRun,
  chooseFrontUpgrade as oldChoose,
} from "../src/shared/front-legacy-run";
import {
  createFrontUpgradeState,
  grantFrontUpgradeRights,
  openFrontUpgradeOffer,
  selectFrontUpgrade,
  isValidFrontUpgradeState,
  FRONT_UPGRADE_IDS,
  FRONT_UPGRADE_CATALOG,
  FRONT_MAX_PICKS,
  FRONT_MAX_TYPES,
} from "../src/shared/front-upgrades";
import {
  beginFrontShot,
  collectFrontXp,
  frontDodgeEnded,
  frontManualHit,
  frontReloadStarted,
} from "../src/shared/front-combat";
import {
  hurtEnemy,
  hurtPlayer,
  spawn,
  step,
  neutral,
} from "../src/shared/game";

const make = (count = 1) =>
  createFrontRun({
    runId: "growth",
    seed: 5,
    players: Array.from({ length: count }, (_, i) => ({ id: `p${i}` })),
  });
const choose = (run: ReturnType<typeof make>, id = "p0") => {
  const o = run.upgrades[id].offer!;
  return chooseFrontUpgrade(
    run,
    id,
    {
      runId: run.world.run,
      offerId: o.id,
      revision: o.revision,
      requestId: `${id}:${o.id}`,
      cardId: o.defaultCardId,
    },
    0,
  );
};
describe("段階育成と経験値による選択", () => {
  it("異なる抽選経路でも12回まで選べ、6種類・最大段階を超えず所持能力を育てられる", () => {
    for (let seed = 0; seed < 150; seed++) {
      let state = grantFrontUpgradeRights(
        createFrontUpgradeState(`seed-${seed}`, seed),
        11,
      );
      for (let pick = 0; pick < FRONT_MAX_PICKS; pick++) {
        if (!state.offer) {
          const result = openFrontUpgradeOffer(state);
          expect(result.ok).toBe(true);
          state = result.state;
        }
        expect(isValidFrontUpgradeState(state)).toBe(true);
        const o = state.offer!;
        expect(new Set(o.cardIds).size).toBe(3);
        for (const id of o.cardIds)
          expect(state.levels[id]).toBeLessThan(
            FRONT_UPGRADE_CATALOG[id].maxLevel,
          );
        const result = selectFrontUpgrade(state, {
          runId: state.runId,
          offerId: o.id,
          revision: o.revision,
          requestId: `pick-${pick}`,
          cardId: o.cardIds[(seed + pick) % 3],
        });
        expect(result.ok).toBe(true);
        state = result.state;
        expect(
          FRONT_UPGRADE_IDS.filter((id) => state.levels[id] > 0).length,
        ).toBeLessThanOrEqual(FRONT_MAX_TYPES);
      }
      expect(state.picks).toBe(12);
      expect(isValidFrontUpgradeState(state)).toBe(true);
      expect(openFrontUpgradeOffer(state).ok).toBe(false);
    }
  });
  it("12経験値に達したその更新で選択を開き、選択中は戦闘を止める", () => {
    const r = make();
    choose(r);
    r.world.front!.xp = 12;
    stepFrontRun(r, {}, 0.05, 1);
    expect(r.world.time).toBe(0.05);
    expect(r.phase).toBe("selection");
    stepFrontRun(r, {}, 0.05, 20);
    expect(r.world.time).toBe(0.05);
    expect(r.upgrades.p0.offer?.kind).toBe("additional");
  });
  it("協力の共有経験値で全員に権利を付与し、切断者を含め期限で再開する", () => {
    const r = make(2);
    choose(r);
    choose(r, "p1");
    r.world.front!.xp = 36;
    stepFrontRun(r, {}, 0.05, 1);
    expect(r.selectionDeadline).toBe(16);
    expect(r.upgrades.p0.rightsGranted).toBe(2);
    expect(r.upgrades.p1.rightsGranted).toBe(2);
    r.world.players[1].connected = false;
    stepFrontRun(r, {}, 0.05, 16);
    expect(r.phase).toBe("combat");
    expect(r.upgrades.p0.picks).toBe(3);
    expect(r.upgrades.p1.picks).toBe(3);
    expect(r.resumeUntil).toBe(16.2);
  });
  it("最大育成と補助を揃えても即進化せず、その後の精鋭撃破で確定する", () => {
    const r = make(),
      w = r.world,
      c = w.front!.players.p0;
    const elite = () => {
      const e = spawn(w, "spitter", 12, 12, "crown", 0)!;
      hurtEnemy(w, e, 100000, "p0");
    };
    elite();
    c.levels.fuse = 3;
    c.levels["blast-radius"] = 1;
    expect(c.evolved).toEqual([]);
    const regular = spawn(w, "crawler", 12, 12, "crown", 1)!;
    hurtEnemy(w, regular, 100000, "p0");
    expect(c.evolved).toEqual([]);
    elite();
    expect(c.evolved).toEqual(["explosion"]);
    elite();
    expect(c.evolved).toEqual(["explosion"]);
  });
  it("磁力回収の範囲と緊急装甲の2秒期限が戦闘へ作用する", () => {
    const r = make(),
      w = r.world,
      p = w.players[0],
      c = w.front!.players.p0;
    c.levels.magnet = 1;
    w.front!.orbs = [
      { id: 1, x: p.x + 7, y: 0, z: p.z, value: 2 },
      { id: 2, x: p.x + 9, y: 0, z: p.z, value: 3 },
    ];
    expect(collectFrontXp(w)).toBe(2);
    c.levels["emergency-armor"] = 3;
    frontDodgeEnded(w, p);
    const before = p.hp;
    hurtPlayer(w, p, 10);
    const reduced = before - p.hp;
    w.time = 2;
    const after = p.hp;
    hurtPlayer(w, p, 10);
    const normal = after - p.hp;
    expect(reduced).toBeCloseTo(normal * 0.7);
  });
  it("装填初撃は装填開始では付かず、完了した武器の次の1発だけに作用する", () => {
    const r = make(),
      w = r.world,
      p = w.players[0],
      c = w.front!.players.p0;
    c.levels["opening-shot"] = 2;
    p.ammo[0] = 1;
    frontReloadStarted(w, p);
    expect(beginFrontShot(w, p).damageFactor).toBe(1);
    p.reload = 0.01;
    step(w, { p0: neutral() }, 0.05);
    p.slot = 1;
    expect(beginFrontShot(w, p).damageFactor).toBe(1);
    p.slot = 0;
    expect(beginFrontShot(w, p).damageFactor).toBe(1.5);
    expect(beginFrontShot(w, p).damageFactor).toBe(1);
  });
  it("新規爆域拡張は遠い対象へ爆発を届かせる", () => {
    const r = make(),
      w = r.world,
      p = w.players[0],
      c = w.front!.players.p0;
    c.levels["blast-core"] = 3;
    c.levels["blast-radius"] = 3;
    const first = spawn(w, "crawler", 0, 8, "crown", 0)!;
    const second = spawn(w, "crawler", 7, 8, "crown", 1)!;
    const hp = second.hp;
    frontManualHit(w, first, 10000, p.id, beginFrontShot(w, p).id);
    expect(second.hp).toBeLessThan(hp);
  });
  it("更新前に保存した作戦は旧7回・定時選択の規則で復帰する", () => {
    const old = oldRun({ runId: "old", seed: 1, players: [{ id: "p0" }] });
    const o = old.upgrades.p0.offer!;
    oldChoose(old, "p0", {
      runId: "old",
      offerId: o.id,
      revision: 0,
      requestId: "first",
      cardId: o.defaultCardId,
    });
    const r = JSON.parse(JSON.stringify(old)) as ReturnType<typeof make>;
    r.world.front!.xp = 12;
    stepFrontRun(r, {}, 0.05, 1);
    expect(r.phase).toBe("combat");
    const v = getFrontRunView(r, "p0");
    expect(v.maxPicks).toBe(7);
    expect(v.growthVersion).toBe(1);
    expect(v.levels.magnet).toBe(0);
  });
  it("4人の最大地雷20個と育成後の貫通・装填を維持する", () => {
    const r = make(4),
      w = r.world;
    for (const p of w.players) {
      const c = w.front!.players[p.id];
      c.levels["afterimage-mine"] = 3;
      c.levels["armor-piercer"] = 3;
      c.levels["line-shot"] = 3;
      c.levels["tactical-reload"] = 3;
      for (let i = 0; i < 6; i++) frontDodgeEnded(w, p);
      expect(w.front!.mines.filter((m) => m.owner === p.id)).toHaveLength(5);
      expect(beginFrontShot(w, p).extraPierce).toBe(6);
      expect(frontReloadStarted(w, p)).toBeCloseTo(0.45);
      expect(frontReloadStarted(w, p)).toBe(1);
    }
    expect(w.front!.mines).toHaveLength(20);
  });
});
