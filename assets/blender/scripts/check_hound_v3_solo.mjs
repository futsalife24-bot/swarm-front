import {chromium} from '@playwright/test';import {writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
try{for(const debug of [false,true]){
 const page=await browser.newPage({viewport:{width:844,height:390},serviceWorkers:'block'});const errors=[],glbs=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('.glb'))glbs.push(r.url())});
 await page.goto((process.argv[2]??'http://127.0.0.1:5198')+'/'+(debug?'?debugHoundGlb=v3':''));
 if(debug)await page.getByRole('button',{name:'HOUND v3 → Current',exact:true}).waitFor();
 await page.getByRole('button',{name:/ソロで出撃準備/}).click();await page.locator('#launch').click();await page.locator('#hud').waitFor({state:'visible'});
 await page.waitForTimeout(500);await page.screenshot({path:`dist-validation/hound-v3/solo-${debug?'debug':'normal'}.png`});
 assert.deepEqual(errors,[]);assert.equal(glbs.length,debug?1:0);results.push({debug,soloStarted:true,glbRequests:glbs.length,errors});await page.close();
}writeFileSync('dist-validation/hound-v3/solo-validation.json',JSON.stringify(results,null,2));console.log(results)}finally{await browser.close()}
