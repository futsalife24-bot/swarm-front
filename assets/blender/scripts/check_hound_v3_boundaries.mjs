import {chromium} from '@playwright/test';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:5198',out='dist-validation/hound-v3';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={};
try{
 const page=await browser.newPage();
 await page.route('**/hound_blockout_v3.glb',r=>r.abort());
 await page.goto(base+'/e2e/structure-fixture.html?debugHoundGlb=v3');
 await page.evaluate(async()=>{
  const {Renderer}=await import('/src/client/render.ts'),g=await import('/src/shared/game.ts');
  const canvas=document.createElement('canvas'),damage=document.createElement('div');damage.id='damage';document.body.replaceChildren(canvas,damage);
  const view=new Renderer(canvas),w=g.createWorld('failure',123,1);g.addPlayer(w,'p');g.start(w);w.enemies=[];g.spawn(w,'crawler',0,-6,'crown');window.fixture={view,w};
 });
 await page.waitForFunction(()=>!!window.fixture.view.houndDebug?.error);
 results.rendererFailure=await page.evaluate(()=>{const {view,w}=window.fixture;const before=JSON.stringify(w);view.render(w,'p',0,0,0);const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('HOUND GLB failed'));return {currentVisible:view.enemies.get('crawler').visible,glbVisible:view.houndDebug.group.visible,disabled:b?.disabled,worldUnchanged:before===JSON.stringify(w)};});
 assert.deepEqual(results.rendererFailure,{currentVisible:true,glbVisible:false,disabled:true,worldUnchanged:true});
 await page.goto(base+'/e2e/structure-fixture.html?debugHoundGlb=0');
 results.zeroFlag=await page.evaluate(async()=>{const {Renderer}=await import('/src/client/render.ts');const c=document.createElement('canvas');document.body.replaceChildren(c);return !!new Renderer(c).houndDebug;});assert.equal(results.zeroFlag,false);
 const js=readdirSync('dist/assets').filter(n=>n.endsWith('.js')).map(n=>readFileSync('dist/assets/'+n,'utf8')).join('\n');
 results.productionDebugStrings=['hound_blockout_v3.glb','HOUND v3 → Current','HOUND GLB failed','HOUND_V2_DEBUG'].filter(s=>js.includes(s));assert.deepEqual(results.productionDebugStrings,[]);
 writeFileSync(`${out}/boundaries.json`,JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close()}
