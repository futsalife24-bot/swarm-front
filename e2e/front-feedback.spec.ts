import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fresh, SAVE_KEY } from "../src/client/save";
import { FRONT_SETTINGS_KEY } from "../src/client/front-settings";
import { LAYOUT_KEY } from "../src/client/layout";
import { localCreationKey } from "../tests/credentials";
const evidence = "docs/evidence/front-feedback-20261003";
for (const width of [844, 640])
  test(`改装版${width}：戦闘を保持して設定・配置を保存、旧保存は不変`, async ({
    page,
  }) => {
    mkdirSync(evidence, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: width === 844 ? 390 : 360 });
    const prior = JSON.stringify(fresh());
    await page.addInitScript(
      ({ key, value }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, value);
      },
      { key: SAVE_KEY, value: prior },
    );
    await page.goto("/front.html");
    await page
      .getByRole("button", { name: "ソロで出撃準備", exact: true })
      .click();
    await page.getByRole("button", { name: "ソロ出撃 ↗", exact: true }).click();
    await expect(page.locator(".rebuild-card")).toHaveCount(3, {
      timeout: 65000,
    });
    await page.locator(".rebuild-card").first().click();
    await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
    await page.locator("#pause").click();
    const hud = await page.locator("#hud").innerText();
    await page.getByRole("button", { name: "設定・操作", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "設定・操作", exact: true }),
    ).toBeVisible();
    await page.locator("#front-setting-sensitivity").press("ArrowRight");
    await page.locator("#front-setting-volume").press("Home");
    await page.locator("#front-setting-frameRate").selectOption("30");
    await expect(
      page.getByRole("switch", { name: "ジャイロ" }),
    ).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("#front-setting-gyroSensitivity")).toBeVisible();
    const visible = await page.locator(".front-settings").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        right: r.right,
        scroll: el.scrollHeight,
        client: el.clientHeight,
      };
    });
    expect(visible.top).toBeGreaterThanOrEqual(0);
    expect(visible.bottom).toBeLessThanOrEqual(width === 844 ? 390 : 360);
    expect(visible.right).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `${evidence}/front-settings-${width}.png` });
    await page.locator("#front-setting-layout").click();
    await expect(page.locator("#layout-training")).toBeDisabled();
    await page.locator("#layout-opacity").press("ArrowLeft");
    await page.locator("#layout-save").click();
    await expect(
      page.getByRole("heading", { name: "設定・操作", exact: true }),
    ).toBeVisible();
    expect(await page.locator("#hud").innerText()).toBe(hud);
    const storage = await page.evaluate(
      ({ settings, save, layout }) => ({
        preferences: JSON.parse(localStorage.getItem(settings)!),
        save: localStorage.getItem(save),
        layout: JSON.parse(localStorage.getItem(layout)!),
      }),
      { settings: FRONT_SETTINGS_KEY, save: SAVE_KEY, layout: LAYOUT_KEY },
    );
    expect(storage.save).toBe(prior);
    expect(storage.preferences.sensitivity).toBe(1.1);
    expect(storage.preferences.volume).toBe(0);
    expect(storage.preferences.frameRate).toBe(30);
    expect(storage.layout.buttons.fire.opacity).toBe(0.75);
    await page.locator("#front-settings-back").click();
    await page.locator("#front-resume").click();
    await expect(page.locator("#controls")).toBeVisible({ timeout: 5000 });
    await page.locator("#pause").click();
    await page.locator("#front-leave").click();
    await page.reload();
    await page
      .getByRole("button", { name: "ソロで出撃準備", exact: true })
      .click();
    await page.getByRole("button", { name: "ソロ出撃 ↗", exact: true }).click();
    await expect(page.locator(".rebuild-card")).toHaveCount(3, {
      timeout: 65000,
    });
    await page.locator(".rebuild-card").first().click();
    await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
    await page.locator("#pause").click();
    await page.locator("#front-settings").click();
    await expect(page.locator("#front-setting-sensitivity")).toHaveValue("1.1");
    await expect(page.locator("#front-setting-volume")).toHaveValue("0");
    expect(errors).toEqual([]);
  });
