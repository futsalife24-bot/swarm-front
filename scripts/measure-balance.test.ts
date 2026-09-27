import { it, expect } from "vitest";
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { KINDS, WEAPONS, stats, ENEMIES, type Kind } from "../src/shared/defs";
import { makeWeapon, rarityWeights, settings, COSTS, ACCESSORY_VALUES, SWAP_TIMES, type Skill } from "../src/shared/progression";
import { createWorld, addPlayer, start, step, fire, neutral, spawn, eye, enemyBodies, type World, type Enemy } from "../src/shared/game";
import { initSolo, maxHp } from "../src/shared/solo-progression";
import { stageFor, STAGES, HARROW_BRANCH } from "../src/shared/stages";
import { normalSaveId, campaignNumber } from "../src/shared/campaign";
import { pilot } from "../tests/bot";

const zero = { power: 0, reload: 0, range: 0, rate: 0 };
const levels = (n: number): Record<Skill, number> => ({ hp: n, aim: n, move: n, swap: n });
const seeds = [814, 723, 20260927];
const conditions = [
  { id: "early", stage: 2, rarity: 0, skills: levels(0), seconds: 180 },
  { id: "middle", stage: 10, rarity: 1, skills: {hp:2,aim:1,move:1,swap:1}, seconds: 240 },
  { id: "late", stage: normalSaveId(23), rarity: 2, skills: {hp:3,aim:1,move:2,swap:1}, seconds: 300 },
  { id: "boss", stage: 27, rarity: 2, skills: {hp:2,aim:1,move:2,swap:1}, seconds: 300 },
  { id: "holdout", stage: 8, rarity: 1, skills: levels(1), seconds: 240 },
];
function weapon(kind: Kind, rarity: number) {
  return makeWeapon(`balance-${kind}`, kind, rarity, zero, false, 0);
}
function aim(w: World, kind: Kind, e: Enemy) {
  const p = w.players[0], body = enemyBodies(e)[0];
  const distance = Math.hypot(body.x - p.x, body.z - p.z);
  const rise = body.y - ((p.y ?? 0) + 1.5);
  let pitch = Math.atan2(rise, distance);
  const shape = WEAPONS[kind];
  if ("gravity" in shape) {
    const v2 = shape.speed ** 2, g = shape.gravity;
    const disc = v2 ** 2 - g * (g * distance ** 2 + 2 * rise * v2);
    if (disc >= 0) pitch = Math.atan((v2 - Math.sqrt(disc)) / (g * distance));
  }
  return { yaw: Math.atan2(body.x - p.x, -(body.z - p.z)), pitch };
}
function mission(c: typeof conditions[number], kind: Kind, seed: number, accessory?: "pickup" | "healing" | "recovery") {
  const w = createWorld(`balance-${c.id}-${kind}-${seed}`, seed, campaignNumber(c.stage));
  initSolo(w, c.stage, "normal", false, c.skills, accessory ? { id: "fixture", kind: accessory, rarity: 1, locked: false, testData: false } : undefined);
  const p = addPlayer(w, "p", [weapon(kind, c.rarity), {...weapon("rifle", c.rarity), id:"balance-secondary-rifle"}]);
  expect(new Set(p.weapons.map(a=>a.id)).size).toBe(2);
  p.hp = maxHp(w);
  start(w);
  let damage = 0, taken = 0, shots = 0, hitEvents = 0, bossFirst: number | null = null, bossLast: number | null = null;
  for (let tick = 0; tick < c.seconds * 20 && w.phase === "battle"; tick++) {
    const input = pilot(w, "p");
    // Keep the candidate slot fixed. The second legal slot is carried but unused.
    input.swap = false;
    // Existing pilot has no ballistic compensation. Apply the same geometric
    // low-arc solver used by the existing weapon test, without predictive lead.
    if (input.fire && "gravity" in WEAPONS[kind]) {
      const target = w.enemies.filter(e => e.hp > 0).sort((a,b) => Math.abs(Math.atan2(a.x-p.x,-(a.z-p.z))-input.yaw)-Math.abs(Math.atan2(b.x-p.x,-(b.z-p.z))-input.yaw))[0];
      if (target) input.pitch = aim(w, kind, target).pitch;
    }
    const hp = p.hp;
    w.events = [];
    step(w, { p: input });
    taken += Math.max(0, hp - p.hp); // net per-tick loss; healing may mask damage
    const events = w.events.filter(e => e.owner === "p");
    shots += events.filter(e => e.type === "shot").length / stats(p.weapons[0]).pellets;
    damage += events.filter(e => e.type === "hit").reduce((n,e) => n + (e.amount ?? 0), 0);
    hitEvents += events.filter(e => e.type === "hit").length;
    if (w.enemies.some(e => ["boss","harrow","worm"].includes(e.kind))) bossFirst ??= w.time;
    if (bossFirst !== null && !w.enemies.some(e => ["boss","harrow","worm"].includes(e.kind) && e.hp > 0)) bossLast ??= w.time;
  }
  return { condition: c.id, kind, seed, accessory: accessory ?? "none", phase: w.phase, seconds: w.time, clearTime: w.phase === "victory" ? w.time : null, hp: p.hp, survival: p.hp > 0, kills: w.totalKills, damageEventSum: damage, netDamageTaken: taken, rounds: shots, hitEvents, damagePerRound: shots ? damage/shots : 0, killsPerMinute: w.totalKills/w.time*60, bossTTK: bossFirst !== null && bossLast !== null ? bossLast-bossFirst : null };
}

