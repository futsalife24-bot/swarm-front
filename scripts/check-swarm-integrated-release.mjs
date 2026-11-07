import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = "https://swarm-front.melosalife-24.workers.dev";
const out = "dist-validation/swarm-integrated-release";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
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
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "公開確認"),
    );
    page = await context.newPage();
    page.setDefaultTimeout(90000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addLocatorHandler(page.locator("#pt-intro-skip"), async () =>
      page.locator("#pt-intro-skip").click(),
    );
    const settle = () =>
      page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
    const tap = async (s) => {
      await settle();
      await page.locator(s).click();
    };
    await page.goto(origin + "/front.html?coop=1", { timeout: 120000 });
    await page.locator("#room-id").waitFor();
    await expect(page.locator("#room-list-status")).toContainText("数字3桁");
    await settle();
    await page.screenshot({ path: `${out}/${width}-room-entry.png` });
    await page.goto(origin, { timeout: 120000 });
    await tap(".title-entry-start");
    await tap("#solo");
    await tap('[data-operation="advance"]');
    if (await page.locator("#pt-confirm").count()) await tap("#pt-confirm");
    await tap("#pt-base");
    await tap("#pt-base-buddy");
    await tap('[data-bd="starter-pick"][data-id="tatara"]');
    await tap('[data-bd="starter-confirm"]');
    await tap("#pt-gear");
    await tap("#pt-start");
    await page
      .getByRole("button", { name: "タップで戦場へ" })
      .click({ timeout: 120000 });
    if (await page.locator("#pt-tutorial-skip").count())
      await tap("#pt-tutorial-skip");
    if (await page.locator("#pt-intro-skip").count())
      await tap("#pt-intro-skip");
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    const buddy = page.locator(".bd-skill-btn");
    await expect(buddy).toHaveAttribute("data-state", "ready");
    await page.keyboard.down("KeyG");
    await expect(buddy.locator(".bd-skill-sec")).toHaveText("MAX", {
      timeout: 8000,
    });
    await page.screenshot({ path: `${out}/${width}-tatara-charge.png` });
    await page.keyboard.up("KeyG");
    await expect(buddy).toHaveAttribute("data-state", "cooldown", {
      timeout: 10000,
    });
    await tap("#pause");
    await expect(page.locator("dialog[open] .ap-buddy-name")).toHaveText(
      "タタラ",
    );
    await page.screenshot({ path: `${out}/${width}-tatara-pause.png` });
    results.push({
      width,
      height,
      threeDigitEntry: true,
      tataraChosenInUI: true,
      fullCharge: true,
      releaseToCooldown: true,
      pauseBuddy: true,
    });
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
    page = null;
  }
  expect(errors).toEqual([]);
} catch (e) {
  errors.push(String(e));
  if (page)
    await page.screenshot({ path: out + "/failure.png" }).catch(() => {});
  throw e;
} finally {
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        origin,
        conditions:
          "公開配信JS、HP/時間/敵無変更。隔離新規保存、実UIでタタラ選択。協力は部屋作成せず入口確認。",
        results,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
