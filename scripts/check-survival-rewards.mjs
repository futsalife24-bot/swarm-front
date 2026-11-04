// 実ローカルWorkerと製品UIを使用。敵撃破直前の準備だけtest専用fixtureを使用する。
import { chromium, expect } from "@playwright/test";
import { localCreationKey } from "../tests/credentials.ts";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5186";
const api = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8807";
const out = process.argv[2] ?? "dist-validation/survival-rewards";
fs.mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
try {
  for (const [width, height, reducedMotion] of [
    [844, 390, "no-preference"],
    [640, 360, "reduce"],
  ]) {
    const response = await fetch(`${api}/rooms`, {
      method: "POST",
      headers: { "X-Room-Creation-Key": localCreationKey() },
      body: JSON.stringify({
        ruleset: "front-v1",
        mode: "survival",
        name: "報酬画面の隔離検証",
        listed: false,
      }),
    });
    expect(response.status).toBe(200);
    const { code } = await response.json();
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion,
      hasTouch: true,
      serviceWorkers: "block",
    });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // ナビゲーションの前に観測だけを設置。ゲームや選択時刻を書き換えない。
    await page.addInitScript(() => {
      window.rewardSequence = [];
      addEventListener("DOMContentLoaded", () => {
        let last = "";
        new MutationObserver(() => {
          const state = document.querySelector(".front-treasure")
            ? "treasure"
            : document.querySelector(".front-level-up")
              ? "level-up"
              : document.querySelector(".rebuild-selection")
                ? "choices"
                : document.querySelector("#controls:not([hidden])")
                  ? "combat"
                  : "other";
          if (state !== last) {
            window.rewardSequence.push({
              state,
              time: performance.now(),
              choices: document.querySelectorAll("[data-card]").length,
            });
            last = state;
          }
        }).observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["hidden"],
        });
      });
    });
    await page.goto(`${origin}/front?coop=1`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    const settle = () =>
      page.locator(".split-shutter").waitFor({ state: "detached" });
    const tap = async (selector) => {
      await settle();
      await page.locator(selector).tap();
    };
    if (await page.locator(".title-entry-start").count())
      await tap(".title-entry-start");
    await page.locator(".room-browser").waitFor();
    const details = page.locator("details:has(#endpoint)");
    if ((await details.count()) && !(await details.getAttribute("open")))
      await details.locator("summary").click();
    await page.locator("#endpoint").fill(api);
    await page.locator("#room-id").fill(code);
    await tap("#room-join");
    await page
      .locator(".front-prep")
      .waitFor({ timeout: 20000 })
      .catch(async () => {
        throw Error(
          `部屋参加後の表示: ${(await page.locator(".status,#room-list-status,#rebuild-notice").allTextContents()).join(" / ")}`,
        );
      });
    await tap("#front-launch");
    await expect(page.locator("#front-start")).toBeEnabled({ timeout: 120000 });
    await tap("#front-start");
    await page.locator("[data-card]").first().waitFor({ timeout: 120000 });
    await expect(page.locator(".operation-cue")).toHaveCount(0);
    await tap("[data-card]:first-of-type");
    await expect(page.locator("#controls")).toBeVisible();
    await page.locator(".rebuild-selection").waitFor({ state: "detached" });
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    const drop = await fetch(`${api}/fixtures/${code}/front-treasure-drop`, {
      method: "POST",
    });
    expect(drop.status).toBe(200);
    await page.waitForTimeout(350);
    const snapshot = await (
      await fetch(`${api}/fixtures/${code}/snapshot`)
    ).json();
    expect(snapshot.world.front.chests.length).toBe(1);
    await page.screenshot({ path: `${out}/${width}-drop.png` });
    await page.evaluate(() => {
      window.rewardSequence = [];
    });
    const fixture = await fetch(`${api}/fixtures/${code}/front-treasure`, {
      method: "POST",
    });
    expect(fixture.status).toBe(200);
    await page.locator('.front-treasure[data-revealed="true"]').waitFor();
    await expect(page.locator("[data-card]")).toHaveCount(0);
    await expect(page.locator(".operation-cue")).toHaveCount(0);
    await page.screenshot({ path: `${out}/${width}-treasure.png` });
    await page.locator(".front-level-up").waitFor();
    await expect(page.locator("[data-card]")).toHaveCount(0);
    await page.screenshot({ path: `${out}/${width}-level-up.png` });
    await page.locator("[data-card]").first().waitFor();
    await expect(page.locator(".front-level-up,.front-treasure")).toHaveCount(
      0,
    );
    await tap("#front-choice-owned");
    await expect(
      page.locator('#front-owned-dialog .sc-card[data-size="row"]'),
    ).toHaveCount(1);
    await expect(page.locator("#front-owned-dialog .sc-lv")).toContainText(
      "2/",
    );
    await tap("#front-owned-close");
    const sequenceBeforeReroll = await page.evaluate(() =>
      window.rewardSequence.filter((x) =>
        ["treasure", "level-up", "choices"].includes(x.state),
      ),
    );
    expect(sequenceBeforeReroll.map((x) => x.state)).toEqual([
      "treasure",
      "level-up",
      "choices",
    ]);
    expect(sequenceBeforeReroll.slice(0, 2).every((x) => x.choices === 0)).toBe(
      true,
    );
    expect(
      sequenceBeforeReroll[2].time - sequenceBeforeReroll[1].time,
    ).toBeGreaterThan(400);
    await tap("#rebuild-reroll");
    await expect(page.locator("#rebuild-reroll")).toContainText("残り1");
    // 既存の再抽選入力保護は300ms。軽減モードは撮影も速いため、
    // 次のカード決定を入力できる時刻まで待つ。
    await page.waitForTimeout(320);
    expect(
      await page.evaluate(
        () =>
          window.rewardSequence.filter((x) => x.state === "level-up").length,
      ),
    ).toBe(1);
    await page.screenshot({ path: `${out}/${width}-choices.png` });
    await tap("[data-card]:first-of-type");
    await expect(page.locator("#controls")).toBeVisible();
    expect(errors).toEqual([]);
    results.push({
      width,
      height,
      reducedMotion,
      sequence: sequenceBeforeReroll,
      noRerollReplay: true,
      upgradeFrom1To2: true,
      errors,
    });
    await page.close();
    console.log(`${width}x${height}: 実Workerの宝箱→カットイン→3択 合格`);
  }
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser.close();
}
