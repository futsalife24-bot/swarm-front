import { chromium } from "playwright";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { resolve, sep, extname } from "node:path";

const root = resolve("dist");
// Local test only: add an observer to the served bundle in memory. The test uses
// the ordinary input handlers and does not change the built file or game state.
mkdirSync("output/pixelfx-battle", { recursive: true });
const front = readdirSync(resolve(root, "assets")).find((name) =>
  /^front-.*\.js$/.test(name),
);
if (!front) throw new Error("front bundle missing");
const original = readFileSync(resolve(root, "assets", front), "utf8");
const anchor = 'an()&&Object.defineProperty(window,"swarmNetworkDiagnostics"';
if (original.split(anchor).length !== 2)
  throw new Error("read-only observer anchor mismatch");
const observer = `(function(){const hits=[],bursts=[];let muzzleFrames=0;const update=P.combat.update;P.combat.update=function(...args){const result=update.apply(this,args);if(this.items.some(e=>e.kind==="muzzle"&&e.mesh.material.map?.image?.src?.includes("pixelfx-battle")))muzzleFrames++;return result};const original=P.combat.event;P.combat.event=function(e,...args){if(e.type==="hit")hits.push({id:e.id});if(e.type==="burst")bursts.push({id:e.id,frontEffect:e.frontEffect});return original.call(this,e,...args)};Object.defineProperty(window,"__pixelProbe",{value:()=>{if(!I||!P?.camera)return null;const p=I.players.find(p=>p.id===V);if(!p)return null;const targets=I.enemies.filter(e=>e.hp>0).map(e=>{const a=e.pleat?.body?.y??e.y+1;const v=P.camera.position.clone().set(e.x,a,e.z).project(P.camera);return {id:e.id,d:Math.hypot(e.x-p.x,e.z-p.z),sx:v.x,sy:v.y,sz:v.z}}).sort((a,b)=>a.d-b.d);return {time:I.time,hp:p.hp,targets,hits,bursts,muzzleFrames,fx:P.combat.items.filter(e=>e.kind.startsWith("pixel-")).length,arrivals:[...P.spawnEffects.items.values()].map(e=>({id:e.id,teleport:e.teleport,age:e.age,dust:!!e.dust.material.map,stones:!!e.stones.material.map,stamp:!!e.stamp}))}}});})();`;
const instrumented = original.replace(anchor, observer + anchor);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".glb": "model/gltf-binary",
};
const server = createServer((req, res) => {
  const file = resolve(
    root,
    `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`,
  );
  if (!file.startsWith(root + sep) || !existsSync(file))
    return res.writeHead(404).end();
  res.writeHead(200, {
    "Content-Type": mime[extname(file)] || "application/octet-stream",
  });
  if (file === resolve(root, "assets", front)) return res.end(instrumented);
  createReadStream(file).pipe(res);
});
await new Promise((ok, fail) =>
  server.listen(0, "127.0.0.1", ok).on("error", fail),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = function () {};
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${server.address().port}/front.html?solo=1`,
    { waitUntil: "domcontentloaded" },
  );
  if (await page.getByRole("button", { name: "SWARM FRONT はじめる" }).count())
    await page.getByRole("button", { name: "SWARM FRONT はじめる" }).click();
  try {
    const rocket = page.locator('[data-weapon="rocket"]').first();
    if (await rocket.count()) await rocket.click();
    await page.getByRole("button", { name: "ソロ出撃 ↗", exact: true }).click();
  } catch (e) {
    console.log(
      "画面:",
      (await page.locator("body").innerText()).slice(0, 1200),
      "例外:",
      errors,
    );
    throw e;
  }
  await page.locator(".rebuild-card").first().click({ timeout: 120000 });
  await page.locator("#controls").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(
    () => typeof window.__pixelProbe === "function" && window.__pixelProbe(),
    null,
    { timeout: 30000 },
  );
  const results = {
    samples: [],
    hits: [],
    bursts: [],
    arrivals: [],
    visibleFx: 0,
    muzzleFrames: 0,
    errors,
  };
  const start = Date.now();
  let fired = false;
  while (Date.now() - start < 90000) {
    const state = await page.evaluate(() => window.__pixelProbe());
    if (!state || state.hp <= 0) break;
    for (const hit of state.hits)
      if (!results.hits.some((h) => h.id === hit.id)) results.hits.push(hit);
    results.muzzleFrames = state.muzzleFrames;
    for (const b of state.bursts)
      if (!results.bursts.some((x) => x.id === b.id)) results.bursts.push(b);
    for (const a of state.arrivals)
      if (!results.arrivals.some((x) => x.id === a.id))
        results.arrivals.push(a);
    if (state.fx > 0) {
      results.visibleFx++;
      if (results.visibleFx === 1)
        await page.screenshot({
          path: "output/pixelfx-battle/live-frame.png",
        });
    }
    const target =
      state.targets.find((e) => e.d < 40 && e.sz < 1) ?? state.targets[0];
    if (target) {
      const sx = Math.max(-3, Math.min(3, target.sx));
      const sy = Math.max(-3, Math.min(3, target.sy));
      const dx = Math.max(
        -250,
        Math.min(
          250,
          Math.atan(((sx * 844) / 390) * Math.tan((38 * Math.PI) / 360)) /
            0.003,
        ),
      );
      const dy = Math.max(
        -180,
        Math.min(180, -Math.atan(sy * Math.tan((38 * Math.PI) / 360)) / 0.0025),
      );
      await page.evaluate(
        ({ dx, dy, fire }) => {
          window.dispatchEvent(
            new PointerEvent("pointermove", {
              pointerType: "mouse",
              buttons: fire ? 2 : 3,
              movementX: dx,
              movementY: dy,
            }),
          );
          const canvas = document.querySelector("#world");
          if (fire)
            canvas.dispatchEvent(
              new PointerEvent("pointerdown", {
                bubbles: true,
                pointerType: "mouse",
                button: 0,
                buttons: 1,
              }),
            );
        },
        { dx, dy, fire: !fired },
      );
      fired = true;
      if (results.samples.length < 20)
        results.samples.push({
          time: state.time,
          d: target.d,
          sx: target.sx,
          sy: target.sy,
          fx: state.fx,
        });
    }
    if (results.bursts.length && results.visibleFx && results.arrivals.some(a => a.stamp) && results.muzzleFrames)
      break;
    await page.waitForTimeout(120);
  }
  writeFileSync(
    "output/pixelfx-battle/live-result.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify({
      hits: results.hits.length,
      bursts: results.bursts.length,
      arrivals: results.arrivals.length,
      visibleFx: results.visibleFx,
      muzzleFrames: results.muzzleFrames,
      errors: results.errors,
    }),
  );
  if (
    !results.bursts.length ||
    !results.visibleFx ||
    !results.arrivals.some(a => a.stamp) ||
    !results.muzzleFrames ||
    errors.length
  )
    throw Error("実戦の爆風と出現演出を確認できませんでした");
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((ok) => server.close(ok));
}
