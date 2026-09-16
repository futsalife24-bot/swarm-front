import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/weapon-marks-unified";
fs.mkdirSync(out, { recursive: true });
const save = JSON.parse(
  fs.readFileSync("dist-validation/gear-pinned/fixture.json", "utf8"),
);
const legacy = {
  id: "legacy-mark",
  kind: "rocket",
  rarity: 2,
  power: 1.324,
  effect: "chain",
  acquired: 0,
  testData: false,
  rolls: { mag: 1.24, reload: 1.034, range: 1.25, rate: 1.25 },
};
const cases = [
  { w: legacy, marks: ["▼", "▼", "▼", "▼", "▼"] },
  ...["rifle", "shotgun", "rocket"].flatMap((kind) =>
    [0, 19, 20].map((n) => ({
      w: {
        id: kind + "-" + n,
        kind,
        rarity: 3,
        power: 1.15 ** 3 * (1 + n / 100),
        effect: "none",
        format: 2,
        variance: { power: n, reload: n, range: n, rate: n },
        acquired: 1,
        testData: false,
      },
      marks: [
        n === 20 ? "★" : n === 19 ? "▲\n▲" : "",
        "",
        n === 20 ? "★" : n === 19 ? "▲\n▲" : "",
        n === 20 ? "★" : n === 19 ? "▲\n▲" : "",
        n === 20 ? "★" : n === 19 ? "▲\n▲" : "",
      ],
    })),
  ),
];
save.inventory = [...cases.map((c) => c.w), ...save.inventory.slice(1, 3)];
save.soldiers[0].equipped[0] = legacy.id;
save.pending = [];
const browser = await chromium.launch({ channel: "chrome" });
const results = [];
try {
  for (const width of [844, 1280]) {
    const p = await browser.newPage({ viewport: { width, height: 390 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(
      (s) =>
        localStorage.setItem(
          "swarm-front-progression-v2-normal",
          JSON.stringify(s),
        ),
      save,
    );
    await p.goto("http://127.0.0.1:5347/");
    await p.locator("#solo").click();
    await p.locator("#player-name").fill("表示検証");
    await p.locator("#player-name-form button[type=submit]").click();
    assert.deepEqual(
      await p.locator("[data-pinned] .pt-stat-inner sup").allTextContents(),
      cases[0].marks,
    );
    await p.screenshot({ path: out + "/" + width + "-list.png" });
    await p.locator("#pt-organize").click();
    for (const { w, marks } of cases) {
      const row = p.locator('[data-row="' + w.id + '"]');
      assert.deepEqual(
        await row.locator(".pt-stat-inner sup").allTextContents(),
        marks,
      );
      await row.locator("[data-detail]").click();
      assert.deepEqual(
        await p.locator("#pt-comparison sup").allTextContents(),
        marks,
      );
      if (w.id === "legacy-mark" || w.id === "rocket-20") {
        await p.locator("#pt-comparison").scrollIntoViewIfNeeded();
        await p.screenshot({
          path: out + "/" + width + "-" + w.id + "-detail.png",
        });
        if (width === 844) {
          await p.evaluate(() => {
            window.drawnText = [];
            window.originalFillText ??=
              CanvasRenderingContext2D.prototype.fillText;
            const original = window.originalFillText;
            CanvasRenderingContext2D.prototype.fillText = function (
              t,
              ...args
            ) {
              window.drawnText.push(t);
              return original.call(this, t, ...args);
            };
          });
          await p.locator("#pt-share").click();
          await p.locator('img[alt="武器の共有画像"]').waitFor();
          await p
            .locator('img[alt="武器の共有画像"]')
            .evaluate((img) => img.decode());
          const text = await p.evaluate(() => window.drawnText);
          assert.equal(
            text.filter((t) => t === "★").length,
            w.id === "rocket-20" ? 4 : 0,
          );
          assert.equal(
            text.filter((t) => t === "▼").length,
            w.id === "legacy-mark" ? 5 : 0,
          );
          const src = await p
            .locator('img[alt="武器の共有画像"]')
            .getAttribute("src");
          const bytes = await p.evaluate(
            async (src) =>
              Array.from(
                new Uint8Array(await (await fetch(src)).arrayBuffer()),
              ),
            src,
          );
          fs.writeFileSync(out + "/" + w.id + "-share.png", Buffer.from(bytes));
          await p.locator("#share-close").click();
        }
      }
      await p.locator(".dialog-close").click();
    }
    assert.deepEqual(errors, []);
    results.push({
      width,
      cases: cases.length,
      listDetailMatch: true,
      shared: width === 844,
      errors,
    });
    await p.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
console.log(results);
