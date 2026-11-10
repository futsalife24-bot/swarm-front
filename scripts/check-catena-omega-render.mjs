import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/catena-omega";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:5197/scripts/catena-omega-preview.html", {
    timeout: 120000,
  });
  await page.waitForFunction(() => window.__omega, null, { timeout: 120000 });
  const result = await page.evaluate(async () => {
    const { Renderer } = await import("/src/client/render.ts");
    const { omegaPads } = await import("/src/shared/catena-omega.ts");
    const api = window.__omega;
    await api.frame(3.3);
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0";
    document.body.append(canvas);
    const r = new Renderer(canvas);
    const { w, e } = api;
    const end = performance.now() + 120000;
    while (!r.foundryWorms.get(e.id)?.view) {
      r.render(w, "viewer", 1 / 30, 0, 0, undefined, true);
      if (performance.now() > end) throw Error("実Rendererの読込期限");
      await new Promise((r) => setTimeout(r, 40));
    }
    const error = () => {
      const view = r.foundryWorms.get(e.id).view;
      const nodes = [e, ...e.segments];
      return Math.max(
        ...nodes.map((n, i) => {
          const u = view.units[i];
          return Math.hypot(
            u.position.x * view.root.scale.x - n.x,
            u.position.y * view.root.scale.y - n.y,
            u.position.z * view.root.scale.z - n.z,
          );
        }),
      );
    };
    r.render(w, "viewer", 1 / 30, 0, 0, undefined, true);
    const flight = {
      maxCoordinateError: error(),
      pads: r.omegaWarning.mesh.count,
      expectedPads: omegaPads(e, w.time).length,
    };
    await api.frame(4.5);
    r.render(w, "viewer", 1 / 30, 0, 0, undefined, true);
    const landing = {
      maxCoordinateError: error(),
      pads: r.omegaWarning.mesh.count,
      hp: w.players[0].hp,
    };
    const { FoundryWormView, FOUNDRY_WORM_ASSET } =
      await import("/src/client/foundry-worm.ts");
    const views = [
      api.view,
      await FoundryWormView.load(FOUNDRY_WORM_ASSET),
      await FoundryWormView.load(FOUNDRY_WORM_ASSET),
    ];
    const times = [];
    for (let i = 0; i < 90; i++) {
      const at = performance.now();
      for (const v of views) v.update(e, 5 + i / 30);
      times.push(performance.now() - at);
    }
    times.sort((a, b) => a - b);
    return {
      flight,
      landing,
      load: {
        views: 3,
        cpuMedianMs: times[45],
        cpuP95Ms: times[85],
        samples: 90,
      },
      device: "Chrome SwiftShader・PC。実Android/iOS性能ではない",
    };
  });
  assert.ok(result.flight.maxCoordinateError < 0.001);
  assert.ok(result.landing.maxCoordinateError < 0.001);
  assert.equal(result.flight.pads, 15);
  assert.equal(result.landing.pads, 0);
  assert.equal(errors.length, 0);
  await page.screenshot({ path: out + "/production-render-844x390.png" });
  writeFileSync(
    out + "/render-check.json",
    JSON.stringify({ ...result, errors }, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
