import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-validation/weapon-marks'; fs.mkdirSync(out,{recursive:true});
const save=JSON.parse(fs.readFileSync('dist-validation/gear-pinned/fixture.json','utf8'));
const w={id:'legacy-mark',kind:'rifle',rarity:2,power:1.2,effect:'quick',acquired:0,testData:false,rolls:{power:0.8,mag:1.1,reload:0.85,range:0.9,rate:1.001}};
save.inventory[0]=w;save.soldiers[0].equipped[0]=w.id;
const browser=await chromium.launch({channel:'chrome'});const results=[];
try{for(const width of [844,1280]){
 const p=await browser.newPage({viewport:{width,height:390}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(s=>localStorage.setItem('swarm-front-progression-v2-normal',JSON.stringify(s)),save);
 await p.goto('http://127.0.0.1:5347/');await p.locator('#solo').click();await p.locator('#player-name').fill('表示検証');await p.locator('#player-name-form button[type=submit]').click();
 const marks=await p.locator('[data-pinned] .pt-stat-inner sup').allTextContents();assert.deepEqual(marks,['★','▲','▲\n▲','▼','▲']);
 await p.screenshot({path:`${out}/${width}-list.png`});await p.locator('[data-pinned] [data-detail]').click();
 assert.deepEqual(await p.locator('#pt-comparison sup').allTextContents(),marks);await p.screenshot({path:`${out}/${width}-detail.png`});
 assert.deepEqual(errors,[]);results.push({width,marks,detailMatches:true,errors});await p.close();
}}finally{await browser.close();}
fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(results);
