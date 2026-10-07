import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const base = "https://swarm-front.melosalife-24.workers.dev";
const out = "dist-validation/cave-foundry-release-20261007/public-cave";
mkdirSync(out,{recursive:true});
const fixture = readFileSync("dist-validation/cave-foundry-release-20261007/public-fixture.json","utf8");
const browser = await chromium.launch({channel:"chrome",args:["--use-angle=d3d11"]});
const results=[];
try {
  for (const [width,height] of [[844,390],[640,360]]) for (const stage of [10,16]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:"block"});
    await context.addInitScript(raw=>localStorage.setItem("swarm-front-shared-progress-v3",raw),fixture);
    const page=await context.newPage(), errors=[], consoleErrors=[];
    page.on("pageerror", e=>errors.push(e.message));
    page.on("console", m=>{if(m.type()==="error")consoleErrors.push(m.text());});
    assert.equal((await page.goto(base+"/",{waitUntil:"domcontentloaded"})).status(),200);
    await page.locator("#solo").click();
    await page.locator("#player-name").fill("洞窟配信確認");
    await page.locator("#player-name-form button[type=submit]").click();
    await page.locator("#pt-stage").selectOption(String(stage),{force:true});
    await page.locator("#pt-start").click();
    await page.locator("#pt-enter").click({timeout:65000});
    await page.locator("#hud").waitFor({state:"visible"});
    await page.waitForTimeout(3500);
    const hud=await page.locator("#hud").innerText();
    assert.match(hud,new RegExp(`ST ${stage}\\b`));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    assert.equal(overflow,false);
    await page.screenshot({path:`${out}/${width}-st${stage}.png`});
    await page.locator("#pause").click();
    await page.locator("#pt-resume").click();
    assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
    results.push({width,height,stage,hud,overflow,errors,consoleErrors,scope:"専用contextの進行fixture・Chromeタッチエミュレーションから公開ソロ開始・洞窟描画・pause/resume。実機タッチ/実Worker頭部撃破ではない。"});
    await context.close();
  }
  writeFileSync(`${out}/result.json`,JSON.stringify({pass:true,base,results},null,2));
  console.log("公開洞窟4条件成功、描画/HUD/pause/resume、console/page error 0");
} finally{await browser.close();}
