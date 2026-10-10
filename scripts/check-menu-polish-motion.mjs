// Real-time motion evidence: never pause/seek animations or fabricate success.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const out = "dist-validation/menu-polish-motion";
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
  ].filter(
    ([w]) =>
      !process.env.MOTION_WIDTH || String(w) === process.env.MOTION_WIDTH,
  )) {
    for (const reducedMotion of ["no-preference", "reduce"].filter(
      (r) => !process.env.MOTION_REDUCED || r === process.env.MOTION_REDUCED,
    )) {
      const label = `${width}-${reducedMotion}`;
      const p = await browser.newPage({
        viewport: { width, height },
        reducedMotion,
        serviceWorkers: "block",
      });
      // Use the installed ffmpeg when Playwright's optional download is unavailable.
      // Capture Chrome's real rendered frames; do not change animation time.
      const recorder = spawn(
        "ffmpeg",
        [
          "-y",
          "-loglevel",
          "error",
          "-f",
          "image2pipe",
          "-framerate",
          "20",
          "-i",
          "pipe:0",
          "-an",
          "-vf",
          "pad=ceil(iw/2)*2:ceil(ih/2)*2",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          `${out}/${label}.mp4`,
        ],
        { windowsHide: true },
      );
      let recorderError = "";
      recorder.stderr.on("data", (b) => {
        recorderError += b;
      });
      const recorded = new Promise((resolve, reject) => {
        recorder.on("error", reject);
        recorder.on("exit", (code) =>
          code === 0 ? resolve() : reject(Error(recorderError)),
        );
      });
      recorded.catch(() => {}); // Preserve the original page error if recording received no frames.
      const cdp = await p.context().newCDPSession(p);
      let previousFrame,
        previousTimestamp,
        framesWritten = 0;
      const frameTimes = [];
      cdp.on("Page.screencastFrame", async (event) => {
        const frame = Buffer.from(event.data, "base64");
        const timestamp = event.metadata.timestamp;
        frameTimes.push(timestamp);
        if (previousFrame) {
          const copies = Math.max(
            0,
            Math.round((timestamp - frameTimes[0]) * 20) - framesWritten,
          );
          for (let i = 0; i < copies; i++) recorder.stdin.write(previousFrame);
          framesWritten += copies;
        }
        previousFrame = frame;
        previousTimestamp = timestamp;
        await cdp.send("Page.screencastFrameAck", {
          sessionId: event.sessionId,
        });
      });
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto("http://127.0.0.1:5347");
      await p.locator("#solo").waitFor();
      await p.evaluate(async () => {
        const m = await import("/src/client/progression-save.ts");
        const s = m.freshProgress("normal");
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
          id: `motion-${i}`,
          kind: "pickup",
          rarity: 1,
          locked: false,
          testData: false,
        }));
        localStorage.setItem(m.newSaveKey("normal"), JSON.stringify(s));
        localStorage.setItem("swarm-front-player-name-v1", "演出検証");
      });
      await p.reload();
      await p.bringToFront();
      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 80,
        maxWidth: width,
        maxHeight: height,
        everyNthFrame: 1,
      });
      const scenes = [];
      const scene = async (name, action, duration = 1300) => {
        await p.evaluate(
          ({ name, duration }) => {
          const started = performance.now();
          window.motionSamples = [];
          window.motionSampling = true;
            const sample = () => {
              const now = performance.now();
              window.motionSamples.push({
                ms: Math.round(now - started),
                overflow: document.documentElement.scrollWidth > innerWidth,
                nodes: [
                  ...document.querySelectorAll(
                    ".title-motion-accent,.menu-fx-layer:not(.menu-fx-terrain),.radar-fx-settle,.media-playing-light:not([hidden])",
                  ),
                ].map((e) => {
                  const r = e.getBoundingClientRect();
                  return {
                    kind: e.className.baseVal ?? e.className,
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height,
                    opacity: getComputedStyle(e).opacity,
                  };
                }),
                animations: document
                  .getAnimations()
                  .filter(
                    (a) =>
                      a.playState === "running" &&
                      a.effect?.target?.closest?.(
                        ".title-motion-accent,.menu-fx-layer,.radar-fx-settle,.media-playing-light",
                      ),
                  )
                  .map((a) => ({
                    time: a.currentTime,
                    duration: a.effect.getTiming().duration,
                    target: a.effect.target.tagName,
                    transform: getComputedStyle(a.effect.target).transform,
                  })),
              });
            if (window.motionSampling) requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
          },
          { name, duration },
        );
        const videoTime = await p.evaluate(() => performance.now());
        await action();
        await p.waitForTimeout(120);
        await p.screenshot({path:`${out}/${label}-${name}.png`});
        await p.waitForTimeout(duration + 100);
        const samples = await p.evaluate(() => {
          window.motionSampling = false;
          return window.motionSamples;
        });
        assert.ok(samples.length > 4, name + " real frames");
        assert.ok(
          samples.every((s) => !s.overflow),
          name + " no document overflow",
        );
        if (reducedMotion === "reduce")
          assert.ok(
            samples.every((s) => s.animations.length === 0),
            name + " reduced animations",
          );
        scenes.push({ name, videoTime, samples });
        console.log(label + " " + name + " " + samples.length + " frames");
      };
      await scene("title", () => p.locator("#solo").click());
      await scene("equip", () =>
        p.locator('[data-row="v2-starter-rocket"] [data-detail]').click(),
      );
      await p.locator("#pt-base").click();
      await p.locator("#pt-base-accessories").click();
      await scene("craft", () => p.locator("#pt-target-craft").click());
      await p.locator("#pt-synthesis").click();
      await scene("synthesis", () => p.locator("#pt-confirm").click());
      await p.locator("#pt-base").click();
      await p.locator("#pt-base-growth").click();
      await p.locator(".radar-hp").click();
      await p
        .locator('[data-growth-skill="hp"][data-growth-level="2"]')
        .click();
      await p.locator("#pt-allocate").click();
      await scene("growth", () => p.locator("#pt-confirm").click());
      await p.locator("#pt-home").click();
      await scene(
        "report",
        async () => {
          await p.locator("#open-bestiary").click();
          await p
            .locator('.enemy-viewport[data-asset="ready"]')
            .waitFor({ timeout: 45000 });
        },
        2200,
      );
      await p.locator("#report-close").click();
      await p.locator("#home-settings").click();
      await scene("save-check", () =>
        p.locator('[data-preference="volume"]').fill("0.5"),
      );
      await p.locator("[data-sound-test]").click();
      await p.waitForFunction(
        () =>
          document.querySelector(".media-dialog audio").src.startsWith("blob:"),
        {},
        { timeout: 60000 },
      );
      await scene("meter", () => p.locator("[data-play]").click(), 2300);
      const meter = await p.evaluate(() => ({
        paused: document.querySelector(".media-dialog audio").paused,
        hidden: document.querySelector(".media-playing-light").hidden,
        bars: document.querySelectorAll(".media-playing-light i").length,
      }));
      assert.deepEqual(meter, { paused: false, hidden: false, bars: 3 });
      await p.locator("[data-pause]").click();
      await p.waitForFunction(
        () => document.querySelector(".media-playing-light").hidden,
      );
      assert.equal(
        await p.locator(".media-playing-light").evaluate((e) => e.hidden),
        true,
      );
      await p.locator(".media-dialog .dialog-close").click();
      await p.locator(".media-dialog").waitFor({ state: "detached" });
      await p.locator("dialog[open] .dialog-close").click();
      await p.goto("http://127.0.0.1:5347/front");
      await p.locator("#home-tutorial").waitFor();
      await scene("front-guide", () => p.locator("#home-tutorial").click());
      assert.deepEqual(errors, []);
      await cdp.send("Page.stopScreencast");
      if (previousFrame) recorder.stdin.write(previousFrame);
      recorder.stdin.end();
      await recorded;
      await p.close();
      const result = {
        width,
        height,
        reducedMotion,
        errors,
        meter,
        scenes,
        frameTimes,
        framesWritten,
        video: `${label}.mp4`,
      };
      fs.writeFileSync(`${out}/${label}.json`, JSON.stringify(result));
      results.push({
        width,
        height,
        reducedMotion,
        errors,
        scenes: scenes.map((s) => ({
          name: s.name,
          frames: s.samples.length,
          maxAnimations: Math.max(...s.samples.map((f) => f.animations.length)),
        })),
        video: result.video,
      });
    }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(
  `${out}/result${process.env.MOTION_WIDTH || ""}.json`,
  JSON.stringify(results, null, 2),
);
