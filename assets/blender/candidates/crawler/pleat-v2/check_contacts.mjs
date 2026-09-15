import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir='assets/blender/candidates/crawler/pleat-v2',base='http://127.0.0.1:5199';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage();await p.goto(base+'/'+dir+'/index.html');await p.waitForFunction(()=>window.houndMotion?.ready);await p.evaluate(()=>window.houndMotion.setPlaying(false));
 const report=await p.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),h=window.houndMotion,a=h.asset;
  const bones=a.meshes[0].skeleton.bones,mat=new T.Matrix4(),v=new T.Vector3(),out=new T.Vector3(),tmp=new T.Vector3();
  function point(mesh,i,r,frame){out.set(0,0,0);const g=mesh.geometry;v.fromBufferAttribute(g.attributes.position,i);
   for(let k=0;k<4;k++){const w=g.attributes.skinWeight.getComponent(i,k);if(!w)continue;const b=g.attributes.skinIndex.getComponent(i,k);mat.fromArray(a.atlas.image.data,((r.start+frame)*a.bones+b)*16);out.addScaledVector(tmp.copy(v).applyMatrix4(mat),w)}return out.clone();
  }
  const feet={};
  for(const name of ['fore_L_toe','fore_R_toe','hind_L_toe','hind_R_toe']){
   const index=bones.findIndex(b=>b.name===name);let chosen;
   for(const mesh of a.meshes){const g=mesh.geometry;for(let i=0;i<g.attributes.position.count;i++){
    if(g.attributes.skinIndex.getX(i)===index&&g.attributes.skinWeight.getX(i)>.999){const pos=point(mesh,i,a.ranges.Idle,0);if(!chosen||pos.y<chosen.pos.y)chosen={mesh,i,pos}}
   }}
   if(!chosen)throw new Error('Missing foot '+name);feet[name]=chosen;
  }
  let maximumStanceDrift=0,maximumVerticalContact=0;const perFoot={};
  for(const [i,[name,f]] of Object.entries(feet).entries()){
   let prev=null,max=0,samples=0;
   for(let frame=0;frame<=48;frame++){
    const t=frame/60,phase=(t/.8+[0,.5,.5,0][i])%1,pos=point(f.mesh,f.i,a.ranges.Locomotion,frame);
    pos.z-=.9*t; // In-place toe travel + authoritative nominal translation -Z.
    if(phase<.62){maximumVerticalContact=Math.max(maximumVerticalContact,Math.abs(pos.y));
     if(prev&&phase>prev.phase){const delta=pos.distanceTo(prev.pos);max=Math.max(max,delta);samples++}
     prev={phase,pos};
    }else prev=null;
   }
   maximumStanceDrift=Math.max(maximumStanceDrift,max);perFoot[name]={maxWorldStepDrift:max,samples};
  }
  // GLB mesh attributes are already Y-up: convert Blender (0,.96,.3) to (0,.3,-.96).
  // The palette applies animation to this exported rest-local point.
  const keel=bones.findIndex(b=>b.name==='keel'),r=a.ranges.Lunge;
  mat.fromArray(a.atlas.image.data,((r.start+27)*a.bones+keel)*16);
  const tip=new T.Vector3(0,.3,-.96).applyMatrix4(mat);
  const expected=new T.Vector3(0,.3,-1.25);
  const bnd={};
  for(const [name,range] of Object.entries(a.ranges)){
   const box=new T.Box3();let nonfinite=0;
   for(let frame=0;frame<=range.steps;frame++)for(const mesh of a.meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    const p=point(mesh,i,range,frame);if(!Number.isFinite(p.x+p.y+p.z))nonfinite++;else box.expandByPoint(p);
   }
   bnd[name]={min:box.min.toArray(),max:box.max.toArray(),nonfinite};
  }
  return {perFoot,maximumStanceDrift,maximumVerticalContact,impactTip:tip.toArray(),expected:expected.toArray(),impactError:tip.distanceTo(expected),all60fpsBounds:bnd};
 });
 writeFileSync(dir+'/validation/contact-validation.json',JSON.stringify(report,null,2));console.log(report);
 assert.ok(report.maximumStanceDrift<1e-4);assert.ok(report.maximumVerticalContact<1e-4);assert.ok(report.impactError<1e-4);
 assert.ok(Object.values(report.all60fpsBounds).every(v=>v.nonfinite===0&&v.min[1]>-1e-4));
}finally{await browser.close()}
