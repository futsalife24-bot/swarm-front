import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = process.env.AIM_CENTER_OUTPUT || 'dist-validation/pr163/center';
const baseline = process.env.AIM_CENTER_BASELINE === '1';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5194, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const results = [];
try {
  for (const width of [844, 640]) {
    const page = await browser.newPage({ viewport: { width, height: width === 844 ? 390 : 360 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5194/e2e/structure-fixture.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    const result = await page.evaluate(async () => {
      const meta = document.createElement('meta'); meta.name = 'viewport'; meta.content = 'width=device-width,initial-scale=1'; document.head.append(meta);
      await import('/src/style.css');
      const T = await import('/node_modules/three/build/three.module.js');
      const { Renderer } = await import('/src/client/render.ts');
      const { CombatEffects } = await import('/src/client/combat-effects.ts');
      const g = await import('/src/shared/game.ts');
      const { STARTERS } = await import('/src/shared/defs.ts');
      const { mapFor } = await import('/src/shared/stages.ts');
      const canvas = document.createElement('canvas'); canvas.id = 'game';
      const hud = document.createElement('div'); hud.id = 'hud';
      hud.innerHTML = '<div class="crosshair"></div><div id="scope-overlay"><span>倍率</span></div>';
      const damage = document.createElement('div'); damage.id = 'damage';
      document.body.append(canvas, hud, damage);
      const view = new Renderer(canvas);
      window.aimCenterFixture = { view, canvas, hud };
      const w = g.createWorld('pr163', 42), p = g.addPlayer(w, 'p', [STARTERS[2], STARTERS[0]]);
      w.phase = 'battle'; p.x = p.z = 0; p.y = 20;
      const rows = [];
      // Actual authoritative shot and Renderer; no replacement camera or shot math.
      for (const pitch of [0, .5, 80 * Math.PI / 180]) for (const distance of [8, 35, 60]) for (const scoped of [false, true]) {
        w.enemies = []; w.projectiles = []; w.events = []; p.cool = 0; p.ammo[0] = 2;
        const input = { ...g.neutral(), cameraAim: true, pitch };
        const { camera, direction: d } = g.aimCamera(p, input, mapFor(w).blocks);
        g.spawn(w, 'crawler', camera.x + d.x * distance, camera.z + d.z * distance);
        const e = w.enemies[0]; e.y = camera.y + d.y * distance - (g.eye(e) - e.y);
        const shot = g.cameraShot(w, p, input); g.fire(w, p, input);
        view.render(w, 'p', 0, 0, pitch, undefined, false, scoped, false, false); view.camera.updateMatrixWorld(true);
        const point = new T.Vector3(shot.target.x, shot.target.y, shot.target.z).project(view.camera);
        const q = w.projectiles[0], len = Math.hypot(shot.target.x-p.x, shot.target.y-21.5, shot.target.z-p.z);
        const ray = new T.Vector3(p.x+q.dx/28*len,21.5+q.dy/28*len,p.z+q.dz/28*len).project(view.camera);
        rows.push({pitch,distance,scoped,targetError:Math.hypot(point.x*innerWidth/2,point.y*innerHeight/2),rayError:Math.hypot(ray.x*innerWidth/2,ray.y*innerHeight/2),surfaceDistance:Math.hypot(shot.target.x-e.x,shot.target.y-g.eye(e),shot.target.z-e.z),fov:view.camera.fov});
      }
      const fx = new CombatEffects(new T.Scene());
      fx.event({id:1,type:'shot',weapon:'rifle',x:0,y:1.5,z:0,tx:0,ty:1.5,tz:-30});
      const bullet = fx.items.find(e=>e.kind==='bullet'); bullet.mesh.geometry.computeBoundingBox();
      const size = bullet.mesh.geometry.boundingBox.getSize(new T.Vector3()).toArray(); fx.update(.05);
      const bulletZ = bullet.mesh.position.z; fx.clear();
      view.render(w,'p',0,0,0);
      return {rows, bullet:{size,zAfter50ms:bulletZ}};
    });
    for (const mismatch of [false, true]) {
      const centers = await page.evaluate(mismatch => {
        const { canvas, hud } = window.aimCenterFixture;
        hud.style.height = mismatch ? `${innerHeight + 65}px` : '100dvh';
        const c=canvas.getBoundingClientRect(), h=document.querySelector('.crosshair').getBoundingClientRect();
        const o=document.querySelector('#scope-overlay'), r=o.getBoundingClientRect(), s=getComputedStyle(o,'::before');
        return {canvas:[c.x+c.width/2,c.y+c.height/2],crosshair:[h.x+h.width/2,h.y+h.height/2],scope:[r.x+parseFloat(s.left),r.y+parseFloat(s.top)],hudHeight:hud.getBoundingClientRect().height};
      }, mismatch);
      for (const key of ['crosshair','scope']) for(let i=0;i<2;i++) {
        const expectedOffset=baseline && mismatch && key==='crosshair' && i===1 ? 32.5 : 0;
        assert.ok(Math.abs(centers[key][i]-centers.canvas[i]-expectedOffset)<1,JSON.stringify({width,mismatch,centers}));
      }
      result[mismatch?'tallHud':'normalHud']=centers;
      await page.screenshot({path:`${out}/${width}-${mismatch?'tall':'normal'}.png`});
    }
    // Resize via the real browser, then independently exercise visualViewport's listener.
    await page.setViewportSize({width:width-40,height:320});
    result.resized = await page.evaluate(async()=>{
      window.visualViewport.dispatchEvent(new Event('resize'));
      await new Promise(r=>requestAnimationFrame(r));
      const {canvas}=window.aimCenterFixture, c=canvas.getBoundingClientRect(), h=document.querySelector('.crosshair').getBoundingClientRect();
      return {canvas:[c.x+c.width/2,c.y+c.height/2],crosshair:[h.x+h.width/2,h.y+h.height/2]};
    });
    if(!baseline) for(let i=0;i<2;i++) assert.ok(Math.abs(result.resized.canvas[i]-result.resized.crosshair[i])<1);
    assert.ok(result.rows.every(r=>r.targetError<2 && r.rayError<2));
    assert.equal(result.bullet.zAfter50ms,-6);
    assert.ok(result.bullet.size[1]<1 && result.bullet.size[0]<(baseline?.131:.081));
    assert.deepEqual(errors,[]);
    results.push({width,...result,errors}); await page.close();
  }
  writeFileSync(`${out}/result.json`,JSON.stringify({scope:'actual Renderer and authoritative fire; synthetic tall HUD and visualViewport event, not physical Android',results},null,2));
  console.log(JSON.stringify(results.map(r=>({width:r.width,maxRayError:Math.max(...r.rows.map(x=>x.rayError)),bullet:r.bullet,errors:r.errors}))));
} finally { await browser.close(); await server.close(); }
