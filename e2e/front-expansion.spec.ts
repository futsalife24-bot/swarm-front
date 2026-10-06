import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { frontUpgradeCardMarkup } from "../src/client/front-upgrade-ui";
import { createFrontRun, getFrontRunView } from "../src/shared/front-run";
import { type FrontUpgradeId } from "../src/shared/front-upgrades";
const evidence = "docs/evidence/front-expansion-20261006";
test("従来モードで射撃・武器切替・共通エフェクトが動く", async ({ page }) => {
  page.setDefaultTimeout(65000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "ソロで出撃準備", exact: true })
    .click();
  await page.locator("#player-name").fill("描画検証");
  await page.locator("#player-name-form button[type=submit]").click();
  await page.locator("#pt-confirm").click();
  await page.locator("#pt-start").click();
  await page.locator("#pt-enter").click();
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const skip = page.getByRole("button", { name: /スキップ/ }).first();
    if (await skip.isVisible()) await skip.click();
    if (await page.evaluate(() => (window as any).__playtest?.world?.time > 0))
      break;
    await page.waitForTimeout(100);
  }
  await expect(page.locator("#hud")).toBeVisible({ timeout: 65000 });
  const ammo = await page.evaluate(
    () => (window as any).__playtest.world.players[0].ammo[0],
  );
  // PC操作では画面中央の左クリック射撃。タッチ専用ボタンは非表示。
  await page.mouse.move(422, 195);
  await page.mouse.down();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__playtest.world.players[0].ammo[0]),
    )
    .toBeLessThan(ammo);
  await page.screenshot({ path: `${evidence}/campaign-fire.png` });
  await page.mouse.up();
  await page.keyboard.press("KeyQ");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__playtest.world.players[0].slot),
    )
    .toBe(1);
  expect(errors).toEqual([]);
});
for (const width of [640, 844])
  test(`追加強化と融合3枚の収まり：横${width}`, async ({ page }) => {
    mkdirSync(evidence, { recursive: true });
    await page.setViewportSize({ width, height: width === 640 ? 360 : 390 });
    await page.goto("/front.html");
    await page.locator("#solo").click();
    await page.locator("#front-launch").click();
    await expect(page.locator(".rebuild-card")).toHaveCount(3, {
      timeout: 65000,
    });
    const view = getFrontRunView(
      createFrontRun({
        runId: "cards",
        seed: 1,
        fusion: true,
        players: [{ id: "p" }],
      }),
      "p",
    );
    for (const ids of [
      ["boost-coil", "recovery-pack", "burst-cell"],
      ["fusion-aegis", "fusion-collector", "fusion-reactor"],
    ] as FrontUpgradeId[][]) {
      await page.locator(".rebuild-cards").evaluate(
        (el, html) => {
          el.innerHTML = html;
        },
        ids.map((id) => frontUpgradeCardMarkup(view, id, "/")).join(""),
      );
      await page.locator(".rebuild-cards img").evaluateAll(async (images) => {
        await Promise.all(
          images.map((img) => (img as HTMLImageElement).decode()),
        );
      });
      const rects = await page.locator(".rebuild-card").evaluateAll((es) =>
        es.map((el) => ({
          x: el.getBoundingClientRect().x,
          right: el.getBoundingClientRect().right,
          bottom: el.getBoundingClientRect().bottom,
          overflow: el.scrollWidth > el.clientWidth + 1,
        })),
      );
      expect(
        rects.every(
          (r) =>
            r.x >= 0 &&
            r.right <= width &&
            r.bottom <= (width === 640 ? 360 : 390) &&
            !r.overflow,
        ),
      ).toBe(true);
      await page.screenshot({ path: `${evidence}/${ids[0]}-${width}.png` });
    }
  });
test("共通描画の弾道・融合地雷の実GPU表示と上限", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/visual-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body style='margin:0'></body></html>",
    }),
  );
  await page.goto("/visual-fixture");
  const result = await page.evaluate(async () => {
    // 本番と同じ描画クラスを既知の配置で撮影する。ゲームプレイ確認は別テスト。
    const T = await import("/node_modules/.vite/deps/three.js" as string);
    const { CombatEffects } = await import(
      "/src/client/combat-effects.ts" as string
    );
    const { FrontMineVisuals } = await import(
      "/src/client/front-mine-visuals.ts" as string
    );
    const scene = new T.Scene();
    scene.background = new T.Color(0x12212d);
    const camera = new T.PerspectiveCamera(48, 844 / 390, 0.1, 100);
    camera.position.set(8, 10, 15);
    camera.lookAt(0, 0, 0);
    const renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(844, 390);
    document.body.replaceChildren(renderer.domElement);
    const floor = new T.Mesh(
      new T.PlaneGeometry(30, 30),
      new T.MeshBasicMaterial({ color: 0x34434b }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    scene.add(floor);
    const mines = new FrontMineVisuals(scene);
    const players = {
      a: { levels: { "fusion-counter": 0 } },
      b: { levels: { "fusion-counter": 3 } },
    };
    mines.update(
      Array.from({ length: 32 }, (_, id) => ({
        id,
        owner: id % 2 ? "a" : "b",
        x: ((id % 8) - 3.5) * 2.2,
        y: 0,
        z: (Math.floor(id / 8) - 1.5) * 2.3,
        expires: 90,
      })),
      players,
      1,
      "a",
    );
    const fx = new CombatEffects(scene);
    ["rifle", "shotgun", "sniper"].forEach((weapon, id) =>
      fx.event({
        id,
        type: "shot",
        weapon,
        x: -5,
        y: 1 + id * 0.8,
        z: 0,
        tx: 6,
        ty: 1 + id * 0.8,
        tz: 0,
      }),
    );
    ["ricochet", "interceptor"].forEach((frontEffect, id) =>
      fx.event({
        id: id + 4,
        type: "shot",
        weapon: "rifle",
        frontEffect,
        x: -5,
        y: 3.4 + id * 0.8,
        z: 0,
        tx: 6,
        ty: 3.4 + id * 0.8,
        tz: 0,
      }),
    );
    fx.update(0.04, camera);
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      pixels = new Uint8Array(844 * 390 * 4);
    gl.readPixels(0, 0, 844, 390, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let bright = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 170) bright++;
    const frames: number[] = [];
    for (let n = 0; n < 60; n++) {
      const start = performance.now();
      renderer.render(scene, camera);
      frames.push(performance.now() - start);
    }
    return {
      bright,
      mines: mines.body.count,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      medianSubmitMs: frames.sort((a, b) => a - b)[30],
    };
  });
  expect(result.mines).toBe(32);
  expect(result.bright).toBeGreaterThan(300);
  expect(result.drawCalls).toBeLessThan(30);
  expect(errors).toEqual([]);

  await page.screenshot({ path: `${evidence}/combat-effects.png` });
  expect(errors).toEqual([]);
  writeFileSync(
    `${evidence}/render-metrics.json`,
    JSON.stringify(
      {
        ...result,
        note: "既知配置でのGPU描画。実端末の戦闘fps・60分負荷の保証ではない。",
      },
      null,
      2,
    ),
  );
});
