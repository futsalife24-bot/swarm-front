// 実step/Rendererの固定戦場。CPU計測でありGPU時間・実スマホFPSではない。
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5196";
const out = "dist-validation/buddy-combat-load";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
const results = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.route("**/buddy-load-fixture", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<html><body style="margin:0"><canvas id="world"></canvas></body></html>',
    }),
  );
  await page.goto(origin + "/buddy-load-fixture");
  await page.evaluate(async () => {
    const [
      { Renderer },
      { createWorld, addPlayer, spawn, step, retireEvents },
      { STARTERS },
      { prepareBattle },
      combat,
    ] = await Promise.all([
      import("/src/client/render.ts"),
      import("/src/shared/game.ts"),
      import("/src/shared/defs.ts"),
      import("/src/client/battle-loading.ts"),
      import("/src/shared/buddy-combat.ts"),
    ]);
    const view = new Renderer(document.querySelector("#world")),
      world = createWorld("buddy-combat-load", 4520, 1);
    for (let i = 0; i < 4; i++) {
      const p = addPlayer(world, `p${i}`, STARTERS.slice(0, 2));
      Object.assign(p, {
        x: (i % 2) * 3,
        z: 34 - Math.floor(i / 2) * 3,
        y: 0,
        safe: 999,
      });
    }
    for (let i = 0; i < 6; i++) {
      const e = spawn(world, "hornet", (i - 2.5) * 2, 25);
      if (e) Object.assign(e, { active: true, hp: 100000, maxHp: 100000 });
    }
    await prepareBattle(view, world, "p0", () => false);
    world.phase = "battle";
    window.fixture = {
      view,
      world,
      base: structuredClone(world),
      combat,
      tick(fire = false) {
        const world = this.world;
        for (const e of world.enemies) {
          e.hp = e.maxHp = 100000;
        }
        for (const p of world.players) p.safe = 999;
        step(
          world,
          Object.fromEntries(
            world.players.map((p) => [
              p.id,
              {
                mx: 0,
                mz: 0,
                yaw: 0,
                pitch: 0,
                fire: false,
                evade: false,
                reload: false,
                swap: false,
                revive: false,
                jump: false,
                buddySkill: fire,
              },
            ]),
          ),
        );
        view.render(
          world,
          "p0",
          0.05,
          0,
          0,
          undefined,
          true,
          false,
          false,
          true,
        );
        retireEvents(world, view.consumed(world.run));
      },
    };
  });
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    await page.setViewportSize({ width, height });
    for (const kinds of [
      [],
      ["tatara"],
      ["tatara", "yosuga", "tobari", "oriha"],
      ["tatara", "tatara", "tatara", "tatara"],
    ]) {
      await page.evaluate((kinds) => {
        const f = window.fixture;
        f.view.resize();
        f.world = structuredClone(f.base);
        f.world.run = crypto.randomUUID();
        f.world.buddies = f.combat.createBuddyBattleState(f.world);
        kinds.forEach((kind, i) =>
          f.combat.equipBattleBuddy(f.world.buddies, f.world.players[i], kind),
        );
        f.tick();
      }, kinds);
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                [
                  ...(window.fixture.view.buddies?.entries.values() ?? []),
                ].filter((e) => e.model).length,
            ),
          { timeout: 60000 },
        )
        .toBe(kinds.length);
      const result = await page.evaluate(() => {
        const f = window.fixture;
        for (let i = 0; i < 8; i++) f.tick();
        f.world.players.forEach((p) => (p.hp = 80));
        const samples = [];
        for (let i = 0; i < 20; i++) {
          const began = performance.now();
          f.tick(i === 0);
          samples.push({
            cpuStepAndRenderMs: performance.now() - began,
            calls: f.view.renderer.info.render.calls,
            triangles: f.view.renderer.info.render.triangles,
            effects: f.view.combat.items.length,
          });
        }
        const gl = f.view.renderer.getContext(),
          ext = gl.getExtension("WEBGL_debug_renderer_info");
        return {
          samples,
          entries: [...(f.view.buddies?.entries.values() ?? [])].map((e) => ({
            kind: e.kind,
            owner: e.owner,
            visible: e.root.visible,
            motion: e.motion,
          })),
          memory: { ...f.view.renderer.info.memory },
          gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "未取得",
          skills: Object.values(f.world.buddies.entries).map((b) => ({
            id: b.buddyId,
            lastSkillAt: b.lastSkillAt,
          })),
        };
      });
      expect(result.entries).toHaveLength(kinds.length);
      expect(result.entries.every((e) => e.visible)).toBe(true);
      expect(result.skills.every((s) => s.lastSkillAt >= 0)).toBe(true);
      results.push({ width, height, kinds, ...result });
      await page.screenshot({
        path: `${out}/${width}-${kinds.length}-${kinds.at(-1) ?? "none"}.png`,
      });
      console.log(
        `${width}: ${kinds.join(",") || "なし"} calls=${result.samples[0].calls}`,
      );
    }
  }
  const cleared = await page.evaluate(() => {
    const f = window.fixture;
    f.world = null;
    f.view.render(null, "p0", 0.05, 0, 0);
    return {
      entries: f.view.buddies.entries.size,
      effects: f.view.combat.items.length,
    };
  });
  expect(cleared.entries).toBe(0);
  results.push({ cleared });
  expect(errors).toEqual([]);
} catch (error) {
  errors.push(String(error));
  throw error;
} finally {
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify({ browser: browser.version(), results, errors }, null, 2),
  );
  await browser.close();
}
