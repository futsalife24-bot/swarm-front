import { it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { KINDS, WEAPONS, stats } from "../src/shared/defs";
import { createWorld, addPlayer, spawn, fire, step, neutral, eye } from "../src/shared/game";
import { makeWeapon, COSTS, ACCESSORY_VALUES, SWAP_TIMES } from "../src/shared/progression";
import { initSolo, maxHp, pickupRadius, recoveryWait, switchTime, collectSolo } from "../src/shared/solo-progression";
import { STAGES, HARROW_BRANCH } from "../src/shared/stages";

it("measures support, long range, aim tolerance and reachable growth",()=>{
  const healing=[];
  for(const seed of [814,723,20260927]) for(const distance of [6,20,45]) for(const offset of [0,0.04,0.09]) {
    const w=createWorld("support",seed); w.training=true;
    const item=makeWeapon("medic","medic",0,{power:0,reload:0,range:0,rate:0},false,0);
    const p=addPlayer(w,"p",[item,item]), ally=addPlayer(w,"ally");
    Object.assign(p,{x:0,z:0,y:0}); Object.assign(ally,{x:0,z:-distance,y:0,hp:1});
    fire(w,p,{...neutral(),fire:true,yaw:offset,pitch:Math.atan2(-0.3,distance)});
    healing.push({seed,distance,offset,healed:ally.hp-1});
  }
  expect(healing.find(r=>r.distance===6&&r.offset===0)!.healed).toBeGreaterThan(0);
  const accuracy=[];
  for(const kind of KINDS.filter(k=>!("speed" in WEAPONS[k])&&k!=="medic"))
    for(const seed of [814,723,20260927]) for(const distance of [6,20,45,90,130]) for(const offset of [0,0.04,0.09]) {
      const w=createWorld("accuracy",seed); w.training=true;
      const item=makeWeapon("accuracy",kind,0,{power:0,reload:0,range:0,rate:0},false,0);
      const p=addPlayer(w,"p",[item,item]); Object.assign(p,{x:0,z:0,y:0});
      const e=spawn(w,"ant",0,-distance)!; e.hp=10000;
      fire(w,p,{...neutral(),fire:true,yaw:offset,pitch:Math.atan2(eye(e)-1.5,distance)});
      accuracy.push({kind,seed,distance,offset,damage:10000-e.hp});
    }
  const growth=[];
  for(const skill of ["hp","aim","move","swap"] as const) for(let level=0;level<=5;level++) {
    const w=createWorld("growth");
    const skills={hp:0,aim:0,move:0,swap:0};skills[skill]=level;
    initSolo(w,1,"normal",false,skills);
    growth.push({skill,level,points:COSTS[level],incrementalCost:level?COSTS[level]-COSTS[level-1]:0,hp:maxHp(w),moveMultiplier:1+0.03*skills.move,aimCone:0.065*(1+0.04*skills.aim),switchSeconds:switchTime(w),firstWins:Math.ceil(COSTS[level]/3)});
  }
  const accessories=[];
  for(const kind of ["pickup","healing","recovery"] as const) for(let rarity=1;rarity<=6;rarity++) {
    const w=createWorld("accessory");initSolo(w,1,"normal",false,{hp:0,aim:0,move:0,swap:0},{id:"a",kind,rarity,testData:false,locked:false});
    accessories.push({kind,rarity,pickupRadius:pickupRadius(w),recoveryWait:recoveryWait(w),healFraction:kind==="healing"?ACCESSORY_VALUES.healing[rarity]:0.2,rank1SynthesisUnits:Array.from({length:rarity-1},(_,i)=>i+2).reduce((a,b)=>a*b,1)});
  }
  const accessoryOperations=[];
  for(const kind of ["none","pickup","healing","recovery"] as const)for(const rarity of kind==="none"?[0]:[1,6]) {
    const w=createWorld("accessory-operation",814);w.training=true;w.phase="battle";w.wave=1;w.nextSpawn=1e9;
    initSolo(w,1,"normal",false,{hp:0,aim:0,move:0,swap:0},kind==="none"?undefined:{id:"a",kind,rarity,testData:false,locked:false});
    const p=addPlayer(w,"p");Object.assign(p,{x:0,z:0,y:0,hp:20});
    w.drops=[{id:"heal",type:"heal",owner:"p",x:3.1,z:0,weapon:p.weapons[0]}];collectSolo(w,p);
    const pickupAt3_1=w.drops.length===0;
    p.hp=20;w.drops=[{id:"heal",type:"heal",owner:"p",x:0,z:0,weapon:p.weapons[0]}];collectSolo(w,p);
    const healed=p.hp-20;p.hp=20;p.safe=0;let recoveryStarted:number|null=null;
    for(let tick=0;tick<140;tick++){step(w,{p:neutral()});if(p.hp>20)recoveryStarted??=w.time;}
    accessoryOperations.push({kind,rarity,pickupAt3_1,healed,recoveryStarted,hpAt7s:p.hp});
  }
  expect(accessoryOperations.find(r=>r.kind==="pickup")!.pickupAt3_1).toBe(true);
  expect(accessoryOperations.find(r=>r.kind==="none")!.pickupAt3_1).toBe(false);
  const ballistics=[];
  for(const kind of ["grenade","sticky"] as const) for(const seed of [814,723,20260927]) for(const rarity of [0,2,4]) for(const range of [-10,0,20]) {
    const w=createWorld("ballistics",seed); w.training=true; w.phase="battle";w.wave=1;w.nextSpawn=1e9;
    const item=makeWeapon("arc",kind,rarity,{power:0,reload:0,range,rate:0},false,0);
    const p=addPlayer(w,"p",[item,item]);Object.assign(p,{x:0,z:0,y:0});
    const e=spawn(w,"ant",80,80)!;e.cool=1e6;e.hp=1e6;
    fire(w,p,{...neutral(),fire:true,yaw:0,pitch:Math.PI/4});
    const initialLife=w.projectiles[0].life; let impactDistance:number|null=null;
    for(let tick=0;tick<400&&w.projectiles.length;tick++) {
      w.events=[];step(w,{p:neutral()});
      const burst=w.events.find(e=>e.type==="burst"&&e.weapon==="grenade");
      if(burst)impactDistance=Math.hypot(burst.x,burst.z);
    }
    ballistics.push({kind,seed,rarity,rangeVariance:range,displayedRange:stats(item).range,initialLife,impactDistance});
    expect(impactDistance).not.toBeNull();
  }
  const stages=[...STAGES,HARROW_BRANCH,STAGES[2]].map((s,i)=>({stage:i<25?i+1:i===25?"15-A":"3-A",name:s.name,hp:s.hp,damage:s.damage,waves:s.waves,mediumHp:s.hp*1.25,mediumDamage:s.damage*1.15}));
  mkdirSync("docs/evidence/balance-t7",{recursive:true});
  writeFileSync("docs/evidence/balance-t7/support.json",JSON.stringify({healing,accuracy,growth,accessories,stages,ballistics,accessoryOperations},null,2)+"\n");
});
