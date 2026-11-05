import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin =
  process.env.ORIGIN ?? "https://swarm-front.melosalife-24.workers.dev";
const out = "dist-validation/buddy-production";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-angle=d3d11"],
});
const results = [],
  errors = [];
let page;
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    page = await browser.newPage({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    page.setDefaultTimeout(60000);
    page.on("pageerror", (e) => errors.push(e.message));
    // 初回会敵は敵種ごとに入る。各操作の前に既存のスキップを実操作する。
    await page.addLocatorHandler(page.locator("#pt-intro-skip"), async () => {
      await page.locator("#pt-intro-skip").click();
    });
    await page.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "公開バディ検証"),
    );
    await page.goto(origin + "/", { timeout: 120000 });
    const tap = async (selector) => {
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.locator(selector).click();
    };
    const shot = async (name) => {
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await page.screenshot({ path: `${out}/${width}-${name}.png` });
    };
    await tap(".title-entry-start");
    await tap("#solo");
    await tap('[data-operation="advance"]');
    if (await page.locator("#pt-confirm").count()) await tap("#pt-confirm");
    await tap("#pt-base");
    await tap("#pt-base-buddy");
    await expect(page.locator('[data-bd="starter-pick"]')).toHaveCount(4);
    await shot("starter");
    await tap('[data-bd="starter-pick"][data-id="tatara"]');
    await tap('[data-bd="starter-confirm"]');
    await expect(page.locator("#bd-detail-name")).toContainText("同行中");
    await tap("#bd-tab-recruit");
    await expect(page.locator('[data-bd="draw"]')).toBeDisabled();
    await expect(page.locator(".bd-root")).toContainText("25%");
    await shot("recruit");
    await tap("#pt-gear");
    await tap("#pt-start");
    console.log(`${width}: 出撃準備`);
    await page
      .getByRole("button", { name: "タップで戦場へ" })
      .click({ timeout: 120000 });
    if (await page.locator("#pt-tutorial-skip").count())
      await tap("#pt-tutorial-skip");
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    await page.locator("#buddy").click();
    console.log(`${width}: 固有スキル押下`);
    const glyph = await page.locator("#buddy").evaluate((button) => {
      const b = button.getBoundingClientRect(),
        g = button.querySelector(".bd-skill-icon").getBoundingClientRect();
      return { button: b.width, glyphWidth: g.width, glyphHeight: g.height };
    });
    expect(glyph.button).toBeGreaterThanOrEqual(44);
    expect(glyph.glyphWidth / glyph.button).toBeCloseTo(0.56, 1);
    expect(glyph.glyphHeight / glyph.button).toBeCloseTo(0.56, 1);
    await expect(page.locator("#buddy")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await shot("battle");
    await tap("#pause");
    await tap("#pt-retire");
    await tap("#pt-confirm");
    await expect(page.locator("#buddy")).toBeHidden();
    await tap("#pt-result-retry");
    await tap("#pt-base");
    await tap("#pt-base-buddy");
    await expect(page.locator("#bd-detail-name")).toContainText("同行中");
    expect(await page.evaluate(() => !!window.swarmBuddyReview)).toBe(false);
    results.push({
      width,
      height,
      starter: true,
      noFreeDraw: true,
      skillButton: true,
      glyph,
      retireHidden: true,
      selectionKept: true,
      devReviewAbsent: true,
    });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
    page = null;
  }
  expect(errors).toEqual([]);
} catch (error) {
  errors.push(String(error));
  if (page) {
    await page.screenshot({ path: out + "/failure.png" }).catch(() => {});
    console.log((await page.locator("body").innerText()).slice(0, 900));
  }
  throw error;
} finally {
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        origin,
        browser: browser.version(),
        conditions:
          "隔離新規保存。名前だけ入力補助、所持/HP/敵/時間や配信JSの変更なし。通常ソロ操作。",
        results,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
