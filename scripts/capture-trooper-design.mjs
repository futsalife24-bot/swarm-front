import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const label = process.argv[2] ?? "after";
const dir = `dist-validation/trooper-design/${label}`;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 700, height: 760 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto("http://127.0.0.1:5314/assets/blender/preview-trooper/");
  await page.waitForFunction(() => window.trooperQA);
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 10000),
  );
  const stats = [];
  for (const kind of ["rifle", "shotgun", "rocket"]) {
    for (const view of ["front", "back", "oblique", "game"]) {
      const result = await page.evaluate(
        ({ kind, view }) => {
          const q = window.trooperQA;
          document.querySelector("aside").style.display = "none";
          q.weapon(kind);
          if (view === "game") {
            q.camera.position.set(1.3, 2.9, 5.3);
            q.camera.lookAt(0, 0.96, 0);
          } else q.view(view);
          q.set(
            "Weapon_Idle_" +
              { rifle: "Rifle", shotgun: "Shotgun", rocket: "Rocket" }[kind],
            0,
          );
          const v = q.camera.position.clone();
          const positions = Object.fromEntries(
            [
              "Pelvis",
              "Foot_L",
              "Foot_R",
              "LowerLeg_L",
              "LowerLeg_R",
              "Hand_L",
              "Hand_R",
            ].map((n) => [
              n,
              q.trooper.model.getObjectByName(n).getWorldPosition(v).toArray(),
            ]),
          );
          return { kind, view, ...q.stats(), positions };
        },
        { kind, view },
      );
      stats.push(result);
      await page.screenshot({ path: `${dir}/${kind}-${view}.png` });
    }
  }
  writeFileSync(
    `${dir}/stats.json`,
    JSON.stringify({ stats, errors }, null, 2),
  );
  console.log(JSON.stringify({ label, errors, stats: stats[0] }, null, 2));
} finally {
  await browser.close();
}
