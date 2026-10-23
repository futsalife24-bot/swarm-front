import { expect, type Page } from "@playwright/test";
import { test } from "./orientation-mock.fixture";
import { mkdirSync, writeFileSync } from "node:fs";

const evidence = "dist-validation/orientation-mock";
const snapshot = (page: Page) =>
  page.evaluate(() => (window as any).__orientationMock);

test("weapon rows retain the compact shared baseline in both orientations", async ({
  page,
}) => {
  await page.goto("/");
  const results: unknown[] = [];
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [640, 360],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    for (const id of ["gear", "gear-organize"]) {
      await go(page, id);
      await page.waitForFunction(() =>
        document
          .getAnimations()
          .every(
            (a) =>
              a.playState !== "running" ||
              a.effect?.getTiming().iterations === Infinity,
          ),
      );
      const state = await page.locator(".gear-weapon-list").evaluate((list) => {
        const lr = list.getBoundingClientRect();
        return {
          heading: list
            .querySelector(".pt-weapon-head")!
            .getBoundingClientRect().height,
          overflow: document.documentElement.scrollWidth > innerWidth,
          scroll: list.scrollWidth - list.clientWidth,
          rows: [...list.querySelectorAll("[data-row]")].map((row) => {
            const r = row.getBoundingClientRect(),
              lock = row.querySelector("[data-lock]")!.getBoundingClientRect(),
              name = row.querySelector("b")!;
            return {
              height: r.height,
              lockWidth: lock.width,
              lockRight: lock.right,
              listRight: lr.right,
              nameFits: name.scrollWidth <= name.clientWidth + 1,
            };
          }),
        };
      });
      expect(state.heading).toBeLessThanOrEqual(20);
      expect(state.overflow).toBe(false);
      expect(state.rows.length).toBeGreaterThan(0);
      for (const row of state.rows) {
        expect(row.height).toBeCloseTo(30, 2);
        expect(row.lockWidth).toBe(28);
        expect(row.lockRight).toBeLessThanOrEqual(row.listRight + 1);
        expect(row.nameFits).toBe(true);
      }
      if (width >= 844) expect(state.scroll).toBeLessThanOrEqual(1);
      const before = await page.locator("[data-lock]").first().boundingBox();
      await page.locator(".gear-weapon-list").evaluate((e) => {
        e.scrollLeft = 500;
      });
      const after = await page.locator("[data-lock]").first().boundingBox();
      expect(after!.x).toBe(before!.x);
      const offsets = await page
        .locator(".pt-stat-inner")
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().x));
      expect(offsets.every((x) => Math.abs(x - offsets[0]) <= 1)).toBe(true);
      results.push({ width, height, id, ...state });
    }
  }
  writeFileSync(
    `${evidence}/gear-baseline.json`,
    JSON.stringify(results, null, 2),
  );
});
async function go(page: Page, id: string) {
  for (let i = 0; i < 3 && (await page.locator("dialog[open]").count()); i++)
    await page.keyboard.press("Escape");
  if (await page.locator("#pause").isVisible())
    await page.locator("#pause").click();
  if (await page.locator("#layout-back").isVisible()) {
    await page.locator("#layout-back").click();
    if (await page.locator("[data-discard]").isVisible())
      await page.locator("[data-discard]").click();
  }
  await page.locator("#mock-catalog").click();
  await page.locator(`[data-scene="${id}"]`).click();
}
test("all screens rotate without production storage or network", async ({
  page,
}) => {
  mkdirSync(evidence, { recursive: true });
  await page.goto("/");
  await expect(page.locator("#mock-catalog")).toBeVisible();
  const catalog = (await snapshot(page)).catalog.filter(
    (s: any) => !s.id.startsWith("battle-"),
  );
  const visited: string[] = [];
  for (const item of catalog) {
    await go(page, item.id);
    await expect(page.locator("#ui")).not.toBeEmpty();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect
      .poll(async () => (await snapshot(page)).battle.viewport.mode)
      .toBe("landscape");
    await page.setViewportSize({ width: 320, height: 568 });
    await expect
      .poll(async () => (await snapshot(page)).battle.viewport.mode)
      .toBe("portrait");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      item.id,
    ).toBe(true);
    if (
      [
        "home",
        "gear",
        "upgrade",
        "settings",
        "layout",
        "lobby",
        "bestiary",
      ].includes(item.id)
    )
      await page.screenshot({ path: `${evidence}/${item.id}-320.png` });
    visited.push(item.id);
  }
  await go(page, "home");
  writeFileSync(
    `${evidence}/screens.json`,
    JSON.stringify({ visited }, null, 2),
  );
});

