import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin =
  process.env.ORIGIN ?? "https://swarm-front.melosalife-24.workers.dev";
const out = process.env.OUT ?? "dist-validation/advance-pause-production";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-angle=d3d11"],
});
const results = [],
  errors = [];
let page;
try {
  for (const [width, height, buddy] of [
    [568, 320, false],
    [844, 390, true],
  ]) {
    page = await browser.newPage({
      viewport: { width, height },
      serviceWorkers: "block",
      hasTouch: true,
    });
    page.setDefaultTimeout(60000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "公開停止検証"),
    );
    const settle = () =>
      page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
    const tap = async (selector) => {
      await settle();
      await page.locator(selector).click();
    };
    const shot = async (name) => {
      await settle();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${width}-${name}.png` });
    };
    await page.goto(origin, { timeout: 120000 });
    await tap(".title-entry-start");
    await tap("#solo");
    await tap('[data-operation="advance"]');
    if (await page.locator("#pt-confirm").count()) await tap("#pt-confirm");
    if (buddy) {
      await tap("#pt-base");
      await tap("#pt-base-buddy");
      await tap('[data-bd="starter-pick"][data-id="yosuga"]');
      await tap('[data-bd="starter-confirm"]');
      await tap("#pt-gear");
    }
    await tap("#pt-start");
    await page
      .getByRole("button", { name: "タップで戦場へ" })
      .click({ timeout: 120000 });
    if (await page.locator("#pt-tutorial-skip").count())
      await tap("#pt-tutorial-skip");
    if (await page.locator("#pt-intro-skip").count())
      await tap("#pt-intro-skip");
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    await tap("#pause");
    await settle();
    expect(
      await page.evaluate(() =>
        document
          .querySelector("dialog[open] .ap-buddy")
          ?.getAttribute("data-status"),
      ),
    ).toBe(buddy ? "present" : "none");
    if (buddy)
      await expect(page.locator("dialog[open] .ap-buddy-name")).toHaveText(
        "ヨスガ",
      );
    await shot("pause");
    const hud = await page.locator("#hud").innerText();
    await page.waitForTimeout(700);
    expect(await page.locator("#hud").innerText()).toBe(hud);
    await tap("#pt-retire");
    await tap("#pt-cancel");
    await tap("#pt-pause-layout");
    await tap("#pt-resume");
    await tap("#pause");
    await tap("#pt-resume");
    console.log(`${width}: 停止・設定復帰・取消成功、自然ダウン待ち`);
    const deadline = Date.now() + 180000;
    while (
      Date.now() < deadline &&
      !(await page.locator("#pt-defeat").count())
    ) {
      if (await page.locator("#pt-intro-skip").count())
        await tap("#pt-intro-skip");
      await page.waitForTimeout(1000);
    }
    await expect(page.locator("#pt-defeat")).toBeVisible();
    await shot("down");
    await tap("#pt-defeat");
    await page.waitForFunction(() => document.body.dataset.screen === "result");
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    await shot("result");
    results.push({
      width,
      height,
      buddy,
      pauseResume: true,
      settingsReturn: true,
      retireCancel: true,
      naturalDownToResult: true,
    });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
    page = null;
  }
  expect(errors).toEqual([]);
} catch (e) {
  errors.push(String(e));
  if (page)
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw e;
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      {
        origin,
        conditions:
          "公開配信JSを無変更で使用。隔離新規保存、名前だけ入力補助。所持は実UI選択、HP/時間/敵の変更なし。自然ダウン。",
        results,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
