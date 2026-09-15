/** Actual training game (Controls -> shared step -> Renderer), never mocked.
 * Before uses the preserved v9 GLB through a local request substitution only.
 * Training is the shipping no-reward mode; loadouts use its normal start message. */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const base =
  process.argv.find((arg) => arg.startsWith("http")) ?? "http://127.0.0.1:5314";
const afterOnly = process.argv.includes("--after-only");
const dir = "dist-validation/trooper-kling";
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const report = afterOnly
  ? JSON.parse(fs.readFileSync(dir + "/game-recording.json", "utf8")).filter(
      (entry) => entry.version === "before",
    )
  : [];
try {
  for (const version of afterOnly ? ["after"] : ["before", "after"])
    for (const kind of ["rifle", "rocket"]) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        recordVideo: { dir: dir + "/raw", size: { width: 1280, height: 720 } },
        serviceWorkers: "block",
      });
      const p = await context.newPage(),
        errors = [],
        stages = [];
      p.on("pageerror", (e) => errors.push(e.message));
      if (version === "before")
        await p.route("**/standard_trooper_v10.glb", (route) =>
          route.fulfill({
            path: "public/assets/characters/standard_trooper_v9.glb",
            contentType: "model/gltf-binary",
          }),
        );
      await p.goto(base + "/?training=1");
      await p.locator("#training-start").waitFor();
      await p.evaluate(async (kind) => {
        const { defaultLayout } = await import("/src/client/layout.ts");
        const { STARTERS } = await import("/src/shared/defs.ts");
        const primary = STARTERS.find((w) => w.kind === kind),
          secondary = STARTERS.find(
            (w) => w.kind === (kind === "rifle" ? "shotgun" : "rifle"),
          );
        window.postMessage(
          {
            type: "training-start",
            layout: defaultLayout(),
            config: {
              weapons: [primary, secondary],
              preferences: { volume: 0 },
            },
          },
          location.origin,
        );
      }, kind);
      await p.locator("#training-start").click();
      await p.evaluate(async () => {
        const { loadStandardTrooper } =
          await import("/src/client/standard-trooper.ts");
        await loadStandardTrooper();
      });
      await p.waitForTimeout(1200);
      // Move alongside the target lane so the fixed target does not obscure the soldier.
      await p.keyboard.down("KeyD");
      await p.waitForTimeout(800);
      await p.keyboard.up("KeyD");
      await p.waitForTimeout(350);
      await p.evaluate(() => {
        window.motionChunks = [];
        window.motionRecorder = new MediaRecorder(
          document.querySelector("#world").captureStream(30),
          { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 4500000 },
        );
        motionRecorder.ondataavailable = (e) => {
          if (e.data.size) motionChunks.push(e.data);
        };
        motionRecorder.start();
      });
      const start = Date.now();
      const shot = async (label) => {
        stages.push({
          label,
          time: (Date.now() - start) / 1000,
          stats: await p.locator("#training-stats").innerText(),
          state: await p.evaluate(() => window.__training),
        });
        await p.screenshot({ path: `${dir}/${version}-${kind}-${label}.jpg` });
      };
      const joystick = async (px, ms) => {
        const box = await p.locator("#move").boundingBox(),
          x = box.x + box.width / 2,
          y = box.y + box.height / 2;
        await p.mouse.move(x, y);
        await p.mouse.down();
        await p.mouse.move(x, y - px, { steps: 4 });
        await p.waitForTimeout(ms);
      };
      const aim = async (ms) => {
        const box = await p.locator("#look").boundingBox();
        await p.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45);
        await p.mouse.down({ button: "right" });
        await p.waitForTimeout(ms);
      };
      await shot("idle");
      await joystick(10.7, 1100);
      await shot("A-walk");
      await p.mouse.up();
      await p.waitForTimeout(350);
      await p.keyboard.down("KeyW");
      await p.waitForTimeout(1000);
      await shot(kind === "rocket" ? "E-run" : "B-run");
      await p.keyboard.up("KeyW");
      await p.waitForTimeout(500);
      if (kind === "rifle") {
        await aim(750);
        await shot("C-AR-aim");
        await p.mouse.up({ button: "right" });
        await p.waitForTimeout(550);
        await shot("C-AR-release");
        await p.keyboard.press("KeyQ");
        await p.waitForTimeout(750);
        await shot("SG-equipped");
        await aim(700);
        await shot("C-SG-aim");
        await p.mouse.up({ button: "right" });
        await p.waitForTimeout(550);
        await shot("C-SG-release");
        await p.keyboard.press("KeyQ");
        await p.waitForTimeout(650);
        await joystick(10.7, 700);
        await p.mouse.up();
        await p.keyboard.down("KeyW");
        await p.waitForTimeout(650);
        await aim(750);
        await shot("D-run-aim");
        await p.keyboard.up("KeyW");
        await p.mouse.up({ button: "right" });
        await p.waitForTimeout(550);
      }
      const ammoBefore = await p.locator("#training-stats").innerText();
      const fire = await p.locator("#fire").boundingBox();
      await p.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
      await p.mouse.down();
      await p.waitForTimeout(180);
      await p.mouse.up();
      await p.waitForTimeout(80);
      await shot("fire");
      const ammoAfter = await p.locator("#training-stats").innerText();
      assert.notEqual(ammoAfter, ammoBefore, "actual weapon must fire");
      await p.keyboard.press("KeyR");
      await p.waitForTimeout(250);
      await shot("reload");
      await p.waitForTimeout(2900);
      const movie = await p.evaluate(
        () =>
          new Promise((resolve) => {
            motionRecorder.onstop = async () =>
              resolve(
                Array.from(
                  new Uint8Array(
                    await new Blob(motionChunks, {
                      type: "video/webm",
                    }).arrayBuffer(),
                  ),
                ),
              );
            motionRecorder.stop();
          }),
      );
      fs.writeFileSync(
        `${dir}/${version}-${kind}-canvas.webm`,
        Buffer.from(movie),
      );
      await p.setViewportSize({ width: 844, height: 390 });
      await p.waitForTimeout(300);
      await shot("mobile-distance");
      assert.deepEqual(errors, []);
      const video = p.video();
      await context.close();
      await video.saveAs(`${dir}/${version}-${kind}-game.webm`);
      report.push({
        version,
        kind,
        stages,
        errors,
        video: `${version}-${kind}-game.webm`,
      });
      fs.writeFileSync(
        dir + "/game-recording.json",
        JSON.stringify(report, null, 2),
      );
      console.log("RECORDED", version, kind);
    }
} finally {
  await browser.close();
}
