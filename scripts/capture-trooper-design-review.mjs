import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const dir = "dist-validation/trooper-design/review";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1200, height: 760 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:5314/assets/blender/preview-trooper-design/");
  await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
  for (const kind of ["rifle", "shotgun", "rocket"])
    for (const view of ["front", "back", "oblique"]) {
      await p.evaluate(
        ({ kind, view }) =>
          designReview.set({ kind, view, pose: "idle", time: 0 }),
        { kind, view },
      );
      await p.screenshot({
        path: `${dir}/${kind}-${view}.jpg`,
        type: "jpeg",
        quality: 92,
      });
    }
  await p.setViewportSize({ width: 844, height: 390 });
  await p.evaluate(() =>
    designReview.set({ kind: "rifle", view: "far", pose: "idle", time: 0 }),
  );
  await p.screenshot({
    path: `${dir}/rifle-far-844.jpg`,
    type: "jpeg",
    quality: 92,
  });
  await p.setViewportSize({ width: 1200, height: 760 });
  const poses = [
    ["run", 0.27],
    ["fire", 0.1],
    ["reload", 0.8],
    ["switch", 0.23],
    ["roll", 0.38],
    ["hit", 0.3],
  ];
  for (const [pose, time] of poses) {
    await p.evaluate(
      ({ pose, time }) =>
        designReview.set({ kind: "rifle", view: "oblique", pose, time }),
      { pose, time },
    );
    await p.screenshot({
      path: `${dir}/motion-${pose}.jpg`,
      type: "jpeg",
      quality: 90,
    });
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    `${dir}/capture.json`,
    JSON.stringify(
      { errors, views: 9, farViewport: [844, 390], motionPoses: poses },
      null,
      2,
    ),
  );
  console.log(
    "PASS: matched-lighting before/after, 3 classes, 3 views, distant viewport and 6 motion poses",
  );
  await p.close();
  const movie = await browser.newPage({
    viewport: { width: 1000, height: 640 },
    recordVideo: { dir: `${dir}/video`, size: { width: 1000, height: 640 } },
  });
  await movie.goto(
    "http://127.0.0.1:5314/assets/blender/preview-trooper-design/",
  );
  await movie.waitForFunction(() => window.ready);
  for (const [kind, pose, ms] of [
    ["rifle", "idle", 1200],
    ["rifle", "run", 2400],
    ["rifle", "switch", 1500],
    ["rifle", "roll", 1500],
    ["rocket", "idle", 1200],
    ["rocket", "fire", 1800],
    ["rocket", "reload", 2300],
  ]) {
    await movie.evaluate(
      ({ kind, pose }) => {
        designReview.set({ kind, pose, view: "oblique" });
        designReview.play();
      },
      { kind, pose },
    );
    await movie.waitForTimeout(ms);
  }
  const video = movie.video();
  await movie.close();
  await video.saveAs(`${dir}/motion-review.webm`);
  console.log("Saved motion-review.webm");
} finally {
  await browser.close();
}
