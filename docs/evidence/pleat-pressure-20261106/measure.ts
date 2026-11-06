import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { addPlayer, blocked, createWorld, neutral, spawn, start, step } from '../../../src/shared/game.ts';
import { LIMITS } from '../../../src/shared/defs.ts';
import { mapFor } from '../../../src/shared/stages.ts';
import { pleatGaitSpeed } from '../../../src/shared/pleat-gait.ts';
it('現在の歩行・方向転換・回避を同じ配置で比較',()=>{
const results=[];
for(const count of (process.env.QUICK ? [24] : [24,48,96])) for(const mode of (process.env.QUICK ? ['walk','react'] : ['walk','turn','dodge','react','still'])){
LIMITS.enemies=Math.max(LIMITS.enemies,count+1);
const w=createWorld('pleat-load',11,1),p=addPlayer(w,'p');start(w);w.nextSpawn=1e9;w.enemies=[];p.hp=1e6;p.x=0;p.z=0;
const blocks=mapFor(w).blocks;
for(let ring=0;w.enemies.length<count&&ring<40;ring++)for(let k=0;k<24&&w.enemies.length<count;k++){
const a=k/24*Math.PI*2+ring*.37,r=14+ring*2,x=Math.sin(a)*r,z=Math.cos(a)*r;
if(!blocked(x,z,2.5,0,blocks)){spawn(w,'crawler',x,z);w.enemies.at(-1)!.active=true;}}
let reactUntil=0,reactX=0,reactZ=0; let hits=0,firstHit=null,lastHp=p.hp,minDistance=1e9,lungeFrames=0,windFrames=0;
for(let tick=0;tick<1200;tick++){
const angle=tick*.05*(mode==='turn'&&(Math.floor(tick/80)%2)?-1:1);
let mx=mode==='still'?0:Math.cos(angle),mz=mode==='still'?0:Math.sin(angle),dodge=mode==='dodge'&&tick%60===0;
if(mode==='react'){
 const danger=w.enemies.filter(e=>e.wind>0&&e.wind<=.4&&Math.hypot(e.x-p.x,e.z-p.z)<8).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
 if(danger&&w.time>=reactUntil){const dx=danger.tx-danger.x,dz=danger.tz-danger.z,n=Math.max(.001,Math.hypot(dx,dz)),sign=((p.x-danger.x)*dz-(p.z-danger.z)*dx)>=0?1:-1;reactX=dz/n*sign;reactZ=dx/n*sign;reactUntil=w.time+.7;dodge=true;}
 if(w.time<reactUntil){mx=reactX;mz=reactZ;}
}
step(w,{[p.id]:{...neutral(),mx,mz,dodge,seq:tick}});
if(p.hp<lastHp){hits++;firstHit??=w.time;}lastHp=p.hp;
for(const e of w.enemies){minDistance=Math.min(minDistance,Math.hypot(e.x-p.x,e.z-p.z));if(e.lunge>0)lungeFrames++;if(e.wind>0)windFrames++;}
if(tick===399||tick===1199)results.push({count,mode,seconds:tick===399?20:60,hits,firstHit,damage:1e6-p.hp,minDistance,lungeFrames,windFrames});
}
}
const speeds=[1,1.5,2.25,3].map(scale=>({scale,normal:pleatGaitSpeed(scale,5.25),lunge:pleatGaitSpeed(scale,11.55)}));
expect(results.length).toBe(process.env.QUICK?4:30);writeFileSync('dist-validation/balance-20261106/current.json',JSON.stringify({seed:11,stage:1,initialHp:1e6,results,speeds},null,2));
console.log(JSON.stringify({results,speeds}));
});





