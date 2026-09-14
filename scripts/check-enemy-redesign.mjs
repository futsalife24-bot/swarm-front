import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.env.REDESIGN_URL||'http://127.0.0.1:5207';
const out='dist-validation/enemy-redesign';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:760},serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/assets/blender/candidates/reference-redesign-v1/review.html');await page.waitForFunction(()=>window.redesign?.ready);
 const metrics=[];
 for(const kind of process.env.REDESIGN_UI_ONLY ? [] : ['pleat','leaper']){
  for(const variant of ['old','new']){
   await page.evaluate(async({kind,variant})=>await window.redesign.select(kind,variant),{kind,variant});
   for(const view of ['oblique','front','side','back']){
    await page.evaluate(view=>{window.redesign.view(view);window.redesign.draw(0)},view);
    await page.screenshot({path:`${out}/${kind}-${variant}-${view}.png`});
   }
  }
  const result=await page.evaluate(()=>{
   const h=window.redesign,{T}=h,a=h.asset;
   const mixer=new T.AnimationMixer(a.model),results=[];
   const points=()=>{a.model.updateMatrixWorld(true);const output=[];for(const m of a.meshes){m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i++){const p=new T.Vector3().fromBufferAttribute(m.geometry.attributes.position,i);m.applyBoneTransform(i,p);p.applyMatrix4(m.matrixWorld);output.push(p)}}return output};
   for(const clip of a.clips){
    mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(0);const first=points();let minY=Infinity,maxDelta=0;
    for(let f=0;f<=Math.round(clip.duration*30);f++){mixer.setTime(f/30);const ps=points();for(let i=0;i<ps.length;i++){if(!Number.isFinite(ps[i].lengthSq()))throw Error('Non-finite mesh');minY=Math.min(minY,ps[i].y);maxDelta=Math.max(maxDelta,ps[i].distanceTo(first[i]))}}
    mixer.setTime(clip.duration);const last=points();let seam=0;last.forEach((p,i)=>seam=Math.max(seam,p.distanceTo(first[i])));
    results.push({clip:clip.name,duration:clip.duration,minY,maxDelta,seam});
   }
   mixer.stopAllAction();mixer.uncacheRoot(a.model);
   const load=[];h.setClip('Locomotion');for(const count of [1,10,40]){h.setCount(count);h.draw(.25);load.push({count,calls:h.renderer.info.render.calls,triangles:h.renderer.info.render.triangles})}h.setCount(1);
   return {results,load,bones:a.bones,meshes:a.meshes.length};
  });
  metrics.push({kind,...result});
  for(const clip of result.results){assert.ok(clip.minY>-.04,`${kind} ${clip.clip} floor ${clip.minY}`);assert.ok(clip.maxDelta>.01);assert.ok(clip.seam<.001,`${kind} loop ${clip.seam}`)}
  assert.equal(result.meshes,4);assert.equal(result.bones,20);assert.equal(result.load[0].calls,result.load[2].calls);
  for(const [clip,time] of [['Locomotion',.22],['Lunge',.3],['Lunge',.48]]){
   await page.evaluate(({clip,time})=>{const h=window.redesign;h.setClip(clip);h.view();h.draw(time)},{clip,time});await page.screenshot({path:`${out}/${kind}-${clip}-${time}.png`});
  }
 }
 if(metrics.length)writeFileSync(`${out}/model-checks.json`,JSON.stringify({metrics,errors},null,2));
 await page.goto(base);
 await page.getByRole('button',{name:'エネミーレポート',exact:true}).click();
 const viewport=page.locator('.enemy-viewport');
 const ui=[];
 for(const size of [{width:1280,height:800},{width:915,height:412}]){
  await page.setViewportSize(size);
  for(const kind of ['crawler','ant','spider','spitter','hornet','boss','worm']){
   if(kind==='worm')await page.locator('[data-worm="true"]').click();
   else await page.locator(`[data-enemy="${kind}"]`).click();
   await page.waitForFunction(()=>document.querySelector('.enemy-viewport').dataset.asset==='ready');
   for(const mode of ['move','attack','idle']){
    await page.locator(`button[data-motion="${mode}"]`).click();
    await page.waitForTimeout(mode==='idle'?80:650);
    assert.equal(await viewport.getAttribute('data-motion'),mode);
    assert.equal(await page.locator(`button[data-motion="${mode}"]`).getAttribute('aria-pressed'),'true');
    const before=await page.locator('.enemy-viewport canvas').screenshot();
    await page.waitForTimeout(350);
    const after=await page.locator('.enemy-viewport canvas').screenshot();
    assert.equal(before.equals(after),mode==='idle',`${kind} ${mode} rendered frame change`);
    if(mode!=='idle')await page.screenshot({path:`${out}/report-${size.width}-${kind}-${mode}.png`});
   }
   const visible=await page.locator('.report-playback').evaluate(el=>{const b=el.getBoundingClientRect(),canvas=document.querySelector('.enemy-viewport').getBoundingClientRect();return {inside:b.x>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,canvasHeight:canvas.height}});
   assert.ok(visible.inside);assert.ok(visible.canvasHeight>=80);ui.push({size,kind,...visible});
  }
 }
 // Rapid changes invalidate old asynchronous loads and closing cancels the loop.
 await page.locator('[data-enemy="spider"]').click();await page.locator('[data-enemy="crawler"]').click();
 await page.waitForFunction(()=>document.querySelector('.enemy-viewport').dataset.asset==='ready');
 await page.locator('button[data-motion="attack"]').click();await page.locator('#report-close').click();await page.waitForTimeout(200);
 assert.equal(await page.locator('.enemy-viewport canvas').count(),0);
 assert.deepEqual(errors,[]);
 writeFileSync(`${out}/ui-checks.json`,JSON.stringify({pass:true,ui,errors},null,2));
 console.log(JSON.stringify({pass:true,models:metrics,uiConditions:ui.length,errors}));
}finally{await browser.close()}