test("real movement, aiming, fire, rotation cancellation and pause", async ({
  page,
  context,
}) => {
  await page.goto("/#battle-training");
  await expect(page.locator("#fire")).toBeVisible();
  await expect
    .poll(async () => (await snapshot(page)).battle.loaded, { timeout: 30000 })
    .toBe(true);
  const before = (await snapshot(page)).battle;
  const cdp = await context.newCDPSession(page);
  const move = await page.locator("#move").boundingBox(),
    fire = await page.locator("#fire").boundingBox();
  expect(move).not.toBeNull();
  expect(fire).not.toBeNull();
  const m = {
      id: 1,
      x: move!.x + move!.width / 2,
      y: move!.y + move!.height / 2,
    },
    f = { id: 2, x: fire!.x + fire!.width / 2, y: fire!.y + fire!.height / 2 },
    l = { id: 3, x: 250, y: 280 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [f],
  });
  await expect
    .poll(async () => (await snapshot(page)).battle.enemyHp, { timeout: 10000 })
    .toBeLessThan(before.enemyHp);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [m, f, l],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...m, y: m.y - 35 }, f, { ...l, x: l.x + 30 }],
  });
  await expect
    .poll(async () => (await snapshot(page)).battle.player.z)
    .toBeLessThan(before.player.z - 0.3);
  await expect
    .poll(async () => (await snapshot(page)).battle.input.yaw)
    .toBeGreaterThan(0.01);
  const held = (await snapshot(page)).battle;
  expect(held.touches).toBe(3);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await snapshot(page)).battle.touches).toBe(0);
  await expect.poll(async () => (await snapshot(page)).battle.fov).toBe(65);
  const rotated = (await snapshot(page)).battle;
  expect(rotated.run).toBe(before.run);
  expect(rotated.input.fire).toBe(false);
  expect(rotated.queued).toBe(0);
  expect(rotated.active).toBe(true);
  expect(rotated.fov).toBe(65);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.locator("#scope").click();
  await expect
    .poll(async () => (await snapshot(page)).battle.scoped)
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => (await snapshot(page)).battle.scoped)
    .toBe(false);
  await page.locator("#pause").click();
  const pause = (await snapshot(page)).battle;
  await page.setViewportSize({ width: 844, height: 390 });
  expect((await snapshot(page)).battle.paused).toBe(true);
  expect((await snapshot(page)).battle.run).toBe(before.run);
  await page.screenshot({ path: `${evidence}/paused-844.png` });
  writeFileSync(
    `${evidence}/input.json`,
    JSON.stringify({ before, held, rotated, pause }, null, 2),
  );
});

test("battle presets and control hit areas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  for (const scene of ["skirmish", "boss", "dense"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, `battle-${scene}`);
    await expect(page.locator("#fire")).toBeVisible();
    await expect
      .poll(async () => (await snapshot(page)).battle.loaded, {
        timeout: 30000,
      })
      .toBe(true);
    if (scene === "boss")
      await expect
        .poll(async () => (await snapshot(page)).battle.enemyModels, {
          timeout: 30000,
        })
        .toContain("harrow");
    await page.screenshot({ path: `${evidence}/${scene}-390.png` });
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [640, 280],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await expect
        .poll(async () => (await snapshot(page)).battle.viewport.width)
        .toBe(width);
      const bounds = await page
        .locator("#controls > :not(#look),#pause")
        .evaluateAll((els) =>
          els
            .filter((e) => !(e as HTMLElement).hidden)
            .map((e) => {
              const r = e.getBoundingClientRect();
              return {
                id: e.id,
                w: r.width,
                h: r.height,
                left: r.left,
                top: r.top,
                right: r.right,
                bottom: r.bottom,
                hit: document
                  .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                  ?.closest("[id]")?.id,
              };
            }),
        );
      const hud = await page.locator(".mock-hud-panel").boundingBox();
      for (const r of bounds) {
        expect(r.w, r.id).toBeGreaterThanOrEqual(44);
        expect(r.h, r.id).toBeGreaterThanOrEqual(44);
        expect(r.left, r.id).toBeGreaterThanOrEqual(0);
        expect(r.top, r.id).toBeGreaterThanOrEqual(0);
        expect(r.right, r.id).toBeLessThanOrEqual(width + 1);
        expect(r.bottom, r.id).toBeLessThanOrEqual(height + 1);
        expect(r.hit, r.id).toBe(r.id);
        expect(
          r.left < hud!.x + hud!.width &&
            r.right > hud!.x &&
            r.top < hud!.y + hud!.height &&
            r.bottom > hud!.y,
          `${scene} ${width} HUD/${r.id}`,
        ).toBe(false);
      }
    }
  }
  expect(errors).toEqual([]);
});

