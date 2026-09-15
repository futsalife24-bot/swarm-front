import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const dir = "dist-validation/combat-effects";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const [width, height] of [
    [1280, 720],
    [844, 390],
  ]) {
    let page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.stack));
    await page.goto("http://127.0.0.1:5311");
    await page.getByRole("button", { name: /ソロで出撃準備/ }).click();
    await page.locator("#launch").click();
    await page.waitForFunction(() => window.__swarm?.world?.players.length);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    await page.screenshot({ path: `${dir}/${width}-play.png` });
    page.removeAllListeners("pageerror");
    await page.close();
    page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", (e) => errors.push(e.stack));
    // Isolated visual fixture uses the actual renderer; does not alter saved game data.
    await page.route("**/effects-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<html><body style='margin:0'></body></html>",
      }),
    );
    await page.goto("http://127.0.0.1:5311/effects-fixture");
    await page.evaluate(async () => {
      const T = await import("/node_modules/.vite/deps/three.js");
      const { CombatEffects } = await import("/src/client/combat-effects.ts");
      document.body.innerHTML = "";
      const r = new T.WebGLRenderer({ antialias: true });
      r.setSize(innerWidth, innerHeight);
      document.body.appendChild(r.domElement);
      const scene = new T.Scene();
      scene.background = new T.Color(0x23323a);
      const cam = new T.PerspectiveCamera(
        55,
        innerWidth / innerHeight,
        0.1,
        100,
      );
      cam.position.set(13, 13, 20);
      cam.lookAt(0, 0, 0);
      scene.add(new T.GridHelper(40, 40, 0x607773, 0x354a4d));
      const fx = new CombatEffects(scene);
      fx.event({ id: 1, type: "burst", x: 3, y: 0.3, z: 0, radius: 6.5 });
      fx.event({ id: 2, type: "acid", x: -6, y: 0, z: 0 });
      fx.event({
        id: 3,
        type: "shot",
        weapon: "rifle",
        x: -6,
        y: 1.5,
        z: 5,
        tx: -6,
        ty: 1.5,
        tz: -20,
      });
      fx.update(0.05, cam);
      r.render(scene, cam);
      window.fixture = { fx, r, scene, cam };
    });
    await page.screenshot({ path: `${dir}/${width}-effects.png` });
    await page.evaluate(() => {
      const { fx, r, scene, cam } = window.fixture;
      fx.update(0.2, cam);
      r.render(scene, cam);
    });
    await page.screenshot({ path: `${dir}/${width}-blast.png` });
    results.push({ width, height, errors });
    await page.close();
  }
  writeFileSync(`${dir}/browser.json`, JSON.stringify(results, null, 2));
  console.log(results);
  if (results.some((r) => r.errors.length)) process.exitCode = 1;
} finally {
  await browser.close();
}
