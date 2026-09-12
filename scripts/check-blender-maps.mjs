import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const url=process.env.MAP_TEST_URL||'http://127.0.0.1:5314';
const dir='dist-validation/maps-blender/browser';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const results=[];
 for(const [stage,index] of [[1,0],[5,1],[20,2],[2,3],[13,4],[10,5]]){
  await page.goto(url);await page.getByRole('button',{name:/ソロで出撃準備/}).click();await page.locator('#stage-select').selectOption(String(stage));await page.locator('#launch').click();
  await page.waitForFunction(i=>window.__swarm?.mapAssets?.[i].state==='ready',index,{timeout:45000});
  await page.waitForTimeout(700);await page.screenshot({path:`${dir}/map-${index}.png`});
  results.push(await page.evaluate(()=>({stage:window.__swarm.world.stage,assets:window.__swarm.mapAssets,fps:window.__swarm.fps,drawCalls:window.__swarm.drawCalls})));
 }
 writeFileSync(`${dir}/checks.json`,JSON.stringify({results,errors},null,2));if(errors.length)throw new Error(errors.join('\n'));console.log(JSON.stringify(results));
}finally{await browser.close();}
