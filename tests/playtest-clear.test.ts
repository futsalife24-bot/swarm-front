import {it,expect} from 'vitest';
import fs from 'node:fs';
import {createWorld,addPlayer,start,step} from '../src/shared/game';
import {initSolo,useMedkit,maxHp} from '../src/shared/solo-progression';
import {makeWeapon,settings,type Difficulty} from '../src/shared/progression';
import {blankLevels} from '../src/client/progression-save';
import {pilot} from './bot';
const targets=process.env.PLAYTEST_ALL==='1'?Array.from({length:21},(_,i)=>i+1):[1,2,3,21];
const records:unknown[]=[];
it.each(targets.flatMap(stage=>['normal','medium'].map(d=>({stage,difficulty:d as Difficulty}))))('legal solo loop $stage $difficulty',({stage,difficulty})=>{
 const w=createWorld(`clear-${stage}-${difficulty}`,814,stage===21?3:stage),levels=blankLevels();
 const earned=(stage===21?3:stage)-1;levels.hp=earned>=15?4:earned>=5?2:earned>=1?1:0;levels.move=earned>=6?2:earned>=2?1:0;
 initSolo(w,stage,difficulty,false,levels);
 const rarity=stage===21?difficulty==='normal'?1:2:difficulty==='normal'?(stage<=5?stage===1?0:1:stage<=10?2:3):stage<=5?1:3;
 const gear=['rifle','shotgun'].map((kind,i)=>makeWeapon(`gear-${i}`,kind as 'rifle',rarity,{power:stage===1&&difficulty==='normal'?0:6,reload:6,range:6,rate:6},false,i));
 const p=addPlayer(w,'solo',gear);p.hp=maxHp(w);start(w);let peak=0;
 for(let n=0;n<36000&&w.phase==='battle'&&p.hp>0;n++){if(p.hp<maxHp(w)*.6)useMedkit(w);const before=structuredClone(p);step(w,{solo:pilot(w,'solo')});if(p.hp<=0)fs.writeFileSync('dist-validation/playtest-v1/death.json',JSON.stringify({before,world:w},null,2));peak=Math.max(peak,w.enemies.length);}
 const record={stage,difficulty,time:w.time,phase:w.phase,hp:p.hp,kills:w.totalKills,peak,target:settings(stage,difficulty).timeLimit,medkitUsed:!w.solo!.medkit};records.push(record);fs.mkdirSync('dist-validation/playtest-v1',{recursive:true});fs.writeFileSync('dist-validation/playtest-v1/clear-sweep.json',JSON.stringify(records,null,2));console.log(JSON.stringify(record));expect(p.hp).toBeGreaterThan(0);expect(w.phase).toBe('victory');expect(peak).toBeLessThan(settings(stage,difficulty).enemyCap);expect(w.time).toBeLessThanOrEqual(settings(stage,difficulty).timeLimit);
});
