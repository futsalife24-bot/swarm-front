from pathlib import Path
import subprocess

subprocess.run(['python', 'scripts/create-rocket-current.py'], check=True)
p = Path('dist-validation/rocket-current-collision.mjs')
s = p.read_text(encoding='utf-8')
s = s.replace("out='dist-validation/rocket-current-collision'", "out='dist-validation/rocket-grid-collision'")
s = s.replace('../dist-validation/rocket-current-collision/fixture.mjs', '../dist-validation/rocket-grid-collision/fixture.mjs')
start=s.index('const oldInstance=view.instance.bind(view), observed=new Map();')
end=s.index('const originalDraw=view.render.bind(view);', start)
current=r'''const oldInstance=view.instance.bind(view), observed=new Map(); let currentProbeSnapshot=null, probeRounds=[];
const gunGrids=new WeakMap(), cell=.05;
function cells(lo,hi,fn){for(let x=Math.floor(lo.x/cell);x<=Math.floor(hi.x/cell);x++)for(let y=Math.floor(lo.y/cell);y<=Math.floor(hi.y/cell);y++)for(let z=Math.floor(lo.z/cell);z<=Math.floor(hi.z/cell);z++)fn(x+','+y+','+z)}
function gridFor(gun){
 let grid=gunGrids.get(gun); if(grid)return grid;
 const begin=performance.now();gun.updateWorldMatrix(true,true);
 const inv=gun.matrixWorld.clone().invert(),triangles=[],map=new Map();
 gun.traverse(o=>{if(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo'||!o.geometry?.getAttribute('position'))return;
  triangles.push(...probeFaces(o.geometry,inv.clone().multiply(o.matrixWorld),o,false));});
 for(let i=0;i<triangles.length;i++)cells(triangles[i].lo,triangles[i].hi,k=>{let a=map.get(k);if(!a)map.set(k,a=[]);a.push(i)});
 grid={triangles,map,buildMs:performance.now()-begin,cellCount:map.size,entries:[...map.values()].reduce((n,x)=>n+x.length,0)};gunGrids.set(gun,grid);return grid;
}
function gridCheck(grid,gun,mesh,mat){
 const m=gun.matrixWorld.clone().invert().multiply(mesh.matrixWorld).multiply(mat);
 const faces=probeFaces(mesh.geometry,m,mesh,false);let hits=0,checks=0,visits=0;
 for(const p of faces){const ids=new Set();cells(p.lo,p.hi,k=>{for(const id of grid.map.get(k)??[])ids.add(id)});visits+=ids.size;
  for(const id of ids){const t=grid.triangles[id];if(t.hi.x<p.lo.x||t.lo.x>p.hi.x||t.hi.y<p.lo.y||t.lo.y>p.hi.y||t.hi.z<p.lo.z||t.lo.z>p.hi.z)continue;checks++;if(probeCross(t.q,p.q))hits++;}}
 return {hits,checks,visits};
}
view.instance=(mesh,i,x,y,z,sx,sy,sz,rx,ry)=>{
 const result=oldInstance(mesh,i,x,y,z,sx,sy,sz,rx,ry);
 if(mesh!==view.projectiles||!currentProbeSnapshot)return result;
 const q=probeRounds[i];
 if(!q?.rocket||q.family!=='rocket'||q.radius!==11||!q.owner)return result;
 const actor=view.players.get(q.owner),trooper=actor?.userData.trooper;
 const gun=trooper?.weapons.find(w=>w.parent?.name==='RightHandWeaponSocket');
 if(!actor?.visible||!gun)return result;
 const center=new T.Vector3(x,y,z), speed=new T.Vector3(q.dx,q.dy,q.dz), muzzle=trooper.muzzle();
 const begin=performance.now(),dist=new T.Box3().setFromObject(gun).distanceToPoint(center);
 if(!muzzle||speed.length()<1e-6||dist>.57){observed.set(q.owner+':'+q.id,{active:false});return result;}
 const buildStart=performance.now(),grid=gridFor(gun),buildCost=performance.now()-buildStart;
 const original=new T.Matrix4();mesh.getMatrixAt(i,original);
 const testStart=performance.now(),beforeResult=gridCheck(grid,gun,mesh,original),before=beforeResult.hits;
 let after=before,shrink=1,forward=0,afterResult=null;
 if(before){const axis=speed.clone().normalize(),along=center.clone().sub(muzzle).dot(axis),half=.65*.8506508;
  if(along>0&&along<half){shrink=(along+half)/(2*half);forward=(half-along)/2;
   oldInstance(mesh,i,x+axis.x*forward,y+axis.y*forward,z+axis.z*forward,sx,sy,sz*shrink,rx,ry);
   const trial=new T.Matrix4();mesh.getMatrixAt(i,trial);afterResult=gridCheck(grid,gun,mesh,trial);after=afterResult.hits;
   if(after){mesh.setMatrixAt(i,original);shrink=1;forward=0;}}
 }
 const queryMs=performance.now()-testStart,elapsed=performance.now()-begin;
 if(!window.rocketGridControls){
  const world=mesh.matrixWorld.clone().multiply(original),gunWorld=probeSceneFaces(gun,false),brute=probeIntersections(gunWorld,probeFaces(mesh.geometry,world,mesh,false));
  const far=original.clone();far.elements[12]+=100;const farResult=gridCheck(grid,gun,mesh,far);
  let tests=[];for(const n of [1,8,32]){const t=performance.now();for(let j=0;j<n;j++)gridCheck(grid,gun,mesh,original);tests.push({simulatedIdenticalBullets:n,ms:performance.now()-t});}
  window.rocketGridControls={bruteCrossings:brute.crossingPairs,gridCrossings:before,farCrossings:farResult.hits,stress:tests,buildMs:grid.buildMs,triangles:grid.triangles.length,gridCells:grid.cellCount,gridEntries:grid.entries};
 }
 const data={time:currentProbeSnapshot.time,id:q.id,owner:q.owner,radius:q.radius,before,after,scale:shrink,forward,elapsedMs:elapsed,queryMs,buildCostMs:buildCost,checks:beforeResult.checks,visits:beforeResult.visits,dist};
 (window.rocketCurrentSamples??=[]).push(data);
 observed.set(q.owner+':'+q.id,{active:shrink<1,plane:muzzle.clone(),last:data});
 if(shrink<1)window.rocketClipObservation={q:structuredClone(q),currentMuzzle:muzzle.toArray(),scale:shrink,forward,before,after,ms:elapsed};
 return result;
};
'''
s=s[:start]+current+s[end:]
s=s.replace('currentProbeSnapshot=args[0];watchRocketWorld();', "currentProbeSnapshot=args[0];probeRounds=currentProbeSnapshot?.projectiles.filter(p=>p.style!=='laser')??[];watchRocketWorld();")
s=s.replace('window.rocketFirstDraw.currentSamples=window.rocketCurrentSamples??[]', 'window.rocketFirstDraw.currentSamples=window.rocketCurrentSamples??[];window.rocketFirstDraw.gridControls=window.rocketGridControls??null')
Path('dist-validation/rocket-grid-collision.mjs').write_text(s,encoding='utf-8',newline='\n')
