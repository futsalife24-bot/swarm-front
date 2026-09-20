import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/clean-capture";
fs.mkdirSync(out, { recursive: true });
const server = await createServer({
  server: { hmr: false, port: 5398, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const [width, height] of [
    [844, 390],
    [667, 375],
  ]) {
    for (const [name, query] of [
      ["normal", ""],
      ["clean", "?clean=1"],
      ["off", "?clean=1&tracers=off"],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        serviceWorkers: "block",
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() =>
        localStorage.setItem("swarm-front-player-name-v1", "撮影検証"),
      );
      await page.goto("http://127.0.0.1:5398/" + query);
      await page.locator("#solo").click();
      await page.getByRole("button", { name: "確定", exact: true }).click();
      await page.locator("#pt-start").click();
      // Loading screen requires the existing explicit start action.
      await page.waitForTimeout(2500);
      console.log(
        name,
        width,
        (await page.locator("body").innerText()).slice(-1200),
      );
      await page.locator("#pt-enter").click({ timeout: 120000 });
      const skip = page.locator("#pt-tutorial-skip");
      await skip.waitFor({ timeout: 60000 });
      await skip.click();
      await page.waitForTimeout(1500);
      const state = await page.evaluate(() => {
        const style = (id) => {
          const e = document.getElementById(id);
          const s = getComputedStyle(e);
          return {
            hidden: e.hidden,
            visibility: s.visibility,
            opacity: s.opacity,
            display: s.display,
          };
        };
        return {
          hud: style("hud"),
          minimap: style("minimap"),
          fire: style("fire"),
          move: style("move"),
          pause: style("pause"),
          hudText: document.getElementById("hud").textContent,
          flag: document.documentElement.dataset.cleanCapture ?? null,
          controls: localStorage.getItem("swarm-front-controls-v1"),
        };
      });
      assert.equal(state.flag, name === "normal" ? null : "true");
      assert.equal(
        state.hud.visibility,
        name === "normal" ? "visible" : "hidden",
      );
      assert.equal(
        state.minimap.visibility,
        name === "normal" ? "visible" : "hidden",
      );
      assert.ok(state.hudText.includes("WAVE"));
      assert.equal(Number(state.fire.opacity), name === "normal" ? 0.8 : 0);
      assert.equal(state.pause.hidden, false);
      assert.equal(state.pause.visibility, "visible");
      await page.screenshot({ path: `${out}/${width}-${name}.png` });
      await page.locator("#pause").click();
      await page.locator("#pt-resume").waitFor({ state: "visible" });
      await page.screenshot({ path: `${out}/${width}-${name}-pause.png` });
      assert.deepEqual(errors, []);
      results.push({
        width,
        height,
        name,
        ...state,
        errors,
        pauseVerified: true,
      });
      fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
