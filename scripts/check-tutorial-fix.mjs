import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:5198/";
const out = process.argv[3] || "dist-validation/tutorial-fix";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = { base, errors: [], sizes: [] };
try {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => results.errors.push(e.message));
  const openHome = async () => {
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.getByText("TAP START", { exact: true }).click();
    await page.locator("#home-tutorial").waitFor();
    await page.waitForTimeout(600);
  };
  await openHome();
  if (!process.argv.includes("--settings-only")) {
    await page.locator("#home-tutorial").click();
    await page.waitForTimeout(600);
    await page.locator("#tutorial-training").click();
    const frame = page.frameLocator("iframe.training-frame");
    await frame.locator("#training-start").click();
    // 未変更のT1〜T8は既存の10秒待ちスキップを使う。T9/T10は実操作する。
    for (let n = 1; n <= 8; n++) {
      await frame
        .locator("#tutorial-count")
        .filter({ hasText: `${n} / 11` })
        .waitFor();
      await frame.locator("#tutorial-skip").click({ timeout: 25000 });
      console.log(`手順${n}をスキップ`);
    }
    await frame
      .locator("#tutorial-count")
      .filter({ hasText: "9 / 11" })
      .waitFor();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/pickup.png` });
    results.pickupText = await frame.locator("#training-stats").textContent();
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(700);
    await page.keyboard.up("KeyW");
    await frame
      .locator("#tutorial-count")
      .filter({ hasText: "10 / 11" })
      .waitFor({ timeout: 15000 });
    results.healthText = await frame.locator("#training-stats").textContent();
    const med = frame.getByRole("button", {
      name: "救急箱で全快",
      exact: true,
    });
    assert.equal(await med.isEnabled(), true);
    await page.screenshot({ path: `${out}/health.png` });
    // 説明音声の長さが過ぎても、操作するまではT10に残る。
    await page.waitForTimeout(16000);
    assert.match(
      await frame.locator("#tutorial-count").textContent(),
      /10 \/ 11/,
    );
    await med.click();
    await frame
      .locator("#tutorial-count")
      .filter({ hasText: "11 / 11" })
      .waitFor();
    await page.screenshot({ path: `${out}/complete.png` });
    results.medkitCompleted = true;
    await frame.locator("#tutorial-finish").click();
    await page.locator("iframe.training-frame").waitFor({ state: "detached" });
    // 完了後に出撃準備へ進むので、タイトルを開き直す。
    await openHome();
  }
  for (const size of [
    { width: 844, height: 390 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(size);
    await page.locator("#home-settings").click();
    await page.waitForTimeout(600);
    const slider = page.getByRole("slider", {
      name: "管制AI音量",
      exact: true,
    });
    assert.equal(await slider.count(), 1);
    await slider.focus();
    await slider.press("Home");
    for (let i = 0; i < 5; i++) await slider.press("ArrowRight");
    const se = page.locator('[data-preference="seVolume"]');
    await se.focus();
    await se.press("Home");
    assert.equal(await slider.inputValue(), "0.25");
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= size.width);
    await page.screenshot({ path: `${out}/settings-${size.width}.png` });
    results.sizes.push(size);
    await openHome();
  }
  await page.locator("#home-settings").click();
  await page.waitForTimeout(600);
  assert.equal(
    await page
      .getByRole("slider", { name: "管制AI音量", exact: true })
      .inputValue(),
    "0.25",
  );
  results.savedVolume = await page.evaluate(() =>
    localStorage.getItem("swarm-front-control-voice-volume-v1"),
  );
  assert.equal(results.savedVolume, "0.25");
  // 音声パック画面と既存のダウンロード/削除・再読込保持を実経路で確認する。
  await page.getByRole("button", { name: "管制AIボイス", exact: true }).click();
  await page.waitForTimeout(600);
  const hiromi = page.locator('.cv-row[data-voice="hiromi"]');
  await hiromi.locator('[data-cv-action="download"]').click();
  await hiromi
    .getByText("保存済み", { exact: true })
    .waitFor({ timeout: 30000 });
  await openHome();
  await page.locator("#home-settings").click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "管制AIボイス", exact: true }).click();
  await page.waitForTimeout(600);
  await hiromi.getByText("保存済み", { exact: true }).waitFor();
  await hiromi.locator('[data-cv-action="delete"]').click();
  await hiromi.getByText("未ダウンロード", { exact: true }).waitFor();
  results.packDownloadReloadDelete = true;
  assert.deepEqual(results.errors, []);
  await context.close();
} finally {
  await writeFile(`${out}/result.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