test("旧版：戦闘中の設定と配置編集から戻り、描画上限も保存", async ({
  page,
}) => {
  mkdirSync(evidence, { recursive: true });
  await page.goto("/");
  await page
    .getByRole("button", { name: "ソロで出撃準備", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "部隊で表示する名前" })
    .fill("検証隊員");
  await page.getByRole("button", { name: "この名前で登録" }).click();
  await page.getByRole("button", { name: "確定", exact: true }).click();
  await page.locator("#pt-start").click();
  await page.locator("#pt-enter").click({ timeout: 65000 });
  await page.locator("#pt-tutorial-skip").click();
  await expect(page.locator("#pause")).toBeVisible({ timeout: 65000 });
  await page.locator("#pause").click();
  await page.locator("#pt-pause-layout").click();
  for (const id of [
    "sensitivity",
    "fireSensitivity",
    "gyroSensitivity",
    "volume",
    "bgmVolume",
    "seVolume",
  ])
    await expect(page.locator(`[data-preference="${id}"]`)).toBeAttached();
  await page.locator('[data-preference="frameRate"]').selectOption("30");
  await page.locator('[data-preference="volume"]').press("Home");
  const checkpoint = await page.locator("#hud").innerText();
  await page.screenshot({ path: `${evidence}/legacy-settings-844.png` });
  await page.locator("#pt-layout").click();
  await expect(page.locator(".layout-editor")).toBeVisible();
  await page.locator("#layout-cancel").click();
  await page.locator("#pt-pause-layout").click();
  await expect(page.locator('[data-preference="frameRate"]')).toHaveValue("30");
  await expect(page.locator('[data-preference="volume"]')).toHaveValue("0");
  expect(await page.locator("#hud").innerText()).toBe(checkpoint);
  await page.locator("#pt-resume").click();
  await expect(page.locator(".menu-dialog[open]")).toHaveCount(0);
  await expect(page.locator("#controls")).toBeVisible();
});
test("旧版協力：戦闘中の設定・描画上限・配置からの復帰", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  mkdirSync(evidence, { recursive: true });
  const response = await fetch("http://127.0.0.1:8789/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": localCreationKey() },
    body: JSON.stringify({ name: "旧版設定検証", listed: false }),
  });
  expect(response.status).toBe(200);
  const entry = await response.json();
  await page.goto("/?coop=1");
  await page.locator(".coop-advanced summary").click();
  await page.locator("#endpoint").fill("http://127.0.0.1:8789");
  await page.locator("#room-id").fill(entry.roomId);
  await page.locator("#room-join").click();
  await page
    .getByRole("textbox", { name: "部隊で表示する名前" })
    .fill("協力検証隊員");
  await page.getByRole("button", { name: "この名前で登録" }).click();
  await expect(page.getByRole("button", { name: "全員で出撃" })).toBeEnabled({
    timeout: 65000,
  });
  await page.getByRole("button", { name: "全員で出撃" }).click();
  await expect(page.locator("#pause")).toBeVisible({ timeout: 65000 });
  await page.locator("#pause").click();
  await page.locator("#pause-frame-rate").selectOption("30");
  await page.locator("#pause-volume").press("Home");
  await expect(page.locator("#pause-gyro-sense")).toBeAttached();
  await page.screenshot({ path: `${evidence}/legacy-coop-settings-844.png` });
  await page.locator("#pause-layout").click();
  await expect(page.locator(".layout-editor")).toBeVisible();
  await expect(page.locator("#pause-menu")).toBeHidden();
  const duringLayout = await page.evaluate(
    () => (window as any).__swarm.world.time as number,
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__swarm.world.time as number),
    )
    .toBeGreaterThan(duringLayout);
  await expect(page.locator(".layout-editor")).toBeVisible();
  await page.locator("#layout-cancel").click();
  await expect(page.locator("#pause-frame-rate")).toHaveValue("30");
  await expect(page.locator("#pause-volume")).toHaveValue("0");
  await page.locator("#pause-resume").click();
  await expect(page.locator("#pause-menu")).toBeHidden();
  expect(errors).toEqual([]);
});
