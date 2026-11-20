from pathlib import Path

source = Path('scripts/rocket-visual-series.mjs').read_text(encoding='utf-8')
source = source.replace("out='dist-validation/rocket-visual-series'", "out='dist-validation/rocket-current-collision'")
source = source.replace("../dist-validation/rocket-visual-series/fixture.mjs", "../dist-validation/rocket-current-collision/fixture.mjs")
start = source.index('const oldInstance=view.instance.bind(view), observed=new Map();')
end = source.index('const originalDraw=view.render.bind(view);', start)
current = r'''const oldInstance=view.instance.bind(view), observed=new Map(); let currentProbeSnapshot=null;
view.instance=(mesh,i,x,y,z,sx,sy,sz,rx,ry)=>{
 const result=oldInstance(mesh,i,x,y,z,sx,sy,sz,rx,ry);
 if(mesh!==view.projectiles||!currentProbeSnapshot)return result;
 const q=currentProbeSnapshot.projectiles.filter(p=>p.style!=='laser')[i];
 if(!q?.rocket||q.family!=='rocket'||q.radius!==11||!q.owner)return result;
 const actor=view.players.get(q.owner),trooper=actor?.userData.trooper;
 const gun=trooper?.weapons.find(w=>w.parent?.name==='RightHandWeaponSocket');
 if(!actor?.visible||!gun)return result;
 const start=performance.now(),center=new T.Vector3(x,y,z), speed=new T.Vector3(q.dx,q.dy,q.dz), muzzle=trooper.muzzle();
 const dist=new T.Box3().setFromObject(gun).distanceToPoint(center);
 if(!muzzle||speed.length()<1e-6||dist>.57)return result;
 const original=new T.Matrix4();mesh.getMatrixAt(i,original);
 const weapon=probeSceneFaces(gun,false);
 const faces=()=>probeFaces(mesh.geometry,mesh.matrixWorld.clone().multiply((()=>{const m=new T.Matrix4();mesh.getMatrixAt(i,m);return m})()),mesh,false);
 const before=probeIntersections(weapon,faces()).crossingPairs;
 let after=before,shrink=1,forward=0;
 if(before){
  const axis=speed.normalize(),along=center.clone().sub(muzzle).dot(axis),half=.65*.8506508;
  if(along>0&&along<half){
   shrink=(along+half)/(2*half);forward=(half-along)/2;
   oldInstance(mesh,i,x+axis.x*forward,y+axis.y*forward,z+axis.z*forward,sx,sy,sz*shrink,rx,ry);
   after=probeIntersections(weapon,faces()).crossingPairs;
   if(after){mesh.setMatrixAt(i,original);shrink=1;forward=0;}
  }
 }
 const elapsed=performance.now()-start;
 const data={time:currentProbeSnapshot.time,id:q.id,owner:q.owner,radius:q.radius,before,after,scale:shrink,forward,ms:elapsed,dist};
 (window.rocketCurrentSamples??=[]).push(data);
 observed.set(q.owner+':'+q.id,{active:shrink<1,plane:muzzle.clone(),last:data});
 if(shrink<1)window.rocketClipObservation={q:structuredClone(q),currentMuzzle:muzzle.toArray(),scale:shrink,forward,before,after,ms:elapsed};
 return result;
};
'''
source = source[:start] + current + source[end:]
source = source.replace('plane:state?.plane?.toArray()??null', 'plane:state?.plane?.toArray()??null,detail:state?.last??null')
source = source.replace('await page.evaluate(()=>window.rocketFirstDraw.clipFrames=window.rocketClipFrames);', 'await page.evaluate(()=>{window.rocketFirstDraw.clipFrames=window.rocketClipFrames;window.rocketFirstDraw.currentSamples=window.rocketCurrentSamples??[]});')
Path('dist-validation/rocket-current-collision.mjs').write_text(source,encoding='utf-8',newline='\n')
