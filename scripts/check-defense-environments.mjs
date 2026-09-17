import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/defense-environments";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
try {
  const p = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:5197");
  await p.waitForFunction(() => !!window.__playtest);
  await p.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { DefenseVisual } = await import("/src/client/defense-visual.ts");
    const { MapAssets } = await import("/src/client/map-assets.ts");
    const { DEFENSE_MAPS } = await import("/src/shared/stages.ts");
    const canvas = document.createElement("canvas");
    canvas.id = "defense-fixture";
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      zIndex: "999999",
      width: "100%",
      height: "100%",
    });
    document.body.append(canvas);
    const renderer = new T.WebGLRenderer({ canvas });
    renderer.setSize(844, 390);
    window.renderDefenseFixture = async (index, hp) => {
      const map = DEFENSE_MAPS[index],
        scene = new T.Scene();
      scene.background = new T.Color(map.sky);
      scene.add(new T.HemisphereLight(0xffffff, 0x334444, 3));
      const camera = new T.PerspectiveCamera(55, 844 / 390, 0.1, 600);
      camera.position.set(5, 3.5, 7);
      camera.lookAt(0, 1.25, 0);
      const maps = new MapAssets(scene);
      maps.select(index + 7);
      const until = performance.now() + 30000;
      while (maps.status[index + 7].state !== "ready") {
        if (
          maps.status[index + 7].state === "error" ||
          performance.now() > until
        )
          throw Error("Map loading failed");
        await new Promise((r) => setTimeout(r, 50));
      }
      const visual = new DefenseVisual(scene);
      await visual.load();
      scene.updateMatrixWorld(true);
      const ray = new T.Raycaster();
      for (let x = -42; x <= 42; x += 14)
        for (let z = -42; z <= 42; z += 14) {
          ray.set(new T.Vector3(x, 30, z), new T.Vector3(0, -1, 0));
          const hit = ray.intersectObject(maps.groups[index + 7], true)[0];
          if (!hit || Math.abs(hit.point.y) > 0.02)
            throw Error(`Uneven plaza ${index}: ${x},${z}`);
        }
      visual.update(
        {
          run: "visual-fixture",
          phase: "battle",
          defense: { armory: { x: 0, z: 0, hp }, maxHp: 2000 },
        },
        0.05,
      );
      renderer.render(scene, camera);
      return { level: visual.group.userData.damageLevel, biome: map.biome };
    };
  });
  const results = [];
  for (let index = 0; index < 6; index++) {
    const hp = [2000, 1400, 1000, 600, 200, 0][index];
    const result = await p.evaluate(
      ({ index, hp }) => window.renderDefenseFixture(index, hp),
      { index, hp },
    );
    assert.equal(result.level, [5, 4, 3, 2, 1, 0][index]);
    results.push(result);
    await p.screenshot({
      path: `${out}/environment-${index}-level-${result.level}.png`,
    });
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + "/checks.json",
    JSON.stringify({ pass: true, results, errors }, null, 2),
  );
  console.log("SIX ENVIRONMENTS / SIX DAMAGE STATES PASS");
} finally {
  await browser.close();
}
