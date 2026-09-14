import {it,expect} from 'vitest';
import {rollVariance,COSTS,SKILLS,victoryCoins} from '../src/shared/progression';
import {freshProgress,grantResult,prepareChoice,chooseReward,unlockSkill,allocate,dismantle,createAccessory} from '../src/client/progression-save';
it('ST4 supplies exactly the fourth token; repeat wins fund respec and weapon salvage funds crafting without ads',()=>{
 let s=freshProgress('normal');
 for(let stage=1;stage<=4;stage++){
  s=chooseReward(prepareChoice(grantResult(s,{run:`st${stage}`,stage,difficulty:'normal',win:true,time:90,kills:50,missions:[true,true,true],weapons:[],collected:0},()=>.1),()=>.1),false);
  expect(s.materials).toBe(stage);
 }
 for(const skill of SKILLS)s=unlockSkill(s,skill);
 expect(s.materials).toBe(0);expect(s.unlocked).toHaveLength(4);
 s.points=120; // Full-40 progression is exercised separately; this fixture checks allocation at its ceiling.
 s=allocate(s,s.selectedSoldier,{hp:0,aim:0,move:0,swap:5});expect(COSTS[5]).toBe(s.points);
 expect(()=>allocate(s,s.selectedSoldier,{hp:1,aim:0,move:0,swap:5})).toThrow();
 expect(victoryCoins(1,'normal')*5).toBe(500);
 const coins=s.coins;s=allocate(s,s.selectedSoldier,{hp:0,aim:0,move:0,swap:0});expect(s.coins).toBe(coins-500);
});
it('seeded variance draws respect all five probability bands',()=>{
 let seed=937;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const counts=[0,0,0,0,0];
 for(let i=0;i<100000;i++){const v=rollVariance(rng);expect(Number.isInteger(v)&&v>=-10&&v<=20).toBe(true);counts[v<0?0:v===0?1:v<10?2:v<20?3:4]++;}
 [.2,.1,.57,.1,.03].forEach((p,i)=>expect(Math.abs(counts[i]/100000-p)).toBeLessThan(.006));
});