// Controlled single-round collision assay, NOT a campaign or survival trial.
// Authored target sizes/armour and production fire/projectile code are retained;
// HP is enlarged and poses are held, to measure uncapped hit damage per round.
function rangeAssay(kind: Kind, seed: number, distance: number, group: boolean, enemyKind: keyof typeof ENEMIES) {
  const w = createWorld("range", seed, 1);
  w.training = true; w.phase = "battle"; w.wave = 1; w.nextSpawn = 1e9;
  const p = addPlayer(w, "p", [weapon(kind, 0), weapon("rifle", 0)]);
  p.x = 0; p.z = 0; p.y = 0;
  const targets = Array.from({length: group ? 5 : 1}, (_, j) => spawn(w, enemyKind, (j%3-1)*1.2*(group ? 1 : 0), -distance-Math.floor(j/3)*1.8)!);
  for (const e of targets) { e.hp = e.maxHp = 1e6; e.cool = 1e6; }
  const poses = targets.map(e => ({ x:e.x, z:e.z, y:e.y }));
  const before = targets.reduce((n,e)=>n+e.hp,0);
  fire(w,p,{...neutral(),fire:true,...aim(w,kind,targets[0])});
  let impacts = w.events.filter(e=>e.type==="hit").length;
  for (let tick=0; tick<160 && w.projectiles.length; tick++) {
    targets.forEach((e,j)=>Object.assign(e,poses[j],{cool:1e6}));
    w.events=[]; step(w,{p:neutral()});
    impacts += w.events.filter(e=>e.type==="hit").length;
  }
  return {kind,seed,distance,group,enemyKind,damage:before-targets.reduce((n,e)=>n+e.hp,0),impacts,recoilDistance:Math.hypot(p.x,p.z)};
}

it("records deterministic role comparisons without changing runtime", () => {
  const begin = performance.now();
  mkdirSync("dist-validation/balance",{recursive:true});
  writeFileSync("dist-validation/balance/progress.jsonl", "");
  for (const c of conditions) expect(Object.values(c.skills).reduce((n,v)=>n+COSTS[v],0)).toBeLessThanOrEqual(Math.min(120,(campaignNumber(c.stage)-(c.stage===27?0:1))*3));
  const catalog = KINDS.flatMap(kind=>[0,1,2,3,4].map(rarity=>{
    const s=stats(weapon(kind,rarity));
    return {kind,rarity,...s,rawPerRound:s.damage*s.pellets,idealCycleDps:s.damage*s.pellets*s.mag/(s.mag*s.interval+s.reload), obtainable: [1,6,11,18].map(stage=>({stage,normal:rarityWeights(stage,"normal")[rarity],medium:rarityWeights(stage,"medium")[rarity]}))};
  }));
  const results = [];
  for (const c of conditions) {
    for (const kind of KINDS) for (const seed of seeds) {
      const result = mission(c,kind,seed);
      results.push(result);
      appendFileSync("dist-validation/balance/progress.jsonl",JSON.stringify(result)+"\n");
    }
    console.log(`balance completed ${c.id}`);
  }
  const accessories = ["pickup","healing","recovery"].flatMap(accessory => seeds.map(seed=>mission(conditions[1],"rifle",seed,accessory as "pickup")));
  const ranges = KINDS.flatMap(kind=>seeds.flatMap(seed=>[6,20,45].flatMap(distance=>[false,true].map(group=>rangeAssay(kind,seed,distance,group,"ant")))));
  const affinities = KINDS.flatMap(kind=>seeds.flatMap(seed=>(Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]).filter(k=>!["boss","harrow"].includes(k)).map(enemy=>rangeAssay(kind,seed,20,false,enemy))));
  expect(mission(conditions[0],"rifle",seeds[0])).toEqual(results[0]);
  expect(results.every(r=>Number.isFinite(r.damageEventSum)&&Number.isFinite(r.seconds))).toBe(true);
  const out={ source:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(), seeds, conditions:conditions.map(c=>({...c,hp:160*(1+0.1*c.skills.hp),skills:c.skills,accessory:"none",weaponLevel:"not implemented",variance:zero,effect:"none",difficulty:"normal",plan: c.stage===27 ? HARROW_BRANCH : STAGES[campaignNumber(c.stage)-1],targetTime:c.seconds})),catalog,results,accessories,ranges,affinities,progression:{costs:COSTS,accessoryValues:ACCESSORY_VALUES,swapTimes:SWAP_TIMES},elapsedMs:performance.now()-begin };
  mkdirSync("docs/evidence/balance-t7",{recursive:true});
  writeFileSync("docs/evidence/balance-t7/baseline.json",JSON.stringify(out,null,2)+"\n");
},900000);

it("replays rifle fixtures with distinct inventory IDs",()=>{
  const path="docs/evidence/balance-t7/baseline.json";
  const b=JSON.parse(readFileSync(path,"utf8"));
  let replayed=0;
  for(const c of conditions)for(const seed of seeds) {
    const actual=mission(c,"rifle",seed);
    const old=b.results.find((r:any)=>r.kind==="rifle"&&r.condition===c.id&&r.seed===seed);
    expect(actual).toEqual(old); replayed++;
  }
  for(const accessory of ["pickup","healing","recovery"] as const)for(const seed of seeds) {
    expect(mission(conditions[1],"rifle",seed,accessory)).toEqual(b.accessories.find((r:any)=>r.accessory===accessory&&r.seed===seed));replayed++;
  }
  writeFileSync("docs/evidence/balance-t7/fixture-replay.json",JSON.stringify({replayed,passed:true,reason:"Distinct IDs for two separately attainable equal-stat rifles; all recorded combat metrics exactly equal."},null,2)+"\n");
},900000);
