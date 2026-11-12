// Local, temporary review: real StandardTrooper with a candidate GL-6 GLB.
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";

const output = "dist-validation/grenade-pose";
const candidate = "design/weapon-models-20261111/out/grenade/grenade_0.glb";
await fs.mkdir(output, { recursive: true });
const bytes = await fs.readFile(candidate);
await fs.writeFile(`${output}/index.html`, `<html lang="ja"><meta charset="utf-8"><body><script type="module" src="./pose.js"></script></body></html>`);
await fs.writeFile(`${output}/pose.js`, `
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { StandardTrooper, loadStandardTrooper, weaponBore } from '../../src/client/standard-trooper.ts';
import { reloadDuration, POSE_OF } from '../../src/shared/defs.ts';
window.probe = (async () => {
  const assets = await loadStandardTrooper();
  const candidate = (await new GLTFLoader().loadAsync('/__grenade_candidate.glb')).scene;
  const bore = weaponBore(candidate);
  const scene = new T.Scene(); scene.add(new T.HemisphereLight(0xffffff, 0x526070, 3));
  const light = new T.DirectionalLight(0xffffff, 3); light.position.set(3, 4, 3); scene.add(light);
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(360, 300); renderer.setClearColor(0x12232d);
  const camera = new T.PerspectiveCamera(35, 360 / 300, .01, 100); camera.zoom = 1.55; camera.updateProjectionMatrix();
  document.body.style.cssText = 'margin:0;background:#12232d;color:white;font:16px sans-serif';
  document.body.innerHTML = '<div style="padding:8px">比較用：GL-6の仮ネオン枠を非表示。ゲームの兵士・動作を使用。</div><main style="display:grid;grid-template-columns:repeat(2,360px);gap:8px;padding:8px" id="images"></main>';
  const records = [];
  let duration;
  for (const [pose, key] of [['ロケット姿勢（現状）', 'rocket'], ['ライフル姿勢（比較）', 'rifle']]) {
    POSE_OF.grenade = key;
    const actor = new StandardTrooper({ ...assets, weapons: { ...assets.weapons, [key]: candidate } });
    scene.add(actor.model);
    const p = { id:'probe', x:0, z:0, y:0, yaw:0, pitch:0, hp:160, slot:0, reload:0, evade:0, swapCd:0, cool:0,
      ammo:[0,7], weapons:[{id:'g',kind:'grenade',rarity:0,power:1,effect:'none'}, {id:'s',kind:'shotgun',rarity:0,power:1,effect:'none'}] };
    duration = reloadDuration(p.weapons[0], p.ammo[0]);
    for (const [label, fraction] of [['手持ち', null], ['装填 中盤', .5]]) {
    p.reload = fraction === null ? 0 : duration * (1 - fraction);
    // A few frames allow the game's transition blend to settle at the chosen state.
    for (let i = 0; i < 4; i++) actor.update(p, 0, 10 + i * .1, 'grenade-probe', .1);
    actor.model.updateMatrixWorld(true);
    actor.weapons[0].traverse(o => { if (o.name === 'WeaponNeonCore' || o.name === 'WeaponNeonHalo') o.visible = false; });
    for (const [view, pos] of [['斜め前', [2.6, 1.9, -3.3]], ['真横', [3.4, 1.8, 0]]]) {
      camera.position.set(...pos); camera.lookAt(0, 1.13, 0); renderer.render(scene, camera);
      const cell = document.createElement('div');
      const title = document.createElement('div'); title.textContent = pose + ' / ' + label + ' / ' + view;
      const image = document.createElement('img'); image.src = renderer.domElement.toDataURL();
      cell.append(title, image); document.querySelector('#images').append(cell);
      records.push({ pose: key, label, view, mode: actor.mode, parent: actor.weapons[0].parent?.name });
    }
    }
    scene.remove(actor.model); actor.dispose();
  }
  renderer.dispose(); renderer.forceContextLoss();
  return { bore: { muzzle: bore.muzzle.toArray(), forward: bore.forward.toArray() }, duration, records };
})();
`);

await build({ entryPoints: [`${output}/pose.js`], bundle: true, format: "esm", platform: "browser",
  define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" }, outfile: `${output}/bundle.js` });
await fs.writeFile(`${output}/index.html`, `<html lang="ja"><meta charset="utf-8"><body><script type="module" src="./bundle.js"></script></body></html>`);
const server = http.createServer(async (req, res) => {
  const name = new URL(req.url, "http://localhost").pathname;
  if (name === "/__grenade_candidate.glb") return void res.writeHead(200, {"Content-Type":"model/gltf-binary"}).end(bytes);
  const base = name.startsWith("/assets/") ? path.resolve("public") : path.resolve(output);
  const relative = name.startsWith("/assets/") ? name.slice(1) : path.basename(name);
  try {
    const data = await fs.readFile(path.join(base, relative));
    res.writeHead(200, { "Content-Type": name.endsWith(".js") ? "text/javascript" : name.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" }).end(data);
  } catch { res.writeHead(404).end(); }
});
let browser;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  console.log("検証サーバー起動");
  const address = server.address();
  browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11"] });
  console.log("検証ブラウザー起動");
  const page = await browser.newPage({ viewport: { width: 1120, height: 1000 }, serviceWorkers: "block" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/index.html`);
  await page.waitForFunction(() => !!window.probe);
  const result = await page.evaluate(() => Promise.race([
    window.probe,
    new Promise((_, reject) => setTimeout(() => reject(Error("兵士・武器の読込が60秒で完了しない")), 60000)),
  ]));
  assert.equal(result.records.length, 8);
  assert.ok(result.records.every((r) => r.parent === "RightHandWeaponSocket"));
  assert.ok(result.records.filter((r) => r.label.includes("装填")).every((r) => r.mode.includes(r.pose === "rocket" ? "Rocket_reload" : "Rifle_reload")));
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${output}/grenade-pose.png`, fullPage: true });
  await fs.writeFile(`${output}/report.json`, JSON.stringify({ candidate, ...result, errors }, null, 2));
  console.log(JSON.stringify({ image: `${output}/grenade-pose.png`, ...result }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
