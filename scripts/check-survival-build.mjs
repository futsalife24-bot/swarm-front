// 専用武器の導線を新規ブラウザー状態で確認する。実ユーザーの保存には触れない。
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5197";
const out = process.argv[2] ?? "dist-validation/survival-build";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const reports = [];
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const settle = () =>
      page.locator(".split-shutter").waitFor({ state: "detached" });
    const tap = async (selector) => {
      await settle();
      await page.locator(selector).tap();
    };
    const saved = () =>
      page.evaluate(() =>
        Object.fromEntries(
          Object.entries(localStorage).filter(
            ([key]) =>
              key.includes("progression") ||
              key === "swarm-front-shared-progress-v3",
          ),
        ),
      );
    const screenshot = (name) =>
      page.screenshot({ path: `${out}/${width}x${height}-${name}.png` });
    await page.goto(`${origin}/front`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.locator(".title-entry-start").waitFor();
    await tap(".title-entry-start");
    await page.locator(".title-entry").waitFor({ state: "detached" });
    await tap("#solo");
    await tap('[data-operation="survival"]');
    await expect(page.locator(".front-prep")).toBeVisible();
    await expect(page.locator("[data-front-slot]")).toHaveCount(1);
    await expect(page.locator("[data-front-slot]")).toBeDisabled();
    await expect(page.locator(".gear-arsenal")).toContainText("生存戦ライフル");
    await expect(
      page.locator("[data-row], [data-front-weapon-row]"),
    ).toHaveCount(0);
    const before = await saved();
    expect(Object.keys(before).length).toBeGreaterThan(0);
    await settle();
    const overflow = await page.locator(".front-prep").evaluate((el) => {
      const rects = [...el.querySelectorAll("button,select")]
        .filter((e) => e.offsetParent)
        .map((e) => ({ name: e.textContent, r: e.getBoundingClientRect() }));
      return rects
        .filter(
          ({ r }) =>
            r.left < -1 ||
            r.top < -1 ||
            r.right > innerWidth + 1 ||
            r.bottom > innerHeight + 1,
        )
        .map(({ name }) => name);
    });
    expect(overflow).toEqual([]);
    await screenshot("prep");
    await page.locator("#front-mode").selectOption("defense");
    await expect(page.locator("[data-front-slot]")).toHaveCount(2);
    await expect(page.locator('[data-front-slot="0"]')).toBeEnabled();
    await page.locator("#front-mode").selectOption("survival");
    await expect(page.locator("[data-front-slot]")).toHaveCount(1);
    await tap("#front-base");
    await expect(
      page.getByRole("heading", { name: "生存カード", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "戻る", exact: true }).click();
    await expect(page.locator(".front-prep")).toBeVisible();
    await tap("#front-launch");
    await expect(page.locator("[data-card]").first()).toBeVisible({
      timeout: 120000,
    });
    expect(await saved()).toEqual(before);
    await tap("[data-card]:first-of-type");
    await expect(page.locator("#controls")).toBeVisible();
    await expect(page.locator("#swap")).toBeHidden();
    await expect(page.locator(".weapon-hud")).toContainText(
      "生存戦ライフル · 1/1",
    );
    await page.keyboard.press("q");
    await expect(page.locator(".weapon-hud")).toContainText("1/1");
    await screenshot("battle");
    await tap("#pause");
    await tap("#front-leave");
    await page.locator("#front-leave-confirm").click();
    await expect(page.locator("#solo")).toBeVisible();
    expect(await saved()).toEqual(before);
    expect(errors).toEqual([]);
    reports.push({
      width,
      height,
      prep: true,
      defenseTwoWeapons: true,
      cardReturn: true,
      battleOneWeapon: true,
      saveUnchanged: true,
      pageErrors: errors,
    });
    await context.close();
    console.log(`${width}x${height}: 合格`);
  }
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(reports, null, 2) + "\n",
  );
  await browser.close();
}
