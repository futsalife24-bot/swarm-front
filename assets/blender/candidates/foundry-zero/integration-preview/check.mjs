import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-validation/foundry-concept-implementation';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5199/assets/blender/candidates/foundry-zero/integration-preview/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.foundryPreview?.ready||window.foundryPreview?.error,{},{timeout:60000});
 assert.equal(await page.evaluate(()=>window.foundryPreview.error),undefined);
 const checks=await page.evaluate(()=>window.foundryPreview.checks());
 for(const mode of ['intact','middle','head','multiple']){
   await page.evaluate(mode=>{window.foundryPreview.setMode(mode);window.foundryPreview.draw(0)},mode);
   await page.screenshot({path:`${out}/${mode}.png`});
 }
 await page.evaluate(()=>{window.foundryPreview.setMode('intact');window.foundryPreview.setBending(true);window.foundryPreview.draw(.5)});
 await page.screenshot({path:`${out}/bend.png`});
 await page.setViewportSize({width:915,height:412});
 await page.screenshot({path:`${out}/mobile.png`});
 // A failed read remains an exception callers can handle with their fallback.
 const failure=await page.evaluate(async()=>{const {FoundryWormView}=await import('/src/client/foundry-worm.ts');try{await FoundryWormView.load('/missing-foundry-fixture.glb');return false}catch{return true}});
 assert.equal(failure,true);assert.deepEqual(errors,[]);
 writeFileSync(`${out}/render-checks.json`,JSON.stringify({...checks,loadFailureHandled:failure,errors,environment:'Chrome SwiftShader; fixture transforms, not gameplay'},null,2));
 console.log(JSON.stringify(checks));
}finally{await browser.close()}
