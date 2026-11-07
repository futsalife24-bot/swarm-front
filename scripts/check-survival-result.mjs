// 終了直前だけ隔離した状態を準備。時間短縮fixtureを実プレイの証拠にしない。
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5186";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error("Local fixture only");
const baseline = process.env.BASELINE === "1";
const out = process.argv[2] ?? "dist-validation/survival-result-rewards";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
let activePage;
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
    [568, 320],
  ]) {
    if (process.env.WIDTH && width !== Number(process.env.WIDTH)) continue;
    for (const scenario of process.env.SCENARIO
      ? [process.env.SCENARIO]
      : ["return", "defeat", "short", "save-failure"]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        serviceWorkers: "block",
        reducedMotion: width === 844 ? "no-preference" : "reduce",
      });
      activePage = page;
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(
        /\/src\/client\/front-app.ts(?:\?.*)?$/,
        async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            body:
              (await response.text()) +
              `
window.resultFixture = (scenario) => {
  if (!localRun) throw Error("ソロ戦闘が必要です");
  localRun.world.time = scenario === "long" ? 1800 : scenario === "short" ? 20 : 125;
  localRun.world.players[0].kills = 31;
  localRun.treasureCoins = { [id]: 10 };
  if (scenario === "save-failure") {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "swarm-front-shared-progress-v3") throw Error("試験用保存失敗");
      return original.call(this, key, value);
    };
    window.restoreResultStorage = () => { Storage.prototype.setItem = original; };
  }
  if (scenario === "defeat" || scenario === "short") localRun.world.players[0].hp = 0;
  else returnFrontRun(localRun);
};`,
          });
        },
      );
      const tap = async (selector) => {
        await page
          .locator(".split-shutter,.menu-route-shutter")
          .waitFor({ state: "detached" });
        await page.locator(selector).tap();
      };
      await page.goto(`${origin}/front`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await tap(".title-entry-start");
      await tap("#solo");
      await tap('[data-operation="survival"]');
      await tap("#front-launch");
      await page.locator("[data-card]").first().waitFor({ timeout: 120000 });
      await tap("[data-card]:first-of-type");
      await expect(page.locator("#controls")).toBeVisible();
      await page.locator(".operation-cue").waitFor({ state: "detached" });
      await page.evaluate((s) => window.resultFixture(s), scenario);
      await page.locator("#front-leave").waitFor();
      await page.locator(".operation-cue").waitFor({ state: "detached" });
      const detailChecks = [];
      const checkDetail = async (saved) => {
        const name = page.locator("#ui [data-detail]").first();
        const id = await name.getAttribute("data-detail");
        const rowLock = page.locator(`#ui [data-lock="${id}"]`);
        if (saved) await expect(rowLock).toBeEnabled();
        else await expect(rowLock).toBeDisabled();
        const rowLayout = await rowLock.evaluate(button => {
          const row = button.closest("[data-row]"), r = row.getBoundingClientRect();
          const b = button.getBoundingClientRect(), n = row.querySelector("[data-detail]").getBoundingClientRect();
          return { rightmost: b.left >= n.right - 1 && b.right <= r.right + 1,
            withinRow: b.top >= r.top - 1 && b.bottom <= r.bottom + 1 };
        });
        expect(rowLayout.rightmost && rowLayout.withinRow, JSON.stringify(rowLayout)).toBe(true);
        const before = await page.evaluate(() => localStorage.getItem("swarm-front-shared-progress-v3"));
        await name.tap();
        const dialog = page.locator(".weapon-detail-dialog[open]");
        await expect(dialog).toBeVisible();
        await expect(dialog.locator("#pt-comparison tr")).toHaveCount(6);
        await expect(dialog.locator("select")).toHaveCount(0);
        await expect(dialog.locator("#pt-share")).toHaveText("共有");
        if (saved) await expect(dialog.locator("#pt-detail-lock")).toBeEnabled();
        else {
          await expect(dialog.locator("#pt-detail-lock")).toBeDisabled();
          await expect(dialog.locator(".weapon-detail-note")).toContainText("未保存");
        }
        await dialog.locator("#pt-weapon-preview canvas").waitFor();
        if (!saved) {
          const noteLayout = await dialog.evaluate(d => {
            const note = d.querySelector(".weapon-detail-note").getBoundingClientRect();
            const body = d.querySelector(".menu-dialog-body").getBoundingClientRect();
            const overlaps = [...d.querySelectorAll(".weapon-detail-actions button")].some(el => {
              const b = el.getBoundingClientRect();
              return note.left < b.right && note.right > b.left && note.top < b.bottom && note.bottom > b.top;
            });
            return { overlaps, visible: note.top >= body.top - 1 && note.bottom <= body.bottom + 1 && note.left >= body.left - 1 && note.right <= body.right + 1 };
          });
          expect(noteLayout.visible && !noteLayout.overlaps, JSON.stringify(noteLayout)).toBe(true);
        }
        const layout = await dialog.evaluate(d => {
          const rect = selector => d.querySelector(selector).getBoundingClientRect();
          const a = rect("#pt-detail-lock"), b = rect("#pt-share"), box = d.getBoundingClientRect();
          return {
            overflow: [d, ...d.querySelectorAll(".menu-dialog-body,.weapon-detail-layout,#pt-comparison")]
              .map(el => ({ tag: el.className || el.id, x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight })),
            aligned: Math.abs(a.top - b.top) <= 2 && Math.abs(a.height - b.height) <= 2 && a.height >= 43 && b.height >= 43,
            sideBySide: rect(".weapon-detail-visual").right <= rect("#pt-comparison").left + 2,
            visible: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
          };
        });
        detailChecks.push({ saved, id, rowLayout, layout });
        expect(layout.aligned && layout.sideBySide && layout.visible, JSON.stringify(layout)).toBe(true);
        expect(layout.overflow.every(v => v.x <= 2 && v.y <= 2), JSON.stringify(layout)).toBe(true);
        await page.screenshot({ path: `${out}/${width}-${scenario}-${saved ? "saved" : "unsaved"}-detail.png` });
        await dialog.locator(".dialog-close").click();
        await expect(dialog).toHaveCount(0);
        expect(await page.evaluate(() => localStorage.getItem("swarm-front-shared-progress-v3"))).toBe(before);
        if (saved) {
          await expect(rowLock).toHaveAttribute("aria-pressed", "false");
          await rowLock.tap();
          await expect(rowLock).toHaveAttribute("aria-pressed", "true");
          expect(await page.evaluate(id => JSON.parse(localStorage.getItem("swarm-front-shared-progress-v3")).locks.includes(id), id)).toBe(true);
          await rowLock.tap();
          await expect(rowLock).toHaveAttribute("aria-pressed", "false");
        }
      };
      if (scenario === "save-failure") {
        await expect(page.locator("#front-retry-save")).toBeVisible();
        if (!baseline) await checkDetail(false);
        await page.screenshot({
          path: `${out}/${width}-${scenario}-before.png`,
        });
        await page.evaluate(() => window.restoreResultStorage());
        await tap("#front-retry-save");
        await expect(page.locator("#front-retry-save")).toHaveCount(0);
      }
      await expect(page.locator("#ui")).toContainText("攻略コイン");
      await expect(page.locator("#ui")).toContainText(
        scenario === "long" ? "+310" : scenario === "short" ? "+10" : "+30",
      );
      if (!baseline) {
        await expect(
          page.getByRole("heading", { name: "獲得報酬", exact: true }),
        ).toBeVisible();
        await expect(page.locator("#ui [data-row]")).toHaveCount(
          scenario === "long" ? 30 : scenario === "short" ? 0 : 3,
        );
        if (scenario !== "short") await checkDetail(true);
        if (width >= 844)
          expect(
            await page
              .locator("#ui .pt-stat-scroll")
              .evaluateAll((cells) =>
                cells.every((cell) => cell.scrollWidth <= cell.clientWidth + 1),
              ),
          ).toBe(true);
        if (scenario === "long")
          await page.locator("#ui [data-row]").last().scrollIntoViewIfNeeded();
      }
      const layout = await page.locator("#front-leave").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          visible:
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            r.left >= 0 &&
            r.right <= innerWidth,
          panelScroll: el.closest("section").scrollHeight,
        };
      });
      expect(layout.visible).toBe(true);
      await page.screenshot({ path: `${out}/${width}-${scenario}.png` });
      const rewardText = await page.locator("#ui").innerText();
      expect(errors).toEqual([]);
      results.push({
        width,
        height,
        scenario,
        baseline,
        layout,
        detailChecks,
        rewardText,
        errors,
      });
      await tap("#front-leave");
      await expect(page.locator("#solo")).toBeVisible();
      if (process.env.INTEGRATION_FLOW === "1") {
        await tap("#solo");
        await tap('[data-operation="survival"]');
        await tap("#front-launch");
        await page.locator("[data-card]").first().waitFor({ timeout: 120000 });
        await tap("[data-card]:first-of-type");
        await expect(page.locator("#controls")).toBeVisible();
        await page.locator(".operation-cue").waitFor({ state: "detached" });
        results[results.length - 1].relaunched = true;
        await page.screenshot({ path: `${out}/${width}-${scenario}-relaunched.png` });
      }
      await page.close();
      console.log(`${width} ${scenario}: 合格`);
    }
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${out}/failure.png`, timeout: 10000 }).catch(() => {});
    fs.writeFileSync(`${out}/failure.json`, JSON.stringify({ message: String(error), url: activePage.url() }, null, 2));
  }
  throw error;
} finally {
  fs.writeFileSync(
    `${out}/${baseline ? "baseline" : "results"}.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser.close();
}
console.log(`${results.length}条件: 生存終了と保存状態を確認`);
