import {build} from 'esbuild';import fs from 'node:fs';
fs.mkdirSync('dist-validation/balance-20261106',{recursive:true});
const contents=`import {createWorld,addPlayer,start,spawn,step,neutral,blocked} from '../../src/shared/game';
import {mapFor} from '../../src/shared/stages';
import {createBuddyBattleState,equipBattleBuddy} from '../../src/shared/buddy-combat';
import fs from 'node:fs';const results=[];
for(const [id,level] of [['none',1],...['tatara','yosuga','tobari','oriha'].flatMap(id=>[[id,1],[id,40]])]){
 const w=createWorld('buddy-pressure',11,1),p=addPlayer(w,'p');start(w);w.nextSpawn=1e9;w.enemies=[];p.x=0;p.z=0;p.hp=160;p.safe=0;
 if(id!=='none'){w.buddies=createBuddyBattleState(w);equipBattleBuddy(w.buddies,p,id,level);}
 const blocks=mapFor(w).blocks;
 for(let ring=0;w.enemies.length<24&&ring<40;ring++)for(let k=0;k<24&&w.enemies.length<24;k++){const a=k/24*Math.PI*2+ring*.37,r=14+ring*2,x=Math.sin(a)*r,z=Math.cos(a)*r;if(!blocked(x,z,2.5,0,blocks)){spawn(w,'crawler',x,z);w.enemies.at(-1).active=true;}}
 let activations=0,lastSkill=-1;
 for(let tick=0;tick<1200&&p.hp>0&&w.phase==='battle';tick++){step(w,{p:{...neutral(),mx:Math.cos(tick*.05),mz:Math.sin(tick*.05),buddySkill:tick%40===0,seq:tick}});const skill=w.buddies?.entries.p.lastSkillAt??-1;if(skill!==lastSkill){activations++;lastSkill=skill;}}
 results.push({id,level,time:w.time,hp:p.hp,kills:p.kills,activations,scope:'seed11・24体・歩行のみ・本人射撃なし・2秒ごとスキル入力の初期比較。人間の優劣評価ではない'});
}
fs.writeFileSync('dist-validation/balance-20261106/buddy-comparison.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));`;
await build({stdin:{contents,resolveDir:process.cwd()+'/dist-validation/balance-20261106',loader:'ts'},platform:'node',bundle:true,format:'esm',outfile:'dist-validation/balance-20261106/buddy-comparison.mjs'});
await import('../dist-validation/balance-20261106/buddy-comparison.mjs');

