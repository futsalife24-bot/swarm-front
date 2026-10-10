import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = "http://127.0.0.1:5186",
  out = process.env.UIUX_OUTPUT || "dist-validation/base-decks/surfaces";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ])
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const p = await browser.newPage({
        viewport: { width, height },
        reducedMotion,
        hasTouch: true,
        serviceWorkers: "block",
      });
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.setDefaultTimeout(15000);
      const capture = async (name, targets = []) => {
        await p.waitForFunction(
          () =>
            document
              .getAnimations()
              .every(
                (a) =>
                  a.playState !== "running" ||
                  a.effect?.getTiming().iterations === Infinity,
              ),
          {},
          { timeout: 8000 },
        );
        const metrics = await p.evaluate(
          (targets) => ({
            screen: document.body.dataset.screen,
            overflow: document.documentElement.scrollWidth > innerWidth,
            targets: targets.map((s) => {
              const e = document.querySelector(s);
              if (!e) return { s, missing: true };
              const r = e.getBoundingClientRect(),
                hit = document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                );
              return {
                s,
                x: r.x,
                y: r.y,
                w: r.width,
                h: r.height,
                inside:
                  r.x >= -1 &&
                  r.y >= -1 &&
                  r.right <= innerWidth + 1 &&
                  r.bottom <= innerHeight + 1,
                hit: !!hit && (hit === e || e.contains(hit)),
              };
            }),
            headerTapTargets: [
              ...document.querySelectorAll(
                ".pt-screen .menu-header nav button",
              ),
            ]
              .map((e) => {
                const r = e.getBoundingClientRect();
                return {
                  id: e.id,
                  text: e.textContent.trim(),
                  w: r.width,
                  h: r.height,
                };
              })
              .filter((r) => r.w > 0 && r.h > 0),
          }),
          targets,
        );
        await p.screenshot({
          path: `${out}/${width}-${reducedMotion}-${name}.jpg`,
          quality: 78,
        });
        results.push({
          name,
          width,
          height,
          reducedMotion,
          ...metrics,
          errors: [...errors],
        });
        assert.equal(metrics.overflow, false, name);
        assert.ok(
          metrics.targets.every((t) => t.inside && t.hit),
          JSON.stringify({ name, ...metrics }),
        );
        assert.ok(
          metrics.headerTapTargets.every((t) => t.w >= 43.9 && t.h >= 35.9),
          JSON.stringify({ name, headerTapTargets: metrics.headerTapTargets }),
        );
      };
      const go = async (path) => {
        await p.goto(origin + path, { waitUntil: "domcontentloaded" });
        await p.locator("#solo").waitFor();
      };
      const click = async (s) => p.locator(s).click();
      await go("/front.html");
      await capture("front-title", [
        "#solo",
        "#coop",
        "#open-armory",
        "#home-settings",
        "#home-tutorial",
      ]);
      await click("#home-tutorial");
      await capture("front-guide", ["#front-dialog-back"]);
      await click("#front-dialog-back");
      await click("#changelog");
      await capture("front-changelog", ["#front-dialog-back"]);
      await click("#front-dialog-back");
      await click("#home-settings");
      await capture("front-settings", [
        "#front-settings-back",
        "#front-setting-layout",
      ]);
      await click("#front-setting-layout");
      await capture("front-layout");
      await go("/front.html");
      await click("#open-bestiary");
      await capture("front-bestiary", ["#report-close"]);
      await click("#report-close");
      await click("#solo");
      await capture("front-prep", ["#front-launch", "#front-base"]);
      await go("/");
      // isolated test profile only: progression fixtures expose locked menus without changing production.
      await p.evaluate(async () => {
        const m = await import("/src/client/progression-save.ts"),
          s = m.freshProgress("normal");
        Object.assign(s, {
          coins: 4000,
          powder: 130,
          points: 120,
          materials: 2,
          unlocked: ["hp", "aim", "move", "swap"],
          tutorials: ["growth", "accessories", "gear", "armory", "base"],
          encounters: { crawler: "solo", ant: "coop" },
        });
        s.accessories = [0, 1, 2].map((i) => ({
          id: "uiux-" + i,
          kind: "pickup",
          rarity: 1,
          locked: false,
          testData: false,
        }));
        localStorage.setItem(m.newSaveKey("normal"), JSON.stringify(s));
      });
      await go("/");
      await capture("legacy-title", [
        "#solo",
        "#coop",
        "#open-armory",
        "#home-settings",
      ]);
      await click("#home-tutorial");
      await capture("legacy-guide", [".dialog-close"]);
      for (const i of [1, 2]) {
        await click("#tutorial-tab-" + i);
        await capture("legacy-guide-" + i, [".dialog-close"]);
      }
      await click(".dialog-close");
      await click("#changelog");
      await capture("legacy-changelog", [".dialog-close"]);
      await click(".dialog-close");
      await click("#home-settings");
      await capture("legacy-settings", [".dialog-close"]);
      await click("[data-sound-test]");
      await p.waitForFunction(
        () =>
          document
            .querySelector(".media-dialog audio")
            ?.src.startsWith("blob:"),
        {},
        { timeout: 60000 },
      );
      await click("[data-play]");
      await capture("legacy-media", [
        ".media-dialog .dialog-close",
        "[data-pause]",
      ]);
      await click(".media-dialog .dialog-close");
      await p.locator(".media-dialog").waitFor({ state: "detached" });
      await click(".dialog-close");
      await click("#open-bestiary");
      await capture("legacy-bestiary", ["#report-close"]);
      await click('[data-enemy="ant"]');
      await capture("legacy-bestiary-coop", ["#report-close"]);
      await click("#report-close");
      await click("#coop");
      await p.locator("#player-name,#room-join").first().waitFor();
      if (await p.locator("#player-name").count()) {
        await capture("legacy-profile", ["#player-name-form button"]);
        await p.locator("#player-name").fill("画面監査");
        await click("#player-name-form button");
      }
      await p.locator("#room-join").waitFor();
      await capture("legacy-coop", ["#home", "#room-join", "#room-refresh"]);
      await click("#home");
      await click("#solo");
      await capture("legacy-prep", ["#pt-start", "#pt-base"]);
      await click("#pt-organize");
      await capture("legacy-organize");
      await click("#pt-organize");
      await click("#pt-base");
      await capture("legacy-base");
      await click("#pt-base-accessories");
      await capture("legacy-accessories", ["#pt-target-craft"]);
      await click("#pt-target-craft");
      await capture("legacy-crafted");
      await click("#pt-synthesis");
      await capture("legacy-synthesis", ["#pt-confirm", "#pt-cancel"]);
      await click("#pt-cancel");
      await click("#pt-base");
      await click("#pt-base-growth");
      await capture("legacy-growth", ["#pt-allocate"]);
      await click(".radar-hp");
      await capture("legacy-growth-detail");
      await click('[data-growth-skill="hp"][data-growth-level="2"]');
      await click("#pt-allocate");
      await capture("legacy-growth-confirm", ["#pt-confirm", "#pt-cancel"]);
      await click("#pt-cancel");
      assert.deepEqual(errors, []);
      await p.close();
    }
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/surfaces.json`, JSON.stringify(results, null, 2));
}
console.log(
  `${results.length}画面条件で主要操作の収まり・到達性と実行例外を検証`,
);
