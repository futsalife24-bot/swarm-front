import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const dir = "dist-validation/weapon-glow";
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 920 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.route("**/glow-check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body></body></html>",
    }),
  );
  await page.goto("http://127.0.0.1:5419/glow-check");
  const result = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { StandardTrooper, loadStandardTrooper } =
      await import("/src/client/standard-trooper.ts");
    const { loadProgressionWeapons } =
      await import("/src/client/progression-weapons.ts");
    const { makeWeapon } = await import("/src/shared/progression.ts");
    const { createWorld, addPlayer } = await import("/src/shared/game.ts");
    const v = new StandardTrooper(await loadStandardTrooper()),
      p = addPlayer(createWorld("glow"), "glow");
    const scene = new T.Scene();
    scene.add(v.model, new T.HemisphereLight(0xffffff, 0x526070, 3));
    const renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(260, 380);
    renderer.setClearColor(0x12232d);
    const camera = new T.PerspectiveCamera(35, 260 / 380, 0.01, 100);
    camera.position.set(2.8, 1.8, 3.3);
    camera.lookAt(0, 1, 0);
    document.body.innerHTML =
      '<main style="display:flex;flex-wrap:wrap;gap:10px;color:white;background:#12232d" id="evidence"></main>';
    const records = [];
    const colors = ["92aaa6", "83d8b0", "7cbdf4", "d5a4f4", "ffd472"];
    for (const kind of ["rifle", "shotgun", "rocket"])
      for (let grade = 0; grade < 5; grade++) {
        p.weapons = [
          makeWeapon(
            "hand",
            kind,
            grade,
            { power: 0, reload: 0, range: 0, rate: 0 },
            true,
            0,
          ),
          makeWeapon(
            "back",
            "rifle",
            (grade + 2) % 5,
            { power: 0, reload: 0, range: 0, rate: 0 },
            true,
            0,
          ),
        ];
        await loadProgressionWeapons(p.weapons);
        v.update(p, 0, 1, "glow", 0);
        const shells = v.weapons.map((w) => {
          const a = [];
          w.traverse((o) => {
            if (o.name === "WeaponNeonCore") a.push(o);
          });
          return a;
        });
        const bright = shells.map(
          (a) =>
            a[0].material.color.r +
            a[0].material.color.g +
            a[0].material.color.b,
        );
        renderer.render(scene, camera);
        const pixels = renderer.domElement.toDataURL();
        v.update(p, 0, 3, "glow", 0);
        renderer.render(scene, camera);
        const dim = renderer.domElement.toDataURL();
        records.push({
          kind,
          grade,
          counts: shells.map((a) => a.length),
          colors: v.weaponGlows.map((glow) => glow.color.getHexString()),
          bright,
          dim: shells.map(
            (a) =>
              a[0].material.color.r +
              a[0].material.color.g +
              a[0].material.color.b,
          ),
          changed: pixels !== dim,
          parents: v.weapons.map((w) => w.parent.name),
          calls: renderer.info.render.calls,
        });
        if (kind === "rifle")
          for (const [label, url] of [
            ["bright", pixels],
            ["dim", dim],
          ]) {
            const el = document.createElement("div");
            el.innerHTML = `<b>${["N", "R", "SR", "SSR", "LR"][grade]} ${label}</b><img style="display:block" src="${url}">`;
            document.querySelector("#evidence").append(el);
          }
      }
    p.slot = 1;
    v.sampleSwitch(0, 0.5);
    const swapped = v.weapons.map((w) => w.parent.name);
    const geometry = v.weapons[0].children[0];
    let disposed = 0;
    v.weaponGlows[0].core.addEventListener("dispose", () => disposed++);
    v.dispose();
    renderer.dispose();
    return { records, swapped, disposed, colors };
  });
  for (const r of result.records) {
    assert.ok(r.counts.every((n) => n > 0));
    assert.equal(r.colors[0], result.colors[r.grade]);
    assert.equal(r.colors[1], result.colors[(r.grade + 2) % 5]);
    assert.ok(r.bright.every((n, i) => n > r.dim[i]));
    assert.ok(r.changed);
    assert.deepEqual(r.parents, [
      "RightHandWeaponSocket",
      "BackWeaponSocket_2",
    ]);
  }
  assert.deepEqual(result.swapped, [
    "BackWeaponSocket",
    "RightHandWeaponSocket",
  ]);
  assert.equal(result.disposed, 1);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${dir}/rarity-pulse.png`, fullPage: true });
  fs.writeFileSync(
    `${dir}/validation.json`,
    JSON.stringify({ ...result, errors }, null, 2),
  );
  console.log(
    "PASS 15 kind/grade combinations, both independent slots, pulse pixels, swap, disposal; max calls",
    Math.max(...result.records.map((r) => r.calls)),
  );
} finally {
  await browser.close();
}
