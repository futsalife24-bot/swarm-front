// 隔離した保存を使う実UI検査。進撃突破の準備だけfixture、育成/除外/保存は通常操作。
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5186";
const out = process.argv[2] ?? "dist-validation/survival-progression";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const reports = [];
try {
  for (const [width, height, reducedMotion] of [
    [844, 390, "no-preference"],
    [640, 360, "reduce"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion,
      hasTouch: true,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.poolEvents = [];
      const nodes = new WeakMap();
      let serial = 0;
      for (const capture of [true, false])
        for (const type of [
          "pointerdown",
          "pointerup",
          "pointercancel",
          "click",
        ])
          document.addEventListener(
            type,
            (e) => {
              const b = e.target.closest?.("[data-pool]");
              if (!b) return;
              const r = b.getBoundingClientRect();
              if (!nodes.has(b)) nodes.set(b, ++serial);
              window.poolEvents.push({
                type,
                capture,
                node: nodes.get(b),
                connected: b.isConnected,
                routeShutter: !!document.querySelector(".menu-route-shutter"),
                id: b.dataset.pool,
                x: e.clientX,
                y: e.clientY,
                rect: r.toJSON(),
                checked: b.getAttribute("aria-checked"),
              });
            },
            capture,
          );
    });
    const settle = () =>
      page.waitForFunction(
        () => !document.querySelector(".split-shutter, .menu-route-shutter"),
      );
    const tap = async (selector) => {
      await settle();
      await page.locator(selector).tap();
    };
    const shot = async (name) => {
      await settle();
      await page.screenshot({
        path: `${out}/${width}-${name}.png`,
        animations: "disabled",
      });
    };
    const growth = async () => {
      await tap("#pt-base-growth");
      await page.locator(".pt-growth").waitFor();
      await settle();
      if (await page.locator("#pt-tutorial-skip").count())
        await tap("#pt-tutorial-skip");
      await tap("#pt-survival-tactics");
      await expect(page.locator(".survival-tactics")).toBeVisible();
    };
    const loadout = () =>
      page.evaluate(async () =>
        (
          await import("/src/client/front-campaign.ts")
        ).readFrontSurvivalLoadout(localStorage),
      );
    try {
      await page.goto(`${origin}/?base=1`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.getByRole("button", { name: "確定", exact: true }).tap();
      await page.locator(".pt-base-menu").waitFor();
      expect((await loadout()).pool).toHaveLength(8);
      await growth();
      await expect(page.locator("#tactics-budget")).toContainText("0/0pt");
      await page.locator('[data-tactics="rerolls"]').selectOption("1");
      await expect(page.locator("#tactics-save")).toBeDisabled();
      await expect(page.locator("#tactics-message")).toContainText("不足");
      await shot("locked-training");
      await tap("dialog .dialog-close");
      // 通常の進撃2突破相当の記録を隔離保存に準備。攻略プレイの代わりではない。
      await page.evaluate(async () => {
        const { loadProgress, persistProgress } =
          await import("/src/client/progression-save.ts");
        const s = loadProgress("normal");
        s.missions["1:normal"] = [true, false, false];
        s.missions["2:normal"] = [true, false, false];
        persistProgress(s);
      });
      await page.goto(`${origin}/?base=1`, { waitUntil: "domcontentloaded" });
      await page.locator(".pt-base-menu").waitFor();
      await growth();
      await expect(page.locator("#tactics-budget")).toContainText("0/1pt");
      await page.locator('[data-tactics="rerolls"]').selectOption("1");
      await expect(
        page.locator('[data-tactics-total="rerolls"]'),
      ).toContainText("3回");
      await shot("training");
      const bounds = await page
        .locator("dialog:has(.survival-tactics)")
        .evaluate((d) => ({
          body: d.querySelector(".menu-dialog-body").getBoundingClientRect()
            .bottom,
          footer: d.querySelector(".tactics-actions").getBoundingClientRect()
            .top,
        }));
      expect(bounds.body).toBeLessThanOrEqual(bounds.footer + 1);
      await page.locator(".survival-tactics summary").tap();
      await expect(page.locator(".survival-tactics tbody tr")).toHaveCount(7);
      await shot("rewards-table");
      await page.locator(".survival-tactics summary").tap();
      await tap("#tactics-save");
      await expect(page.locator(".survival-tactics")).toHaveCount(0);
      expect(await loadout()).toMatchObject({
        rerolls: 3,
        exclusions: 1,
        error: "",
      });
      await tap("#pt-base");
      await tap("#pt-base-survival");
      await page.locator(".front-base").waitFor();
      await expect(page.locator("#base-count")).toContainText("抽選 12/12種");
      await tap('[data-pool="magnet"]');
      await expect(page.locator('[data-pool="magnet"]')).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await tap('[data-pool="armor"]');
      await expect(page.locator("#front-pool-status")).toContainText(
        "除外枠がいっぱい",
      );
      await expect(page.locator('[data-pool="armor"]')).toHaveAttribute(
        "aria-checked",
        "false",
      );
      await tap("#base-back");
      await expect(page.locator("dialog.base-confirm")).toBeVisible();
      await settle();
      await page.keyboard.press("Escape");
      await expect(page.locator("dialog.base-confirm")).toHaveCount(0);
      await tap("#front-save-pool");
      await expect(page.locator("#front-pool-status")).toContainText(
        "保存しました",
      );
      expect((await loadout()).pool).not.toContain("magnet");
      await page.reload();
      await page.locator(".front-base").waitFor();
      await settle();
      await expect(page.locator('[data-pool="magnet"]')).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(page.locator("#base-count")).toContainText(
        "抽選 11/12種 · 除外 1/1",
      );
      await shot("exclusions");
      const overflow = await page.locator(".base-header").evaluate((el) =>
        [...el.querySelectorAll("button")]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.left < 0 ||
              r.right > innerWidth ||
              r.top < 0 ||
              r.bottom > innerHeight
            );
          })
          .map((e) => e.textContent),
      );
      expect(overflow).toEqual([]);
      await page.goto(`${origin}/front?solo=1`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator(".front-prep").waitFor();
      await settle();
      await expect(page.locator(".gear-arsenal")).toContainText(
        "抽選 11種 · 除外 1/1 · 再抽選 3回",
      );
      await shot("prep");
      expect(errors).toEqual([]);
      reports.push({
        width,
        height,
        reducedMotion,
        initialCards: 8,
        stage2Cards: 12,
        rerolls: 3,
        exclusions: 1,
        poolAfterExclusion: 11,
        refundGuard: true,
        reload: true,
        pageErrors: errors,
      });
      console.log(`${width}x${height}: 育成・除外・再読込・出撃準備 合格`);
    } catch (e) {
      await shot("failure");
      fs.writeFileSync(
        `${out}/${width}-failure-events.json`,
        JSON.stringify(
          await page.evaluate(() => ({
            events: window.poolEvents,
            status: document.querySelector("#front-pool-status")?.textContent,
          })),
          null,
          2,
        ),
      );
      throw e;
    } finally {
      await context.close();
    }
  }
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(reports, null, 2) + "\n",
  );
  await browser.close();
}
