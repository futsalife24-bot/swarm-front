import { chromium } from '@playwright/test';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const remote = process.env.WEAPON_SITE;
const server = remote ? null : await preview({preview:{host:'127.0.0.1',port:5221,strictPort:true}});
const base = remote || 'http://127.0.0.1:5221';
const browser = await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const out = 'dist-validation/pwa-fullscreen';
fs.mkdirSync(out,{recursive:true});
const results=[];
try {
  for (const mode of ['fullscreen','standalone','minimal-ui','ios']) {
    const ctx = await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
    await ctx.addInitScript(mode => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = query => {
        const result = original(query);
        if (query.includes('display-mode:')) Object.defineProperty(result,'matches',{value:query.includes(`display-mode: ${mode}`)});
        return result;
      };
      if (mode==='ios') Object.defineProperty(navigator,'standalone',{value:true});
      window.fullscreenCalls=0; window.orientationCalls=0;
      window.fsActive=false;
      Object.defineProperty(document,'fullscreenElement',{get:()=>window.fsActive?document.documentElement:null});
      Element.prototype.requestFullscreen=async options=>{
        if(options.navigationUI!=='hide') throw Error('Navigation UI not hidden');
        window.fullscreenCalls++; window.fsActive=true;
      };
      Object.defineProperty(screen.orientation,'lock',{value:async value=>{
        if(value!=='landscape') throw Error('Wrong orientation');
        window.orientationCalls++;
      }});
    },mode);
    const p=await ctx.newPage(); const errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base);
    const manifest=await p.evaluate(async()=> (await fetch(document.querySelector('link[rel=manifest]').href)).json());
    assert.equal(manifest.display,'fullscreen'); assert.equal(manifest.orientation,'landscape');
    assert.equal(await p.evaluate(()=>document.fullscreenElement),null);
    await p.locator('#open-armory').tap();
    assert.equal(await p.evaluate(()=>window.fullscreenCalls),mode==='fullscreen'?0:1);
    await p.locator('#armory-gear').tap();
    await p.locator('#launch').tap();
    await p.waitForFunction(()=>document.body.dataset.screen==='battle');
    assert.equal(await p.evaluate(()=>window.fullscreenCalls),mode==='fullscreen'?0:1);
    const initialLocks=await p.evaluate(()=>window.orientationCalls);
    await p.evaluate(()=>{
      window.fsActive=false;
      document.dispatchEvent(new Event('fullscreenchange'));
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pageshow'));
    });
    await p.waitForTimeout(650);
    await p.locator('#fire').tap();
    assert.equal(await p.evaluate(()=>window.fullscreenCalls),mode==='fullscreen'?0:2);
    assert.ok(await p.evaluate(()=>window.orientationCalls)>initialLocks);
    assert.deepEqual(errors,[]);
    if(mode==='fullscreen') await p.screenshot({path:`${out}/${remote?'published-':''}battle.png`});
    results.push({mode,apiCalls:mode==='fullscreen'?0:2,landscapeLock:true,armoryGearBattle:true,errors});
    await ctx.close();
  }
  // Exercise the real service worker and installed-shell offline navigation.
  const ctx=await browser.newContext(); const p=await ctx.newPage();
  await p.goto(base); await p.evaluate(()=>navigator.serviceWorker.ready);
  await p.reload(); await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const refreshed=await p.evaluate(async()=>{
    const url=new URL('manifest.webmanifest',location.href).href;
    const cache=await caches.open('swarm-front-shell-v1');
    await cache.put(url,new Response(JSON.stringify({display:'standalone'})));
    const response=await fetch(url);
    return (await response.json()).display;
  });
  assert.equal(refreshed,'fullscreen');
  await p.waitForFunction(async()=>{
    const cached=await caches.match(new URL('manifest.webmanifest',location.href).href);
    return cached && (await cached.json()).display==='fullscreen';
  });
  await ctx.setOffline(true); await p.reload();
  await p.locator('#solo').waitFor({state:'visible'});
  assert.equal(await p.evaluate(async()=> (await (await fetch('manifest.webmanifest')).json()).display),'fullscreen');
  await ctx.setOffline(false); await ctx.close();
  results.push({staleManifestRefresh:true,offlineShell:true});
  fs.writeFileSync(`${out}/${remote?'published':'checks'}.json`,JSON.stringify({pass:true,displayModeEmulated:true,results},null,2));
  console.log('PASS',JSON.stringify(results));
} finally { await browser.close(); await server?.close(); }
