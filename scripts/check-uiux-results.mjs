// 結果の表示fixture。攻略達成や通常戦闘の証明には使わない。ローカル専用。
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = "http://127.0.0.1:5186",
  out = "dist-validation/base-decks/results";
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const records = [];
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ])
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const p = await b.newPage({
          viewport: { width, height },
          reducedMotion,
          serviceWorkers: "block",
        }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.route(
        /\/src\/client\/playtest-app.ts(?:\?.*)?$/,
        async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            body:
              (await response.text()) +
              '\nwindow.uiuxResultFixture=(win)=>{world.enemies=[];world.drops=[];if(win){world.phase="victory";world.rewards.solo=[];victory();}else{defeatChoice();}};',
          });
        },
      );
      await p.goto(origin, { waitUntil: "domcontentloaded" });
      await p.locator("#solo").waitFor();
      await p.evaluate(async () => {
        const m = await import("/src/client/progression-save.ts"),
          defs = await import("/src/shared/defs.ts");
        const s = m.freshProgress("normal");
        s.encounters = Object.fromEntries(
          Object.keys(defs.ENEMIES).map((id) => [id, "solo"]),
        );
        s.tutorials = [
          "growth",
          "accessories",
          "gear",
          "armory",
          "base",
          "battle",
        ];
        localStorage.setItem(m.newSaveKey("normal"), JSON.stringify(s));
        localStorage.setItem("swarm-front-player-name-v1", "結果画面検証");
      });
      await p.reload({ waitUntil: "domcontentloaded" });
      const capture = async (name, selector) => {
        await p.locator(selector).waitFor();
        const metric = await p.locator(selector).evaluate((e) => {
          const r = e.getBoundingClientRect(),
            hit = document.elementFromPoint(
              r.x + r.width / 2,
              r.y + r.height / 2,
            );
          return {
            inside:
              r.x >= 0 &&
              r.y >= 0 &&
              r.right <= innerWidth + 1 &&
              r.bottom <= innerHeight + 1,
            hit: !!hit && (hit === e || e.contains(hit)),
          };
        });
        await p.screenshot({
          path: `${out}/${width}-${reducedMotion}-${name}.jpg`,
          quality: 80,
        });
        assert.ok(metric.inside && metric.hit, name);
        return metric;
      };
      const launch = async () => {
        await p.locator("#solo").click();
        await p.locator("#pt-start").click();
        await p.locator("#pt-enter").click({ timeout: 90000 });
        if (await p.locator("#pt-tutorial-skip").isVisible())
          await p.locator("#pt-tutorial-skip").click();
        await p.locator("#controls").waitFor();
      };
      await launch();
      await p.evaluate(() => window.uiuxResultFixture(true));
      await capture("collection", "#pt-end-collection");
      await p.locator("#pt-end-collection").click();
      await capture("reward", "#pt-normal-reward");
      await p.locator("#pt-normal-reward").click();
      await capture("victory", "#pt-result-home");
      await p.locator("#pt-result-home").click();
      await launch();
      await p.evaluate(() => window.uiuxResultFixture(false));
      await capture("down", "#pt-defeat");
      await p.locator("#pt-defeat").click();
      await capture("defeat", "#pt-result-home");
      await p.locator("#pt-result-home").click();
      assert.deepEqual(errors, []);
      records.push({
        width,
        height,
        reducedMotion,
        fixture: true,
        collection: true,
        reward: true,
        victory: true,
        down: true,
        defeat: true,
        errors,
      });
      await p.close();
    }
} finally {
  await b.close();
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(records, null, 2));
}
console.log(
  `${records.length}条件: 従来版の回収・報酬・勝利・ダウン・敗北の表示fixture成功`,
);
