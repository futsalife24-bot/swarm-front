import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const dir = "dist-validation/weapon-glow";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.route("**/outline-check", (r) =>
    r.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }),
  );
  await page.goto("http://127.0.0.1:5347/outline-check");
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
    renderer.setSize(460, 320);
    renderer.setClearColor(0x14242c);
    const camera = new T.PerspectiveCamera(35, 460 / 320, 0.01, 100),
      scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xffffff, 0x526070, 3));
    function seams(g) {
      const p = g.getAttribute("position"),
        n = g.getAttribute("normal"),
        seen = new Map();
      let gaps = 0,
        duplicates = 0;
      for (let i = 0; i < p.count; i++) {
        const key = [p.getX(i), p.getY(i), p.getZ(i)].join(",");
        const v = new T.Vector3().fromBufferAttribute(n, i);
        if (seen.has(key)) {
          duplicates++;
          if (v.distanceTo(seen.get(key)) > 1e-6) gaps++;
        } else seen.set(key, v);
      }
      return { gaps, duplicates };
    }
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
        glow.update(1);
        const shells = [];
        root.traverse((o) => {
          if (o.name === "WeaponRarityGlow") shells.push(o);
        });
        const row = {
          kind,
          grade,
          before: originals.reduce((n, o) => n + seams(o.geometry).gaps, 0),
          after: shells.reduce((n, o) => n + seams(o.geometry).gaps, 0),
          duplicates: shells.reduce(
            (n, o) => n + seams(o.geometry).duplicates,
            0,
          ),
          owned: shells.every((o) => o.geometry !== o.parent.geometry),
          unchanged: originals.every((o) =>
            o.normal.every(
              (v, i) => v === o.geometry.attributes.normal.array[i],
            ),
          ),
          views: [],
          disposed: 0,
          originalDisposed: 0,
        };
        for (const shell of shells)
          shell.geometry.addEventListener("dispose", () => row.disposed++);
        for (const o of originals)
          o.geometry.addEventListener("dispose", () => row.originalDisposed++);
        if (grade === 0) {
          for (const [angle, position] of [
            ["audit", [2.3, 0.55, 0.45]],
            ["opposite", [-2.3, 0.55, -0.45]],
            ["front", [0.35, 0.3, -2.3]],
          ]) {
            camera.position.set(...position);
            camera.lookAt(0, -0.03, -0.13);
            for (const variant of ["before", "after"]) {
              const owned = shells.map((o) => o.geometry);
              if (variant === "before")
                shells.forEach((o) => (o.geometry = o.parent.geometry));
              renderer.render(scene, camera);
              const url = renderer.domElement.toDataURL();
              shells.forEach((o, i) => (o.geometry = owned[i]));
              const host = document.createElement("div");
              host.innerHTML = `<b>${kind} ${angle} ${variant}</b><img style="display:block" src="${url}">`;
              document.querySelector("#evidence").append(host);
              row.views.push({ angle, variant, pixels: url });
            }
          }
        }
        glow.dispose();
        row.expectedDisposed = shells.length;
        root.removeFromParent();
        rows.push(row);
      }
    renderer.dispose();
    return rows;
  });
  for (const r of results) {
    assert.ok(r.before > 0);
    assert.equal(r.after, 0);
    assert.ok(r.duplicates > 0 && r.owned && r.unchanged);
    assert.equal(r.disposed, r.expectedDisposed);
    assert.equal(r.originalDisposed, 0);
    for (let i = 0; i < r.views.length; i += 2)
      assert.notEqual(r.views[i].pixels, r.views[i + 1].pixels);
    r.views = r.views.map(({ pixels, ...rest }) => rest);
  }
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: `dir`.replace("dir", dir) + "/outline-regression.png",
    fullPage: true,
  });
  fs.writeFileSync(
    `${dir}/outline-regression.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(
    "PASS all 15 GLBs: original hard-normal seams reproduced; fixed seam gaps 0, originals untouched, all owned geometries disposed; 9 fixed multiangle before/after renders",
  );
} finally {
  await browser.close();
}
