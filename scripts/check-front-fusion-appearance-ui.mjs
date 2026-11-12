// Disposable save, real local defense UI and renderer; no product files change.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const out = "dist-validation/fusion-ui-visual-probe";
await fs.mkdir(out, { recursive: true });
const source = `import {freshProgress,newSaveKey,validateProgress} from './src/client/progression-save.ts';
import {makeWeapon} from './src/shared/progression.ts';
import {emptyFrontProgress,FRONT_PROGRESS_KEY} from './src/client/front-progress.ts';
export const key=newSaveKey('normal'),frontKey=FRONT_PROGRESS_KEY;
export function fixture(tier){const s=freshProgress('normal');s.armoryMigration=1;
 const w=makeWeapon('visual-slug-'+tier,'slug',tier,{power:0,reload:0,range:0,rate:0},false,s.serial++);
 s.inventory.push(w);s.soldiers[0].equipped[0]=w.id;
 return {raw:JSON.stringify(validateProgress(s)),front:JSON.stringify({...emptyFrontProgress(),runs:1,wins:1,credits:100,unlocks:[...emptyFrontProgress().unlocks,'fuse']})};}`;
await build({
  stdin: {
    contents: source,
    resolveDir: process.cwd(),
    sourcefile: "fusion-ui-fixture.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: out + "/fixture.mjs",
  define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
});
const fixture =
  await import("../dist-validation/fusion-ui-visual-probe/fixture.mjs");
const server = await createServer({
  configFile: false,
  define: {
    __SWARM_BUILD__: JSON.stringify("local-fusion-review"),
    __AUTO_CHANGELOG__: JSON.stringify([]),
  },
  server: {
    host: "127.0.0.1",
    port: 0,
    hmr: false,
    watch: {
      ignored: ["**/dist-validation/**", "**/design/**", "**/public/**"],
    },
  },
  optimizeDeps: { noDiscovery: true, include: [] },
});
let browser,
  context,
  page,
  stage = "start";
const records = [];
try {
  await server.listen();
  const origin = "http://127.0.0.1:" + server.httpServer.address().port;
  browser = await chromium.launch({
    channel: "chrome",
    args: ["--use-angle=d3d11"],
  });
  for (const tier of [0, 4]) {
    stage = `tier ${tier} start`;
    const errors = [],
      requests = [],
      failed = [];
    context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      serviceWorkers: "block",
    });
    page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("PAGEERROR", e.message);
    });
    page.on("request", (r) => {
      if (r.url().includes("/assets/weapons/")) requests.push(r.url());
    });
    page.on("requestfailed", (r) => {
      if (r.url().includes("/assets/weapons/"))
        failed.push({ url: r.url(), error: r.failure()?.errorText });
    });
    await page.addInitScript(
      ({ key, frontKey, raw, front }) => {
        localStorage.setItem(key, raw);
        localStorage.setItem(frontKey, front);
      },
      {
        key: fixture.key,
        frontKey: fixture.frontKey,
        ...fixture.fixture(tier),
      },
    );
    await page.route(
      /\/src\/client\/front-app\.ts(?:\?.*)?$/,
      async (route) => {
        const response = await route.fetch(),
          body = await response.text();
        await route.fulfill({
          response,
          body:
            body +
            `
window.__fusionVisualRead=()=>{
 const p=world?.players?.find(x=>x.id===id),t=view.players.get(id)?.userData?.trooper,w=p?.weapons?.[0],root=t?.weapons?.[0];
 const mat=[],neon=[],nodes=[];
 root?.traverse(o=>{const ms=Array.isArray(o.material)?o.material:[o.material];
  if(o.name?.includes('Weapon_slug'))nodes.push(o.name);
  for(const m of ms){if(m?.name?.startsWith('Rarity identification'))mat.push({name:m.name,color:m.color?.getHexString()});
   if(o.name==='WeaponNeonHalo')neon.push({name:o.name,color:m?.color?.getHexString()});}});
 return {screen,mode,ready,phase:info?.phase,picks:info?.picks,playerSlot:p?.slot,weapon:w?structuredClone(w):null,
  actor:root?{name:root.name,nodes,uuid:root.uuid,selectedSlot:t.selectedSlot,parent:root.parent?.name,material:mat,neon,keys:t.weaponIds}:null};
};
window.__fusionVisualCanvas=()=>{const drawn=view.render(world,id,.1,controls.input.yaw,controls.input.pitch,undefined,false);if(!drawn)throw Error('撮影用描画がスキップされた');return view.renderer.domElement.toDataURL('image/png')};`,
        });
      },
    );
    await page.goto(origin + "/front.html?solo=1", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    const title = page.locator(".title-entry-start");
    if (await title.isVisible().catch(() => false)) await title.click();
    // The app's existing solo=1 route opens the usual preparation screen.
    stage = `tier ${tier} defense preparation`;
    await page
      .locator("#front-mode")
      .selectOption("defense", { timeout: 12000 });
    await page.locator(`[data-front-slot="0"]`).waitFor();
    assert.match(
      await page.locator(`[data-front-slot="0"]`).innerText(),
      /SG-7/,
    );
    await page.locator("#front-launch").click();
    stage = `tier ${tier} before`;
    await page
      .locator("[data-card]")
      .first()
      .waitFor({ state: "visible", timeout: 90000 });
    await page.waitForFunction(
      () => {
        const a = window.__fusionVisualRead?.();
        return (
          a?.ready &&
          a.actor?.nodes?.length &&
          a.actor.material.length &&
          a.actor.neon.length
        );
      },
      null,
      { timeout: 45000 },
    );
    const before = await page.evaluate(() => window.__fusionVisualRead());
    await page
      .locator("#world")
      .screenshot({ path: `${out}/tier-${tier}-before.png` });
    await fs.writeFile(
      `${out}/tier-${tier}-before-canvas.png`,
      Buffer.from(
        (await page.evaluate(() => window.__fusionVisualCanvas())).split(
          ",",
        )[1],
        "base64",
      ),
    );
    const card = await page
      .locator("[data-card]")
      .first()
      .getAttribute("data-card");
    stage = `tier ${tier} choice`;
    await page.locator("[data-card]").first().click();
    await page.waitForFunction(
      (t) => {
        const a = window.__fusionVisualRead?.();
        return a?.weapon?.appearanceTier === t && a?.picks >= 1;
      },
      tier,
      { timeout: 30000 },
    );
    await page.waitForFunction(
      () => window.__fusionVisualRead?.()?.phase === "combat",
      null,
      { timeout: 30000 },
    );
    const after = await page.evaluate(() => window.__fusionVisualRead());
    await page
      .locator("#world")
      .screenshot({ path: `${out}/tier-${tier}-after.png` });
    await fs.writeFile(
      `${out}/tier-${tier}-after-canvas.png`,
      Buffer.from(
        (await page.evaluate(() => window.__fusionVisualCanvas())).split(
          ",",
        )[1],
        "base64",
      ),
    );
    assert.equal(before.weapon.format, 2);
    assert.equal(before.weapon.rarity, tier);
    assert.equal(after.weapon.appearanceTier, tier);
    for (const state of [before, after]) {
      assert.equal(state.playerSlot, 0);
      assert.equal(state.actor.selectedSlot, 0);
      assert.equal(state.actor.parent, "RightHandWeaponSocket");
    }
    assert.equal(before.actor.name, after.actor.name);
    assert.deepEqual(before.actor.nodes, after.actor.nodes);
    assert.deepEqual(before.actor.material, after.actor.material);
    assert.deepEqual(before.actor.neon, after.actor.neon);
    assert(
      requests.some((x) =>
        new URL(x).pathname.endsWith(`/unique-v1/slug_${tier}.glb`),
      ),
    );
    assert(!requests.some((x) => /\/slug_5\.glb/.test(x)));
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    records.push({ tier, card, before, after, requests, failed, errors });
    await fs.writeFile(
      `${out}/tier-${tier}-report.json`,
      JSON.stringify(records.at(-1), null, 2),
    );
    console.log(
      "PASS tier",
      tier,
      "card",
      card,
      "inlay",
      after.actor.material,
      "neon",
      after.actor.neon,
    );
    await context.close();
    context = undefined;
  }
  await fs.writeFile(
    out + "/report.json",
    JSON.stringify(
      {
        scope:
          "Actual local defense UI; first ordinary growth selection in fusion-enabled mode; disposable save, no multiplayer network, phone, or later full fusion evolution. Renderer groups, inlay material and neon halo compared before/after.",
        capture:
          "Canvas image is an additional explicit product Renderer render(world,id,0.1,...,animate=false), immediately followed by toDataURL; no WebGL buffer-setting change. The unmodified UI screenshots include the selection overlay.",
        viewport: [844, 390],
        records,
      },
      null,
      2,
    ),
  );
} catch (e) {
  await fs.writeFile(
    out + "/failure.json",
    JSON.stringify(
      { stage, error: String(e), completed: records.map((x) => x.tier) },
      null,
      2,
    ),
  );
  if (page && !page.isClosed())
    await page
      .screenshot({ path: out + "/failure.png", timeout: 5000 })
      .catch(() => {});
  throw e;
} finally {
  await context?.close();
  await browser?.close();
  await server.close();
}
