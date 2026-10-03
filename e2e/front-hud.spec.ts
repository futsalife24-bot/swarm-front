import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

import { frontUpgradeStrip } from "../src/client/front-upgrade-ui";
import { createFrontRun, getFrontRunView } from "../src/shared/front-run";

const evidence =
  process.env.FRONT_E2E_EVIDENCE ?? "docs/evidence/front-hud-20261003";
test.use({ hasTouch: true, isMobile: true });

async function instruments(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      [
        ".vitals",
        ".weapon-hud",
        ".mission-line",
        ".crosshair",
        "#minimap",
        "#move",
        "#fire",
        "#dodge",
        "#swap",
        "#pause",
      ].map((selector) => {
        const element = document.querySelector(selector)!;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return [
          selector,
          {
            box: { x: box.x, y: box.y, w: box.width, h: box.height },
            font: style.fontSize,
            color: style.color,
            background: style.backgroundImage,
            border: style.borderRadius,
            visible: box.width > 0 && box.height > 0,
          },
        ];
      }),
    ),
  );
}

for (const width of [844, 640])
  test(`従来の出撃HUDを継承：横${width}`, async ({ page }) => {
    mkdirSync(evidence, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 844 ? 390 : 360 });
    await page.addLocatorHandler(
      page.getByRole("button", { name: "スキップして戦闘へ", exact: true }),
      async (button) => {
        await button.click();
      },
    );
    await page.goto("/");
    await page
      .getByRole("button", { name: "ソロで出撃準備", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "部隊で表示する名前" })
      .fill("比較隊員");
    await page.getByRole("button", { name: "この名前で登録" }).click();
    await page.getByRole("button", { name: "確定", exact: true }).click();
    await page.locator("#pt-start").click();
    await page.locator("#pt-enter").click({ timeout: 65000 });
    await page.locator("#pt-tutorial-skip").click();
    await expect(page.locator("#pause")).toBeVisible({ timeout: 65000 });
    const legacy = await instruments(page);
    await page.screenshot({ path: `${evidence}/legacy-battle-${width}.png` });
    await page.locator("#pause").click();
    const prior = await page.evaluate(() =>
      localStorage.getItem("swarm-front-save-v1"),
    );
    await page.goto("/front.html");
    await page
      .getByRole("button", { name: "ソロで出撃準備", exact: true })
      .click();
    await page.getByRole("button", { name: "出撃", exact: true }).click();
    await expect(page.locator(".rebuild-card")).toHaveCount(3, {
      timeout: 65000,
    });
    await expect(page.locator("#minimap")).toBeHidden();
    await page.locator(".rebuild-card").first().click();
    await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#minimap")).toBeVisible();
    const front = await instruments(page);
    await page.screenshot({ path: `${evidence}/front-battle-${width}.png` });
    await page.locator("#pause").click();
    for (const selector of Object.keys(legacy)) {
      expect(front[selector].visible, selector).toBe(true);
      for (const key of ["font", "color", "background", "border"] as const)
        expect(front[selector][key], `${selector} ${key}`).toBe(
          legacy[selector][key],
        );
      if (selector === ".weapon-hud") {
        expect(
          { ...front[selector].box, h: legacy[selector].box.h },
          selector,
        ).toEqual(legacy[selector].box);
        expect(
          front[selector].box.h - legacy[selector].box.h,
        ).toBeLessThanOrEqual(30);
      } else if (selector !== ".mission-line")
        expect(front[selector].box, selector).toEqual(legacy[selector].box);
    }
    const vitals = front[".vitals"].box,
      weapon = front[".weapon-hud"].box;
    expect(vitals.x + vitals.w).toBeLessThan(weapon.x);
    expect(weapon.x + weapon.w).toBeLessThanOrEqual(width);
    await expect(page.locator(".hp i")).toBeVisible();
    await expect(page.locator(".ammo-label")).toHaveText("残弾");
    await expect(page.locator(".mission-hud")).toContainText("経験値");
    await expect(page.locator(".weapon-hud")).toContainText("強化 1/7");
    expect(
      await page.evaluate(() => localStorage.getItem("swarm-front-save-v1")),
    ).toBe(prior);
    const sample = getFrontRunView(
      createFrontRun({ runId: "layout", seed: 1, players: [{ id: "p" }] }, 0),
      "p",
    );
    for (const key of [
      "blast-core",
      "fuse",
      "compressed-charge",
      "armor-piercer",
      "ricochet",
      "line-shot",
      "armor",
    ] as const)
      sample.levels[key] = 1;
    sample.picks = 7;
    // 最大7種類のアイコンが狭い従来HUDにも1行で収まる境界確認。
    await page.locator(".front-upgrade-strip").evaluate(
      (el, markup) => {
        el.outerHTML = markup;
      },
      frontUpgradeStrip(sample, "/"),
    );
    const mini = await page.locator(".front-upgrade-mini").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top };
      }),
    );
    expect(mini).toHaveLength(7);
    expect(new Set(mini.map((r) => r.top)).size).toBe(1);
    expect(
      mini.every((r) => r.left >= weapon.x && r.right <= weapon.x + weapon.w),
    ).toBe(true);
    await page.screenshot({ path: `${evidence}/hud-seven-${width}.png` });
    expect(errors).toEqual([]);
    writeFileSync(
      `${evidence}/comparison-${width}.json`,
      JSON.stringify({ legacy, front, errors }, null, 2),
    );
  });
