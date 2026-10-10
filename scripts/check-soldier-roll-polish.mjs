import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const base = process.env.ROLL_REVIEW_BASE ?? "http://127.0.0.1:5344";
const side = process.env.ROLL_REVIEW_DIRECTION === "left";
const profiles = side ? [0] : [0, 1, 2];
const frameCount = side ? 45 : 90;
const out = `dist-validation/roll-polish-20261010${side ? "-left" : ""}`;
await fs.mkdir("test-results/roll-polish", { recursive: true });
await fs.mkdir(out, { recursive: true });
const baseline = spawnSync(
  "git",
  [
    "show",
    "f1298bb1632ce3844023a822fe495db6445227d1:src/client/standard-trooper.ts",
  ],
  { encoding: "utf8" },
);
assert.equal(baseline.status, 0, baseline.stderr);
const before = baseline.stdout;
await fs.writeFile(`${out}/standard-trooper.before.ts`, before);
await fs.writeFile(
  "test-results/roll-polish/standard-trooper-before.ts",
  before
    .replace(/from "\.\/([^\"]+)"/g, 'from "/src/client/$1"')
    .replace(/from "\.\.\/shared\/([^\"]+)"/g, 'from "/src/shared/$1"')
    .replace('import("./run-trial")', 'import("/src/client/run-trial")'),
);
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>回避動作の連続確認</title><style>body{margin:0;background:#14202a}canvas{display:block}</style><canvas id="world"></canvas><div id="damage"></div><script type="module">
import {Renderer} from '/src/client/render.ts';
import {prepareBattle} from '/src/client/battle-loading.ts';
import {addPlayer,createWorld,neutral,step} from '/src/shared/game.ts';
import {STARTERS} from '/src/shared/defs.ts';
window.rollProgress='imports';const canvas=document.querySelector('#world'),view=new Renderer(canvas);view.renderer.shadowMap.enabled=false;view.renderer.setPixelRatio(1);view.renderer.setSize(640,360,false);window.rollProgress='renderer';
let world,player,accumulator=0,time=0,used=new Set();
function reset(profile){world=createWorld('roll-polish-'+profile,123);player=addPlayer(world,'p',[STARTERS[profile],STARTERS[(profile+1)%3]]);world.phase='battle';world.wave=1;world.nextSpawn=1e9;player.x=0;player.z=0;time=0;accumulator=0;used=new Set();view.render(null,'',0,0,0,undefined,false,false,false,false)}
reset(0);await prepareBattle(view,world,'p',()=>false,n=>{window.rollProgress=n});
const label=new URL(location.href).searchParams.get('version');
const image=document.createElement('canvas');image.width=640;image.height=360;const ctx=image.getContext('2d');
const api=window.rollPolish={ready:true,reset:async(profile)=>{reset(profile);await prepareBattle(view,world,'p',()=>false,()=>{});return api.frame(0)},frame(dt){
accumulator+=dt;while(accumulator>=.05-1e-9){const i=neutral();i.cameraAim=false;if(time>=.4&&time<.75){if(${side})i.mx=-1;else i.mz=1}if(time>=1.7&&time<2.05)i.mx=-1;i.fire=(time>=.75&&time<1.2)||(time>=2.05&&time<2.5);for(const at of [.4,1.7])if(time>=at&&!used.has(at)){i.dodge=true;used.add(at)}step(world,{p:i},.05);accumulator-=.05;time+=.05}
const untouched=JSON.stringify(world);view.render(world,'p',dt,0,0,undefined,true,false,true,false);if(JSON.stringify(world)!==untouched)throw Error('Renderer mutated authority');
view.camera.fov=45;view.camera.position.set(player.x+3.4,1.7,player.z+.6);view.camera.lookAt(player.x,.9,player.z);view.camera.aspect=640/360;view.camera.updateProjectionMatrix();view.renderer.shadowMap.enabled=false;view.renderer.setPixelRatio(1);view.renderer.setSize(640,360,false);view.renderer.render(view.scene,view.camera);ctx.drawImage(canvas,0,0);ctx.fillStyle='#14202a';ctx.fillRect(0,0,640,50);ctx.fillStyle='white';ctx.font='20px sans-serif';ctx.fillText((label==='before'?'修正前':'修正後')+' / 実ゲーム処理・固定入力 / '+time.toFixed(2)+'秒',16,29);
const actor=view.players.get('p').userData.trooper;const pelvis=actor.model.getObjectByName('Pelvis');return {jpg:image.toDataURL('image/jpeg',.9).split(',')[1],t:time,worldTime:world.time,evade:player.evade,ammo:[...player.ammo],position:[player.x,player.z],mode:actor.mode,rollTime:actor.rollTime,rollRecovery:actor.rollRecovery??0,rotation:actor.model.rotation.y,pelvis:pelvis.quaternion.toArray()}
}};api.frame(0);
</script></html>`;
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
process.once("SIGINT", async () => {
  await browser.close();
  process.exit(130);
});
const results = [];
try {
  for (const version of ["before", "after"]) {
    const page = await browser.newPage({
        viewport: { width: 640, height: 360 },
        serviceWorkers: "block",
      }),
      errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error(e.message);
    });
    page.on("requestfailed", (r) =>
      console.error(r.url(), r.failure()?.errorText),
    );
    page.on("console", (m) => {
      if (m.type() === "error") console.error(m.text());
    });
    await page.route("**/roll-polish-fixture.html*", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: html }),
    );
    if (version === "before")
      await page.route("**/src/client/render.ts*", async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        assert.ok(body.includes("/src/client/standard-trooper.ts"));
        await route.fulfill({
          response,
          body: body.replaceAll(
            "/src/client/standard-trooper.ts",
            "/test-results/roll-polish/standard-trooper-before.ts",
          ),
        });
      });
    await page.goto(`${base}/roll-polish-fixture.html?version=${version}`);
    try {
      await page.waitForFunction(() => window.rollPolish?.ready, undefined, {
        timeout: 30000,
      });
    } catch (e) {
      console.error(
        await page.evaluate(() => ({
          progress: window.rollProgress,
          body: document.body.innerText,
          scripts: [...document.scripts].map((s) =>
            s.textContent.slice(0, 100),
          ),
          requests: performance
            .getEntriesByType("resource")
            .map((r) => r.name)
            .slice(-12),
        })),
      );
      throw e;
    }
    for (const profile of profiles) {
      const dir = `${out}/${version}-${profile}`;
      await fs.mkdir(dir, { recursive: true });
      await page.evaluate(
        (profile) => window.rollPolish.reset(profile),
        profile,
      );
      const samples = [];
      for (let frame = 0; frame < frameCount; frame++) {
        const { jpg, ...row } = await page.evaluate(() =>
          window.rollPolish.frame(1 / 30),
        );
        samples.push(row);
        await fs.writeFile(
          `${dir}/${String(frame).padStart(4, "0")}.jpg`,
          Buffer.from(jpg, "base64"),
        );
      }
      const encoded = spawnSync(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-framerate",
          "30",
          "-i",
          `${dir}/%04d.jpg`,
          "-c:v",
          "libx264",
          "-threads",
          "2",
          "-crf",
          "19",
          "-pix_fmt",
          "yuv420p",
          `${out}/${version}-${profile}.mp4`,
        ],
        { encoding: "utf8" },
      );
      assert.equal(encoded.status, 0, encoded.stderr);
      results.push({ version, profile, samples, errors: [...errors] });
      assert.deepEqual(errors, []);
      assert.ok(
        samples.some((s) => s.evade > 0),
        "Required roll did not start",
      );
      if (side)
        assert.ok(
          samples.some((s) => s.evade > 0 && s.position[0] < 0),
          "Required left roll did not move left",
        );
      await fs.writeFile(
        `${dir}/metrics.json`,
        JSON.stringify(samples, null, 2),
      );
    }
    await page.close();
  }
  for (const profile of profiles) {
    const a = results.find(
        (r) => r.version === "before" && r.profile === profile,
      ),
      b = results.find((r) => r.version === "after" && r.profile === profile);
    assert.deepEqual(
      a.samples.map(({ t, worldTime, evade, ammo, position }) => ({
        t,
        worldTime,
        evade,
        ammo,
        position,
      })),
      b.samples.map(({ t, worldTime, evade, ammo, position }) => ({
        t,
        worldTime,
        evade,
        ammo,
        position,
      })),
    );
    const r = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        `${out}/before-${profile}.mp4`,
        "-i",
        `${out}/after-${profile}.mp4`,
        "-filter_complex",
        "hstack=inputs=2",
        "-c:v",
        "libx264",
        "-threads",
        "2",
        "-crf",
        "19",
        "-pix_fmt",
        "yuv420p",
        `${out}/comparison-${profile}.mp4`,
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr);
  }
  const hash = async (path) =>
    createHash("sha256")
      .update(await fs.readFile(path))
      .digest("hex");
  await fs.writeFile(
    `${out}/browser-checks.json`,
    JSON.stringify(
      {
        base,
        direction: side ? "left" : "forward",
        framesPerClip: frameCount,
        sourceBefore: await hash(`${out}/standard-trooper.before.ts`),
        sourceAfter: await hash("src/client/standard-trooper.ts"),
        asset: await hash("public/assets/characters/swarm-soldier.glb"),
        authorityBeforeAfterIdentical: true,
        rendererAuthorityMutation: false,
        results,
        limitations: [
          "実Renderer/stepの固定入力、敵なし・影なし、30fps保存。実端末性能/通信/公開確認は対象外。",
          "比較前の描画クラスのみ保存済み基準ソースへ差し替え。保存データを使わない独立fixture。",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: required roll direction and post-roll fire; identical authority before/after; comparison films saved",
  );
} finally {
  await browser.close();
}
