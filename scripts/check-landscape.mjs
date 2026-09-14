import { chromium } from '@playwright/test';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const remote = process.argv.slice(2).find(arg=>arg.startsWith('https://'));
const apiOnly = process.argv.includes('--api-only');
const server = remote ? null : await preview({preview:{host:'127.0.0.1',port:4194,strictPort:true}});
const base = remote || 'http://127.0.0.1:4194';
const browser = await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results = [], errors = [];
mkdirSync('dist-validation/landscape',{recursive:true});
try {
  // Verify API sequencing separately from real touch/layout checks. These
  // stubs prove our calls, not iOS browser support or physical rotation.
  for (const requiresFullscreen of [false,true]) {
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    await context.addInitScript(({requiresFullscreen})=>{
      window.rotationCalls=[];
      let fullscreen=false;
      Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>fullscreen?document.documentElement:null});
      Element.prototype.requestFullscreen=async()=>{window.rotationCalls.push('fullscreen');fullscreen=true;};
      Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async(value)=>{
        window.rotationCalls.push(value);
        if(requiresFullscreen&&!fullscreen) throw new Error('fullscreen required');
      }});
    },{requiresFullscreen});
    const page=await context.newPage();
    await page.goto(base);
    await page.waitForFunction(()=>window.rotationCalls.includes('landscape'));
    assert.equal(await page.locator('#landscape-status').textContent(),'');
    assert.equal(await page.locator('#portrait').textContent().then(t=>t.includes('横画面で遊んで')),false);
    await page.locator('#landscape-start').tap();
    await page.waitForFunction(()=>window.rotationCalls.includes('fullscreen')&&window.rotationCalls.at(-1)==='landscape');
    assert.equal(await page.locator('#landscape-status').textContent(),'');
    const calls=await page.evaluate(()=>window.rotationCalls);
    assert(calls.indexOf('fullscreen')<calls.lastIndexOf('landscape'));
    results.push({apiStub:true,requiresFullscreen,calls,pass:true});
    await page.goto('about:blank');await context.close();
  }
  for (const [width,height] of (apiOnly ? [] : [[390,844],[1024,1366]])) {
    const context = await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    const page = await context.newPage();
    await page.addInitScript(()=>{
      Element.prototype.requestFullscreen=()=>Promise.reject(new Error('unsupported'));
      Object.defineProperty(screen.orientation,'lock',{configurable:true,value:()=>Promise.reject(new Error('unsupported'))});
    });
    page.setDefaultTimeout(15000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    await page.locator('#solo').waitFor({state:'attached'});
    assert.equal(await page.locator('#portrait').isVisible(),true);
    assert.equal(await page.locator('#solo').isVisible(),false);
    assert.equal(await page.locator('#ui').evaluate(el=>el.inert),true);
    // Unsupported locking must leave the gate intact, with no rejected promise.
    await page.evaluate(()=>{
      document.documentElement.requestFullscreen=()=>Promise.reject(new Error('unsupported'));
      Object.defineProperty(screen.orientation,'lock',{configurable:true,value:()=>Promise.reject(new Error('unsupported'))});
    });
    await page.locator('#landscape-start').tap();
    await page.waitForFunction(()=>document.querySelector('#landscape-status').textContent.includes('自動で切り替えられません'));
    assert.equal(await page.locator('#portrait').isVisible(),true);
    await page.screenshot({path:`dist-validation/landscape/${remote?'published':'local'}-portrait-${width}.png`});
    await page.setViewportSize({width:height,height:width});
    await page.locator('#solo').tap();
    await page.locator('#launch').tap();
    await page.locator('#pause').waitFor({state:'visible'});
    const cdp=await context.newCDPSession(page);
    const center=async selector=>{const r=await page.locator(selector).boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
    const stick={...await center('#move'),id:1};
    const scope={...await center('#scope'),id:2};
    await page.waitForFunction(()=>!document.querySelector('#scope').disabled);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick]});
    stick.y-=35;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[stick]});
    const activeMove=await page.locator('#move span').getAttribute('style');
    assert.match(activeMove,/translate/);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick,scope]});
    await page.waitForFunction(()=>document.querySelector('#scope').getAttribute('aria-pressed')==='true');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[scope]});
    assert.equal(await page.locator('#scope').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#move span').getAttribute('style'),activeMove);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick,scope]});
    await page.waitForFunction(()=>document.querySelector('#scope').getAttribute('aria-pressed')==='false');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.locator('#scope').tap();
    await page.waitForFunction(()=>document.querySelector('#scope').getAttribute('aria-pressed')==='true');
    await page.locator('#scope').tap();
    await page.waitForFunction(()=>document.querySelector('#scope').getAttribute('aria-pressed')==='false');
    const scale=await page.evaluate(()=>visualViewport.scale);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:height/2-30,y:80,id:4},{x:height/2+30,y:80,id:5}]});
    for(const spread of [60,100,140,100,60,30]) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:height/2-spread,y:80,id:4},{x:height/2+spread,y:80,id:5}]});
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await page.evaluate(()=>visualViewport.scale),scale);
    assert.equal(await page.evaluate(()=>['gesturestart','gesturechange','gestureend'].every(type=>{
      const e=new Event(type,{cancelable:true,bubbles:true});document.dispatchEvent(e);return e.defaultPrevented;
    })),true);
    const fire=await page.locator('#fire').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fire.x+fire.width/2,y:fire.y+fire.height/2,id:31}]});
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>document.querySelector('#ui').inert);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.equal(await page.locator('#pause-menu').evaluate(el=>el.hidden),false);
    assert.equal(await page.locator('#world').isVisible(),false);
    await page.setViewportSize({width:height,height:width});
    await page.locator('#pause-resume').tap();
    await page.locator('#pause').tap();
    await page.locator('#pause-leave').tap();
    await page.locator('#pause-quit').tap();
    await page.locator('#launch').waitFor({state:'visible'});
    await page.screenshot({path:`dist-validation/landscape/${remote?'published':'local'}-landscape-${height}.png`});
    const html=readFileSync('dist/index.html','utf8');
    for(const path of [html.match(/src="([^"]+\.js)"/)[1],html.match(/href="([^"]+\.css)"/)[1]]) {
      const response=await page.request.get(base+path);assert.equal(response.status(),200);
      const sha=b=>createHash('sha256').update(b).digest('hex');
      assert.equal(sha(await response.body()),sha(readFileSync('dist'+path)));
    }
    results.push({width,height,pass:true});
    await page.goto('about:blank'); await context.close();
    console.log('PASS',width,height);
  }
  assert.deepEqual(errors,[]);
  writeFileSync(`dist-validation/landscape/${remote?'published':'local'}${apiOnly?'-api':''}.json`,JSON.stringify({base,results,errors},null,2));
  console.log('COMPLETE',results.length);
} finally {
  await browser.close();
  if(server) await new Promise(resolve=>server.httpServer.close(resolve));
}
