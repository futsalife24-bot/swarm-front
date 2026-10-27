// 本人のセーブや公開サーバーを使わず、隔離Workerと実ブラウザで確認する。
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const origin = "http://127.0.0.1:5186";
const endpoint = "http://127.0.0.1:8798";
const out = "dist-validation/free-lobby";
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
assert(key, "既存のローカル試験キーが必要です");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
async function waitMenuReady(page) {
  const transition = page.locator(".split-shutter, .menu-route-shutter");
  await transition.waitFor({ state: "visible", timeout: 1500 }).catch(() => {});
  await transition.waitFor({ state: "detached" });
}
try {
  for (const mode of ["survival", "campaign"]) {
    for (const listed of [true, false]) {
      const context = await browser.newContext({
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        serviceWorkers: "block",
        permissions: ["clipboard-read", "clipboard-write"],
      });
      // 空の検証プロファイルに、合成の表示名だけを用意する。
      await context.addInitScript(() =>
        localStorage.setItem("swarm-front-player-name-v1", "検証隊員"),
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(45000);
      await page.goto(
        `${origin}/${mode === "survival" ? "front.html" : ""}?coop=1`,
        { waitUntil: "domcontentloaded" },
      );
      await page.locator(".room-browser").waitFor();
      if (listed) await page.locator('[data-room-access="public"]').click();
      await page.locator(".coop-advanced summary").click();
      await page.locator("#endpoint").fill(endpoint);
      await page.locator("#endpoint").dispatchEvent("change");
      await page.locator("#creation-key").fill(key);
      await page.locator(".coop-advanced summary").click();
      await waitMenuReady(page);
      await page.locator(":light(#launch)").click();
      if (mode === "survival") {
        await page.locator(":light(#front-launch)").waitFor();
        await waitMenuReady(page);
        await page.locator(":light(#front-launch)").click();
        // 画面配置の確認は戦場モデルの読込完了を条件にしない。
        await page.locator(":light(#front-start)").waitFor();
      } else await page.locator(":light(#room-code)").waitFor();
      await waitMenuReady(page);
      const label = page.locator(":light(.room-access-label)");
      await page.waitForFunction(
        (expected) =>
          document.querySelector(".room-access-label")?.dataset.access ===
          expected,
        listed ? "public" : "private",
      );
      assert.equal(
        await label.innerText(),
        listed ? "フリーマッチング" : "パスワード付き",
      );
      if (mode === "survival") {
        assert.match(
          await page.locator(":light(.front-room-access)").innerText(),
          listed ? /部屋一覧に公開/ : /一覧には表示されません/,
        );
        if (listed)
          assert.match(
            await page.locator(":light(.front-lobby .fine)").innerText(),
            /直接招待する場合/,
          );
      } else if (listed)
        assert.match(
          await page.locator(":light(.squad-member.empty)").first().innerText(),
          /部屋一覧/,
        );

      if (mode === "survival")
        await page
          .locator(":light(#rebuild-notice)")
          .waitFor({ state: "hidden" });
      for (const [width, height] of [
        [844, 390],
        [640, 360],
      ]) {
        await page.setViewportSize({ width, height });
        const panel = page.locator(
          mode === "survival" ? ":light(.front-lobby)" : ":light(.lobby)",
        );
        const checks = await panel.evaluate((element) => {
          const selectors = document.body.classList.contains("front-game")
            ? [
                ".room-access-label",
                "#front-copy-password",
                "#front-copy",
                "#front-start",
              ]
            : [".room-access-label", "#copy", "#share", "#leave-lobby"];
          const boxes = selectors.map((selector) => {
            const target = element.querySelector(selector);
            const rect = target.getBoundingClientRect();
            return {
              selector,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
            };
          });
          return {
            overflow: element.scrollWidth > element.clientWidth + 1,
            boxes,
          };
        });
        assert.equal(
          checks.overflow,
          false,
          JSON.stringify({ mode, listed, width, checks }),
        );
        for (const box of checks.boxes)
          assert(
            box.left >= 0 &&
              box.right <= width &&
              box.top >= 0 &&
              box.bottom <= height,
            JSON.stringify({ mode, listed, width, box }),
          );
        for (const [index, a] of checks.boxes.entries())
          for (const b of checks.boxes.slice(index + 1))
            assert(
              Math.max(a.left, b.left) >= Math.min(a.right, b.right) ||
                Math.max(a.top, b.top) >= Math.min(a.bottom, b.bottom),
              JSON.stringify({ mode, listed, width, a, b }),
            );
        await page.screenshot({
          path: `${out}/${mode}-${listed ? "free" : "private"}-${width}.png`,
        });
        results.push({ mode, listed, width, height, checks });
      }
      const password = await page
        .locator(
          mode === "survival"
            ? ":light(#front-room-password)"
            : ":light(#room-code)",
        )
        .innerText();
      assert.match(password, /^[A-F0-9]{8}$/);
      await page
        .locator(
          mode === "survival"
            ? ":light(#front-copy-password)"
            : ":light(#copy)",
        )
        .click();
      await page.waitForFunction(
        async (expected) => (await navigator.clipboard.readText()) === expected,
        password,
      );
      if (mode === "survival") {
        await page.locator(":light(#front-copy)").click();
        await page.waitForFunction(async (expected) => {
          try {
            return (
              new URL(await navigator.clipboard.readText()).searchParams.get(
                "frontRoom",
              ) === expected
            );
          } catch {
            return false;
          }
        }, password);
      }
      assert.deepEqual(errors, []);
      await page
        .locator(
          mode === "survival" ? ":light(#front-leave)" : ":light(#leave-lobby)",
        )
        .click();
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${out}/ui.json`, JSON.stringify({ results }, null, 2) + "\n");
console.log(
  `${results.length}条件: 実Workerで作成した公開・非公開のロビー表示を確認`,
);
