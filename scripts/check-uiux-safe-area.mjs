import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const out = "dist-validation/base-decks/safe-area";
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const result = [];
try {
  const p = await b.newPage({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  await p.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.setProperty("--safe-left", "44px");
      document.documentElement.style.setProperty("--safe-right", "20px");
    }),
  );
  const check = async (name, selector) => {
    await p.locator(selector).waitFor();
    await p.waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (a) =>
            a.playState !== "running" ||
            a.effect?.getTiming().iterations === Infinity,
        ),
    );
    const r = await p.locator(selector).evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
    await p.screenshot({ path: `${out}/${name}.jpg`, quality: 80 });
    result.push({ name, ...r });
    assert.ok(
      r.left >= 44 && r.right <= 824 && r.top >= 0 && r.bottom <= 390,
      JSON.stringify({ name, ...r }),
    );
  };
  await p.goto("http://127.0.0.1:5186/front.html", {
    waitUntil: "domcontentloaded",
  });
  await check("title", "#solo");
  await check("title-art", ".title");
  await p.locator("#coop").click();
  await check("coop", ".room-browser");
  await p.locator("#home").click();
  await p.locator("#open-armory").click();
  await check("base", ".front-base");
  await p.locator("#base-back").click();
  await p.locator("#solo").click();
  await check("prep", ".front-prep");
  await p.goto("http://127.0.0.1:5186/", { waitUntil: "domcontentloaded" });
  await check("legacy-title", "#solo");
  await p.locator("#coop").click();
  await p.locator("#player-name,#room-join").first().waitFor();
  if (await p.locator("#player-name").count()) {
    await p.locator("#player-name").fill("安全領域確認");
    await p.locator("#player-name-form button").click();
  }
  await check("legacy-coop", ".room-browser");
  await p.locator("#home").click();
  await p.locator("#solo").click();
  if (await p.locator("#pt-confirm").isVisible())
    await p.locator("#pt-confirm").click();
  await check("legacy-prep", ".gear");
} finally {
  await b.close();
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(result, null, 2));
}
console.log(`${result.length}画面: 左44px・右20pxの安全領域内`);
