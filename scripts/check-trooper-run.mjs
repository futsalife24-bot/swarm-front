import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir='dist-validation/trooper-run';mkdirSync(`${dir}/frames`,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:900,height:800}});
 await page.clock.install();await page.goto('http://127.0.0.1:5314/assets/blender/preview-trooper/');
 await page.waitForFunction(()=>window.trooperQA);await page.clock.pauseAt(new Date(Date.now()+200));
 const data=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {trooper:t}=trooperQA;const samples=[],v=new T.Vector3();
  for(let i=0;i<=120;i++){
   const phase=i/120;trooperQA.set('Run',phase*t.clips.get('Run').duration);
   let min=Infinity,max=-Infinity,left=Infinity,right=Infinity;
   t.model.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();const g=o.geometry;
    for(let k=0;k<g.attributes.position.count;k++){
     o.getVertexPosition(k,v).applyMatrix4(o.matrixWorld);min=Math.min(min,v.y);max=Math.max(max,v.y);
     if(g.attributes.skinWeight.getX(k)>.99){const name=o.skeleton.bones[g.attributes.skinIndex.getX(k)].name;if(name==='Foot_L')left=Math.min(left,v.y);if(name==='Foot_R')right=Math.min(right,v.y);}
    }
   }});
   const pos=n=>t.model.getObjectByName(n).getWorldPosition(new T.Vector3());
   const hip=pos('UpperLeg_R'),knee=pos('LowerLeg_R'),ankle=pos('Foot_R');
   const flexion=180-T.MathUtils.radToDeg(hip.clone().sub(knee).angleTo(ankle.clone().sub(knee)));
   samples.push({phase,min,max,left,right,hip:pos('Pelvis').y,flexion});
  }
  return samples;
 });
 writeFileSync(`${dir}/gait.json`,JSON.stringify(data,null,2));
 const summary={min:Math.min(...data.map(s=>s.min)),max:Math.max(...data.map(s=>s.max)),flight:data.filter(s=>s.left>.025&&s.right>.025).length/121,leftContact:data.filter(s=>s.left<.012).length/121,rightContact:data.filter(s=>s.right<.012).length/121,doubleSupport:data.filter(s=>s.left<.012&&s.right<.012).length,hipRange:Math.max(...data.map(s=>s.hip))-Math.min(...data.map(s=>s.hip)),maxKneeFlexion:Math.max(...data.map(s=>s.flexion))};
 console.log(summary);writeFileSync(`${dir}/gait-summary.json`,JSON.stringify(summary,null,2));
 // Save animation frames and a key-pose strip from the actual exported asset.
 await page.evaluate(()=>{document.querySelector('aside').style.display='none';trooperQA.view('side');});
 const frames=[];
 for(let i=0;i<40;i++){
  const image=await page.evaluate(i=>{const q=trooperQA;q.set('Run',i/40*q.trooper.clips.get('Run').duration);return q.renderer.domElement.toDataURL('image/png').split(',')[1];},i);
  writeFileSync(`${dir}/frames/${String(i).padStart(3,'0')}.png`,Buffer.from(image,'base64'));if([0,5,12,16,20,25,32,36].includes(i))frames.push(image);
 }
 await page.setContent(`<body style="margin:0;background:#293338;color:white;font:20px sans-serif"><div style="display:grid;grid-template-columns:repeat(4,300px)">${frames.map((im,i)=>`<div><img style="width:300px" src="data:image/png;base64,${im}"><p style="text-align:center">${['R contact','R compression','R push','Flight','L contact','L compression','L push','Flight'][i]}</p></div>`).join('')}</div></body>`);
 await page.setViewportSize({width:1200,height:660});await page.screenshot({path:`${dir}/key-poses.png`,fullPage:true});
 assert.ok(summary.min>-.008,'no substantial ground penetration');
 assert.ok(summary.flight>.20&&summary.flight<.55,'visible flight, not walking or floating');
 assert.equal(summary.doubleSupport,0,'no walking double support');
 assert.ok(summary.leftContact>.2&&summary.rightContact>.2,'alternating single-leg support');
 assert.ok(summary.hipRange>.14,'compression and bounce');
 assert.ok(summary.maxKneeFlexion>100,'fold heel toward hip during recovery');
 console.log('PASS: exported run has alternating support, flight, compression and knee recovery');
}finally{await browser.close();}
