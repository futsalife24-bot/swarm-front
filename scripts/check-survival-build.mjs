// 専用武器の導線を新規ブラウザー状態で確認する。実ユーザーの保存には触れない。
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5197";
const production = process.env.PRODUCTION === "1";
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
    const earned = width === 640 && !production;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    if (width === 640)
      await page.addInitScript(() =>
        localStorage.setItem(
          "swarm-front-upgrade-loadout-v1",
          JSON.stringify({
            pool: [
              "blast-core",
              "fuse",
              "compressed-charge",
              "armor-piercer",
              "ricochet",
              "line-shot",
            ],
          }),
        ),
      );
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const settle = () =>
      page.waitForFunction(
        () => !document.querySelector(".split-shutter, .menu-route-shutter"),
      );
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
    await expect(page.locator(".gear-arsenal")).toContainText(
      "獲得済みカード 8種類",
    );
    // 隔離したテスト保存だけに進撃1/3/5の突破記録を用意する。
    // 実際の進撃クリア操作そのものを検証したとは扱わない。
    if (earned) {
      await page.evaluate(async () => {
        const { loadProgress, persistProgress } =
          await import("/src/client/progression-save.ts");
        const save = loadProgress("normal");
        save.missions = {
          "1:normal": [true, false, false],
          "3:normal": [true, false, false],
          "5:normal": [true, false, false],
        };
        persistProgress(save);
      });
      await page.locator("#front-mode").selectOption("defense");
      await page.locator("#front-mode").selectOption("survival");
    }
    const ownedCount = earned ? 18 : 8;
    await expect(page.locator(".gear-arsenal")).toContainText(
      `獲得済みカード ${ownedCount}種類`,
    );
    const loadoutBefore = await page.evaluate(() =>
      localStorage.getItem("swarm-front-upgrade-loadout-v1"),
    );
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
    await tap("#front-base");
    await expect(page.locator("#front-save-pool")).toBeVisible();
    await expect(page.locator("[data-pool]")).toHaveCount(22);
    await tap("#base-back");
    await page.locator("#front-mode").selectOption("survival");
    await expect(page.locator("[data-front-slot]")).toHaveCount(1);
    await tap("#front-base");
    await expect(
      page.getByRole("heading", { name: "生存カード", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#front-save-pool")).toHaveText("除外を保存");
    await expect(page.locator("[data-pool]")).toHaveCount(0);
    await expect(page.locator("#base-grid small")).toHaveCount(0);
    await expect(
      page.locator('#base-grid > .sc-card[data-size="M"]'),
    ).toHaveCount(22);
    await expect(page.locator('#base-grid [data-locked="true"]')).toHaveCount(
      22 - ownedCount,
    );
    await expect(page.locator("#base-count")).toContainText(
      `抽選 ${ownedCount}/${ownedCount}種`,
    );
    await expect(page.locator("#base-fusion-count")).toContainText(
      earned ? "狙える融合 8" : "狙える融合 2",
    );
    await tap('[data-inspect="reload"]');
    await expect(
      page.locator('.base-recipe [data-detail="magazine"]'),
    ).toHaveCount(1);
    const lockedCard = earned ? "burst-cell" : "boost-coil";
    await tap(`[data-inspect="${lockedCard}"]`);
    await expect(page.locator(".base-locked-note")).toContainText(
      earned ? "進撃6突破で解放" : "進撃3突破で解放",
    );
    await screenshot("cards");
    await tap("#base-fusions");
    await expect(
      page.locator('#base-grid > .sc-card[data-size="M"]'),
    ).toHaveCount(9);
    await screenshot("fusion-cards");
    await expect(page.locator(".base-fusion-rule").first()).toContainText(
      "MAX",
    );
    await tap("#base-upgrades");
    await page.getByRole("button", { name: "戻る", exact: true }).click();
    await expect(page.locator(".front-prep")).toBeVisible();
    await tap("#front-launch");
    await expect(page.locator("[data-card]").first()).toBeVisible({
      timeout: 120000,
    });
    expect(await saved()).toEqual(before);
    await expect(page.locator('.sc-card[data-size="L"]')).toHaveCount(3);
    await expect(page.locator(".operation-cue")).toHaveCount(0);
    await expect(page.locator(".front-level-up")).toHaveCount(0);
    await screenshot("choices");
    await tap("[data-card]:first-of-type");
    await expect(page.locator("#controls")).toBeVisible();
    await expect(page.locator("#swap")).toBeHidden();
    await expect(page.locator('.sc-card[data-size="S"]')).toHaveCount(1);
    await expect(page.locator(".weapon-hud")).toContainText(
      "生存戦ライフル · 1/1",
    );
    await page.keyboard.press("q");
    await expect(page.locator(".weapon-hud")).toContainText("1/1");
    await screenshot("battle");
    await tap("#pause");
    await expect(page.locator('.sc-card[data-size="row"]')).toHaveCount(1);
    await screenshot("owned");
    await tap("#front-leave");
    await page.locator("#front-leave-confirm").click();
    await expect(page.locator("#solo")).toBeVisible();
    expect(await saved()).toEqual(before);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("swarm-front-upgrade-loadout-v1"),
      ),
    ).toBe(loadoutBefore);
    reports.push({
      width,
      height,
      production,
      prep: true,
      defenseTwoWeapons: true,
      cardReturn: true,
      battleOneWeapon: true,
      saveUnchanged: true,
      allOwnedNormalCards: ownedCount,
      lockedNormalCards: 22 - ownedCount,
      legacyLoadoutUnchanged: true,
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
