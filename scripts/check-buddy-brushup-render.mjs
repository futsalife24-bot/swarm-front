// 実Rendererの固定シーン。通信・製品人数上限・実戦FPSの検証とは分ける。
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5196";
const warningOnly = false;
const baseline = process.env.BASELINE === "1";
const out = `dist-validation/buddy-brushup/${baseline ? "original" : "candidate"}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(`${origin}/buddy-render-fixture`, (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<html lang="ja"><body style="margin:0"><canvas id="world"></canvas></body></html>',
  }),
);
if (baseline) {
  for (const [kind, version] of [
    ["tatara", "v3"],
    ["yosuga", "v5"],
    ["tobari", "v7"],
    ["oriha", "v3"],
  ]) {
    await page.route(`**/assets/buddy/${kind}-textured-20261107.glb`, (route) =>
      route.fulfill({
        path: `public/assets/buddy/${kind}-${version}.glb`,
        contentType: "model/gltf-binary",
      }),
    );
  }
}
page.on("console", msg => { if(msg.text().startsWith("brushup:")) console.log(msg.text()); });
const watchdog = setTimeout(() => { console.error("描画QA: 180秒期限"); browser.close(); },180000);
const results = [];
try {
  await page.goto(`${origin}/buddy-render-fixture`);
  await page.evaluate(async () => {
    const [
      { Renderer },
      { BuddyVisuals },
      { createWorld, addPlayer, spawn },
      { STARTERS },
      { prepareBattle },
    ] = await Promise.all([
      import("/src/client/render.ts"),
      import("/src/client/buddy-visuals.ts"),
      import("/src/shared/game.ts"),
      import("/src/shared/defs.ts"),
      import("/src/client/battle-loading.ts"),
    ]);
    console.log("brushup: modules loaded");
    const view = new Renderer(document.querySelector("#world"));
    const world = createWorld("fixed-buddy-render", 4520, 1);
    world.phase = "battle";
    for (let i = 0; i < 4; i++) {
      const p = addPlayer(world, `p${i}`, STARTERS.slice(0, 2));
      Object.assign(p, { x: (i % 2) * 3, z: 34 - Math.floor(i / 2) * 3, y: 0 });
    }
    for (let i = 0; i < 6; i++) {
      const e = spawn(world, "hornet", (i - 2.5) * 2, 17);
      if (e) e.active = true;
    }
    const buddy = new BuddyVisuals(view.scene);
    window.fixture = {
      view,
      world,
      buddy,
      appearance: [],
      step() {
        view.render(
          world,
          "p0",
          1 / 60,
          0,
          0,
          undefined,
          true,
          false,
          false,
          false,
        );
        buddy.update(
          world,
          this.appearance,
          1 / 60,
          view.players,
          this.reviewMotion,
        );
        view.renderer.render(view.scene, view.camera);
      },
    };
    console.log("brushup: prepareBattle start");
    await prepareBattle(view, world, "p0", () => false);
    console.log("brushup: prepareBattle done");
    window.fixture.step();
  });
  if (!warningOnly)
    for (const [width, height] of [
      [844, 390],
      [640, 360],
    ]) {
      await page.setViewportSize({ width, height });
      for (const shadows of [false])
        for (const n of [0, 1, 4]) {
          await page.evaluate(
            ({ n, shadows }) => {
              const f = window.fixture;
              f.buddy.clear();
              f.view.renderer.shadowMap.enabled = shadows;
              f.buddy.shadows = shadows;
              f.appearance = Array.from({ length: n }, (_, i) => ({
                key: `p${i}:fixture`,
                owner: `p${i}`,
                kind: ["tatara", "yosuga", "tobari", "oriha"][i],
              }));
              f.step();
            },
            { n, shadows },
          );
          await expect
            .poll(
              () =>
                page.evaluate(
                  () =>
                    [...window.fixture.buddy.entries.values()].filter(
                      (e) => e.model,
                    ).length,
                ),
              { timeout: 60000 },
            )
            .toBe(n);
          const value = await page.evaluate(() => {
            const f = window.fixture;
            for (let i = 0; i < 5; i++) f.step();
            const samples = [];
            for (let i = 0; i < 20; i++) {
              const began = performance.now();
              f.view.render(
                f.world,
                "p0",
                1 / 60,
                0,
                0,
                undefined,
                true,
                false,
                false,
                false,
              );
              const beforeBuddy = performance.now();
              f.buddy.update(f.world, f.appearance, 1 / 60, f.view.players);
              const beforeRender = performance.now();
              if (f.view.renderer.shadowMap.enabled)
                for (const light of f.view.scene.children)
                  if (light.isDirectionalLight) light.shadow.needsUpdate = true;
              f.view.renderer.render(f.view.scene, f.view.camera);
              samples.push({
                buddyUpdateMs: beforeRender - beforeBuddy,
                renderSubmitMs: performance.now() - beforeRender,
                totalCpuMs: performance.now() - began,
                calls: f.view.renderer.info.render.calls,
                triangles: f.view.renderer.info.render.triangles,
              });
            }
            const gl = f.view.renderer.getContext(),
              ext = gl.getExtension("WEBGL_debug_renderer_info");
            return {
              samples,
              memory: { ...f.view.renderer.info.memory },
              entries: [...f.buddy.entries.values()].map((e) => ({
                owner: e.owner,
                visible: e.root.visible,
                motion: e.motion,
              })),
              gpu: ext
                ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
                : "未取得",
            };
          });
          expect(value.entries).toHaveLength(n);
          expect(value.entries.every((e) => e.visible)).toBe(true);
          results.push({ width, height, shadows, n, ...value });
          await page.screenshot({
            path: `${out}/${width}-${shadows ? "shadow" : "plain"}-${n}.png`,
          });
          console.log(
            `${width} shadow=${shadows} n=${n} calls=${value.samples[0].calls}`,
          );
        }
    }
  if (!warningOnly) {
    // 長いCoilを終端のほどけまで実GLB・実Rendererで通す。能力処理は発火しない。
    await page.evaluate(() => {
      const f = window.fixture;
      f.buddy.clear();
      f.buddy.shadows = false;
      f.view.mapAssets.shadowDirty = true;
      f.reviewMotion = "Coil";
      f.appearance = [{ key: "coil", owner: "p0", kind: "oriha" }];
      f.step();
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            () => !!window.fixture.buddy.entries.get("coil")?.model,
          ),
        { timeout: 60000 },
      )
      .toBe(true);
    for (const frames of [1, 60, 120, 63]) {
      const motion = await page.evaluate((frames) => {
        const f = window.fixture;
        for (let i = 0; i < frames; i++) f.step();
        const e = f.buddy.entries.get("coil");
        return {
          mixerTime: e.mixer.time,
          clip: e.motion,
          clipTime: e.actions.get("Coil").time,
          duration: e.actions.get("Coil").getClip().duration,
        };
      }, frames);
      results.push({ type: "oriha-coil-full-loop", ...motion });
      await page.screenshot({
        path: `${out}/coil-${motion.mixerTime.toFixed(2)}.png`,
      });
    }
  }
  // Real local World.step skill input, rendered with the integrated GLBs.
  const casts = await page.evaluate(async () => {
    const f = window.fixture;
    const { createBuddyBattleState, equipBattleBuddy } = await import('/src/shared/buddy-combat.ts');
    const { step, neutral } = await import('/src/shared/game.ts');
    f.reviewMotion = undefined;
    f.buddy.clear();
    f.world.buddies = createBuddyBattleState(f.world);
    f.appearance = ['tatara','yosuga','tobari','oriha'].map((kind,i) => {
      equipBattleBuddy(f.world.buddies, f.world.players[i], kind);
      return {key:`cast${i}`,owner:`p${i}`,kind};
    });
    f.world.nextSpawn = 1000000;
    f.world.players.forEach(p => {p.hp=80;}); // Yosuga correctly rejects healing at full HP.
    step(f.world,Object.fromEntries(f.world.players.map(p=>[p.id,{...neutral(),buddySkill:true}])),0.05);
    f.step();
    return Object.values(f.world.buddies.entries).map(e=>({kind:e.buddyId,started:e.skillStartedAt,impact:e.skillImpactAt}));
  });
  expect(casts).toHaveLength(4);
  for(const cast of casts) expect(cast.impact).toBeGreaterThan(cast.started);
  await expect.poll(()=>page.evaluate(()=>[...window.fixture.buddy.entries.values()].filter(e=>e.model).length),{timeout:60000}).toBe(4);
  const renderedCasts = await page.evaluate(()=> {
    const f=window.fixture; f.step();
    return [...f.buddy.entries.values()].map(e=>({kind:e.kind,visible:e.root.visible,skillPlaybackAt:e.skillPlaybackAt,motion:e.motion}));
  });
  for(const cast of renderedCasts) { expect(cast.visible).toBe(true); expect(Number.isFinite(cast.skillPlaybackAt)).toBe(true); }
  results.push({type:'four-real-local-skill-inputs',casts,renderedCasts});
  await page.screenshot({path:`${out}/four-local-casts.png`});
  const released = await page.evaluate(() => {
    const f = window.fixture;
    f.buddy.clear();
    f.view.mapAssets.shadowDirty = true;
    f.appearance = [];
    f.step();
    return { ...f.view.renderer.info.memory, entries:f.buddy.entries.size };
  });
  expect(released.entries).toBe(0);
  results.push({ type: "released-memory", memory: released });
  expect(errors).toEqual([]);
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ browser: browser.version(), results, errors }, null, 2),
  );
  clearTimeout(watchdog);
  await browser.close();
}
