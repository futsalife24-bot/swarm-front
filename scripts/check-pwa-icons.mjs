import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const base=process.env.ICON_SITE||'http://127.0.0.1:5354',label=base.startsWith('https')?'published':'local',out=process.env.ICON_OUT||'dist-validation/pwa-icons';
const browser=await chromium.launchPersistentContext(`${out}/profile-${label}`,{channel:'chrome'}),rows=[];
try {
 for(const query of ['','?playtest=1']) {
  const page=await browser.newPage();await page.goto(base+'/'+query);await page.locator('#solo').waitFor();
  const cdp=await page.context().newCDPSession(page);const manifest=await cdp.send('Page.getAppManifest');const parsed=JSON.parse(manifest.data);
  assert.equal(parsed.display,'fullscreen');assert.equal(parsed.orientation,'landscape');assert.equal(parsed.start_url,'./');
  assert.equal(parsed.scope,'./');assert.equal(Object.hasOwn(parsed,'id'),false);
  assert.deepEqual(parsed.icons.map(icon=>icon.src),['icon-swarm-v4-192.png','icon-swarm-v4-512.png','icon-swarm-v4-512-maskable.png']);
  for(const size of [192,512])assert.ok(parsed.icons.some(i=>i.type==='image/png'&&i.sizes===`${size}x${size}`&&i.purpose==='any'));
  assert.ok(parsed.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'));
  const decoded=await page.evaluate(async()=>{
   const manifest=await (await fetch(document.querySelector('link[rel="manifest"]').href)).json();const rows=[];
   for(const icon of manifest.icons.filter(i=>i.type==='image/png')) {
    const img=new Image();img.src=new URL(icon.src,document.querySelector('link[rel="manifest"]').href).href;await img.decode();
    const c=document.createElement('canvas');c.width=c.height=img.width;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
    const opaque=icon.purpose==='maskable'?[...ctx.getImageData(0,0,c.width,c.height).data].filter((_,i)=>i%4===3).every(a=>a===255):null;
    rows.push({src:icon.src,w:img.width,h:img.height,opaque});
   }
   const apple=new Image();apple.src=document.querySelector('link[rel="apple-touch-icon"]').href;await apple.decode();rows.push({src:'apple',w:apple.width,h:apple.height});return rows;
  });
  assert.ok(decoded.every(i=>i.w===i.h&&i.w>0));assert.equal(decoded.find(i=>i.src.includes('maskable')).opaque,true);assert.equal(decoded.at(-1).w,180);
  const installability=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(installability.installabilityErrors,[]);
  rows.push({query,decoded,installability});await page.close();
 }
 // 旧manifest・旧アイコンが残る更新前の状態を、検証専用プロファイル内だけで再現する。
 const upgradePage=await browser.newPage();await upgradePage.goto(base+'/');
 await upgradePage.evaluate(()=>navigator.serviceWorker.ready);await upgradePage.reload();
 await upgradePage.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const upgrade=await upgradePage.evaluate(async()=>{
  const manifestUrl=new URL('manifest.webmanifest',location.href);
  const cache=await caches.open('swarm-front-shell-v1');
  await cache.put(manifestUrl,new Response(JSON.stringify({icons:[{src:'icon-swarm-v3-512.png'}]})));
  const oldIconUrl=new URL('icon-swarm-v3-512.png',location.href);
  await cache.put(oldIconUrl,await fetch(oldIconUrl));
  const unrelated=await caches.open('unrelated-pwa-icon-check');
  const markerUrl=new URL('pwa-icon-check-marker',location.href);
  await unrelated.put(markerUrl,new Response('keep'));
  localStorage.setItem('pwa-icon-check-marker','keep');
  const refreshed=await(await fetch(manifestUrl)).json();
  const icon=new Image();icon.src=new URL(refreshed.icons.find(i=>i.purpose==='any'&&i.sizes==='512x512').src,manifestUrl);await icon.decode();
  return {icons:refreshed.icons.map(i=>i.src),width:icon.width,height:icon.height,oldIconRetained:Boolean(await cache.match(oldIconUrl)),otherCache:await(await unrelated.match(markerUrl)).text(),storage:localStorage.getItem('pwa-icon-check-marker')};
 });
 assert.ok(upgrade.icons.every(src=>src.startsWith('icon-swarm-v4-')));
 assert.equal(upgrade.width,512);assert.equal(upgrade.height,512);
 assert.equal(upgrade.oldIconRetained,true);assert.equal(upgrade.otherCache,'keep');assert.equal(upgrade.storage,'keep');
 await upgradePage.close();
 const files=['index.html','manifest.webmanifest','icon-swarm-v4-64.png','icon-swarm-v4-192.png','icon-swarm-v4-512.png','icon-swarm-v4-512-maskable.png','icon-swarm-v4-180.png'];
 for(const file of files){const r=await fetch(base+'/'+file,{cache:'no-store'});assert.equal(r.status,200);assert.ok(Buffer.from(await r.arrayBuffer()).equals(fs.readFileSync('dist/'+file)));}
 assert.equal((await (await fetch(base+'/api/health')).json()).ok,true);
 fs.writeFileSync(`${out}/${label}.json`,JSON.stringify({rows,upgrade,files},null,2));console.log('PASS',label,'both routes: decoded icons, installability, cached-v3 upgrade, storage preservation, 7 file matches, health');
}finally{await browser.close()}