test("layout trial restores battle and stores only the active orientation", async ({
  page,
}) => {
  await page.goto("/#battle-skirmish");
  await expect(page.locator("#fire")).toBeVisible();
  await page.locator("#pause").click();
  const before = (await snapshot(page)).battle;
  await page.locator("[data-menu-layout]").click();
  await page.locator("#layout-opacity").press("Home");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#layout-mode")).toContainText("横");
  await page.locator("#layout-opacity").press("End");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#layout-mode")).toContainText("縦");
  await expect(page.locator("#layout-opacity")).toHaveValue("0.4");
  await page.locator("#layout-save").click();
  const saved = await page.evaluate(() => ({
    p: localStorage.getItem("swarm-front-orientation-mock-v1:layout-portrait"),
    l: localStorage.getItem("swarm-front-orientation-mock-v1:layout-landscape"),
  }));
  expect(saved.p).toContain('"opacity":0.4');
  expect(saved.l).toBeNull();
  await page.locator("#layout-test").click();
  await expect(page.locator("#mock-training-exit")).toBeVisible();
  expect((await snapshot(page)).battle.scene).toBe("training");
  await page.locator("#mock-training-exit").click();
  const after = (await snapshot(page)).battle;
  expect(after.run).toBe(before.run);
  expect(after.time).toBe(before.time);
  expect(after.player).toEqual(before.player);
  expect(after.enemyHp).toBe(before.enemyHp);
  expect(after.scene).toBe("skirmish");
  await page.locator("#layout-back").click();
  await expect(page.locator("[data-discard]")).toBeVisible();
  await page.locator("[data-discard]").click();
  await page.locator("[data-menu-resume]").click();
  expect((await snapshot(page)).battle.run).toBe(before.run);
  writeFileSync(
    `${evidence}/trial.json`,
    JSON.stringify({ before, after, saved }, null, 2),
  );
});

test("keyboard resize keeps profile; 180-degree rotation clears captures; safe areas remain usable", async ({
  page,
  context,
}) => {
  await page.goto("/#name");
  await page.locator("#mock-player-name").fill("回転テスト");
  const cdp = await context.newCDPSession(page);
  // setViewportSize also changes the emulated physical screen orientation.
  // A keyboard changes available height without rotating the device.
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 330,
    deviceScaleFactor: 1,
    mobile: true,
    screenOrientation: { type: "portraitPrimary", angle: 0 },
  });
  await expect
    .poll(async () => (await snapshot(page)).battle.viewport.height)
    .toBe(330);
  expect((await snapshot(page)).battle.viewport.mode).toBe("portrait");
  await expect(page.locator("#mock-player-name")).toHaveValue("回転テスト");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#mock-name-form button").click();
  await go(page, "battle-training");
  await expect(page.locator("#fire")).toBeVisible();
  const f = await page.locator("#fire").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 9, x: f!.x + f!.width / 2, y: f!.y + f!.height / 2 }],
  });
  await expect.poll(async () => (await snapshot(page)).battle.touches).toBe(1);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenOrientation: { type: "portraitSecondary", angle: 180 },
  });
  await expect
    .poll(async () => (await snapshot(page)).battle.viewport.screenAngle)
    .toBe(180);
  await expect.poll(async () => (await snapshot(page)).battle.touches).toBe(0);
  expect((await snapshot(page)).battle.input.fire).toBe(false);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.addStyleTag({
    content:
      ":root{--safe-top:28px;--safe-right:8px;--safe-bottom:24px;--safe-left:16px}",
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect
    .poll(async () => (await snapshot(page)).battle.viewport.width)
    .toBe(320);
  const bounds = await page
    .locator("#controls > :not(#look),#pause")
    .evaluateAll((els) =>
      els
        .filter((e) => !(e as HTMLElement).hidden)
        .map((e) => {
          const r = e.getBoundingClientRect();
          return {
            id: e.id,
            x: r.x,
            y: r.y,
            right: r.right,
            bottom: r.bottom,
            hit: document
              .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
              ?.closest("[id]")?.id,
          };
        }),
    );
  for (const r of bounds) {
    expect(r.x).toBeGreaterThanOrEqual(16);
    expect(r.y).toBeGreaterThanOrEqual(28);
    expect(r.right).toBeLessThanOrEqual(312);
    expect(r.bottom).toBeLessThanOrEqual(544);
    expect(r.hit).toBe(r.id);
  }
  await page.screenshot({ path: `${evidence}/safe-area-320.png` });
});
