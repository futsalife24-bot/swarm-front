import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const dir = "dist-validation/weapon-neon";
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({ viewport: { width: 1380, height: 1020 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.route("**/neon-check", (r) =>
    r.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }),
  );
  await page.goto("http://127.0.0.1:5419/neon-check");
  const results = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { GLTFLoader } =
      await import("/node_modules/three/examples/jsm/loaders/GLTFLoader.js");
    const { WeaponRarityGlow } =
      await import("/src/client/weapon-rarity-glow.ts");
    const { makeWeapon } = await import("/src/shared/progression.ts");
    const loader = new GLTFLoader(),
      rows = [];
    document.body.innerHTML =
      '<main style="display:flex;flex-wrap:wrap;background:#111;color:white" id="evidence"></main>';
    const renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(450, 320);
    renderer.setClearColor(0x14242c);
    const camera = new T.PerspectiveCamera(35, 450 / 320, 0.01, 100),
      scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xffffff, 0x526070, 3));
    for (const kind of ["rifle", "shotgun", "rocket"])
      for (let grade = 0; grade < 5; grade++) {
        const root = (
          await loader.loadAsync(
            `/assets/weapons/realism-v2/${kind}_${grade}.glb`,
          )
        ).scene;
        scene.add(root);
        const originals = [];
        root.traverse((o) => {
          if (o.isMesh)
            originals.push({
              mesh: o,
              normal: Array.from(o.geometry.attributes.normal.array),
              geometry: o.geometry,
            });
        });
        const start = performance.now();
        const glow = new WeaponRarityGlow(
          root,
          makeWeapon(
            "check",
            kind,
            grade,
            { power: 0, reload: 0, range: 0, rate: 0 },
            true,
            0,
          ),
        );
        const creationMs = performance.now() - start;
        glow.update(1);
        const lines = root.children.filter((o) =>
          o.name.startsWith("WeaponNeon"),
        );
        const row = {
          kind,
          grade,
          creationMs,
          lines: lines.length,
          finite: lines.every((o) =>
            Array.from(o.geometry.attributes.position.array).every(
              Number.isFinite,
            ),
          ),
          unchanged: originals.every((o) =>
            o.normal.every(
              (v, i) => v === o.geometry.attributes.normal.array[i],
            ),
          ),
          disposed: 0,
          materialDisposed: 0,
          originalDisposed: 0,
          additive: lines.some(
            (o) => o.material.blending === T.AdditiveBlending,
          ),
          closed: true,
          views: [],
        };
        for (const line of lines) {
          line.geometry.addEventListener("dispose", () => row.disposed++);
          line.material.addEventListener(
            "dispose",
            () => row.materialDisposed++,
          );
          const pos = line.geometry.attributes.position;
          const half = pos.count / 2;
          for (let side = 0; side < 2; side++)
            for (let j = 0; j < 9; j++) {
              const first = new T.Vector3().fromBufferAttribute(
                  pos,
                  side * half + j,
                ),
                last = new T.Vector3().fromBufferAttribute(
                  pos,
                  (side + 1) * half - 9 + j,
                );
              if (first.distanceTo(last) > 1e-6) row.closed = false;
            }
        }
        for (const o of originals)
          o.geometry.addEventListener("dispose", () => row.originalDisposed++);
        if (grade === 2)
          for (const [angle, position] of [
            ["side", [2.3, 0.55, 0.45]],
            ["opposite", [-2.3, 0.55, -0.45]],
            ["front", [0.35, 0.3, -2.3]],
          ]) {
            camera.position.set(...position);
            camera.lookAt(0, -0.03, -0.13);
            renderer.render(scene, camera);
            const url = renderer.domElement.toDataURL();
            const host = document.createElement("div");
            host.innerHTML = `<b>${kind} ${angle}</b><img style="display:block" src="${url}">`;
            document.querySelector("#evidence").append(host);
            row.views.push(angle);
          }
        glow.dispose();
        root.removeFromParent();
        rows.push(row);
      }
    renderer.dispose();
    return rows;
  });
  for (const r of results) {
    assert.equal(r.lines, 2);
    assert.ok(r.closed && r.finite && r.unchanged);
    assert.equal(r.additive, false);
    assert.equal(r.disposed, 2);
    assert.equal(r.materialDisposed, 2);
    assert.equal(r.originalDisposed, 0);
  }
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${dir}/neon-angles.png`, fullPage: true });
  fs.writeFileSync(
    `${dir}/validation.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(
    "PASS 15 models: two closed non-additive neon layers, finite geometry, originals untouched, geometry/material disposal; 9 views; max generation ms",
    Math.max(...results.map((r) => r.creationMs)),
  );
} finally {
  await browser.close();
}
