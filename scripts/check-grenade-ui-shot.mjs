// Isolated local browser/profile. Instruments the real Renderer after each draw;
// it does not alter combat, input, world state, or network code.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs/promises";

const out="dist-validation/grenade-ui-shot/pc-input";
await fs.mkdir(out,{recursive:true});
// Build the disposable save in Node; the browser opens the game directly.
const fixtureSource=`import {freshProgress, validateProgress, newSaveKey} from './src/client/progression-save.ts'; import {makeWeapon} from './src/shared/progression.ts'; const save=freshProgress('normal'), w=makeWeapon('fixture-grenade','grenade',0,{power:0,reload:0,range:0,rate:0},false,save.serial++); save.inventory.push(w); save.soldiers[0].equipped[0]=w.id; save.tutorials=['gear','armory','base','battle','combat']; save.armoryMigration=1; export const key=newSaveKey('normal'); export const raw=JSON.stringify(validateProgress(save));`;
await build({stdin:{contents:fixtureSource,resolveDir:process.cwd(),sourcefile:'fixture.js'},bundle:true,format:'esm',platform:'node',packages:'external',outfile:out+'/fixture-save.mjs',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}});
const fixture=await import('../'+out+'/fixture-save.mjs');
const server=await createServer({configFile:false,define:{__SWARM_BUILD__:JSON.stringify('local-review'),__AUTO_CHANGELOG__:JSON.stringify([])},server:{host:'127.0.0.1',port:0},optimizeDeps:{noDiscovery:true,include:[]}});
let browser,page,stage='サーバー起動';
try {
  await server.listen();const base='http://127.0.0.1:'+server.httpServer.address().port;
  browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
  page=await browser.newPage({viewport:{width:844,height:390},serviceWorkers:'block'});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({key,raw})=>{
    localStorage.setItem(key,raw);
    localStorage.setItem('swarm-front-player-name-v1','ローカル検証');
  },{key:fixture.key,raw:fixture.raw});
  await page.route(/\/src\/client\/playtest-app\.ts(?:\?.*)?$/,async route=>{
    const response=await route.fetch(),body=await response.text();
    await route.fulfill({response,body:body+`
const captureDraw = view.render.bind(view);
view.render = (...args) => {
 const result=captureDraw(...args);
 const shot=world?.events.find(e=>e.type==='shot' && e.owner==='solo' && e.weapon==='grenade');
 if(result && shot && !window.grenadeUIFirstShot) {
   const projectile=world.projectiles.find(q=>q.owner==='solo' && q.family==='grenade');
   const trooper=view.players.get('solo')?.userData.trooper;
   const muzzle=trooper?.muzzle();
   window.grenadeUIFirstShot={ image:view.renderer.domElement.toDataURL(),
     worldTime:world.time,shot:structuredClone(shot),projectile:projectile?structuredClone(projectile):null,
     muzzle:muzzle?.toArray(),effectKinds:view.combat.items.map(e=>e.kind),screen };
 }
 return result;
};`});
  });
  stage='実ゲームページの読み込み';console.log(stage);
  await page.goto(base+'/?solo=1',{waitUntil:'domcontentloaded',timeout:50000});
  stage='出撃画面';
  const start=page.locator('#pt-start');await start.waitFor({state:'visible',timeout:90000});await start.click();
  stage='戦場の準備';
  await page.locator('#pt-enter').waitFor({state:'visible',timeout:90000});await page.locator('#pt-enter').click();
  stage='戦闘画面';
  await page.waitForFunction(()=>window.__playtest?.screen==='battle'&&window.__playtest?.trooper?.loaded,null,{timeout:90000});
  if(await page.locator('#pt-tutorial-skip').count()) await page.locator('#pt-tutorial-skip').click();
  if(await page.locator('#pt-intro-skip').count()) await page.locator('#pt-intro-skip').click();
  await page.waitForFunction(()=>window.__playtest?.world?.players?.[0]?.weapons?.[0]?.kind==='grenade',null,{timeout:30000});
  console.log('実UIの出撃を確認、射撃');
  stage='最初の射撃';
  const point=await page.evaluate(()=>{
    for(let y=110;y<innerHeight-40;y+=20)for(let x=100;x<innerWidth-100;x+=20){
      const target=document.elementFromPoint(x,y);
      if(target?.id==='world'||target?.id==='look')return {x,y,id:target.id};
    }
    return null;
  });
  if(!point)throw Error('射撃入力を受ける画面上の位置が見つかりません');
  console.log('射撃入力先',JSON.stringify(point));
  await page.mouse.move(point.x,point.y);await page.mouse.down();
  await page.waitForFunction(()=>!!window.grenadeUIFirstShot,null,{timeout:20000});
  await page.mouse.up();
  const data=await page.evaluate(()=>window.grenadeUIFirstShot);
  await fs.writeFile(out+'/first-render.png',Buffer.from(data.image.split(',')[1],'base64'));
  await page.screenshot({path:out+'/game-ui-after.png'});
  delete data.image;
  await fs.writeFile(out+'/report.json',JSON.stringify({scope:'Actual local solo UI and game loop with an isolated injected save; renderer capture instrumentation, no actual network or phone',viewport:[844,390],...data,errors},null,2));
  console.log(JSON.stringify({data,errors},null,2));
  if(errors.length||!data.projectile)process.exitCode=1;
} catch(error) {
  await fs.writeFile(out+'/failure.json',JSON.stringify({stage,error:String(error)},null,2));
  if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png',timeout:5000}).catch(()=>{});
  console.error(JSON.stringify({stage,error:String(error)}));
  throw error;
} finally {await browser?.close();await server.close();console.log('検証ブラウザーとサーバーを終了');}
