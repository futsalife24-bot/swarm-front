const assert=require('assert'),old=require('../dist-validation/fusion-tier-original.cjs'),safe=require('../dist-validation/fusion-tier-safe.cjs');
const strip=w=>{const x=structuredClone(w);delete x.appearanceTier;return x};
(async()=>{
 const outcomes=[],urls=[];
 safe.GLTFLoader.prototype.loadAsync=async url=>{urls.push(url);return {scene:new safe.T.Group()}};
 for(const [type,max] of [['new',4],['old',3]])for(let tier=0;tier<=max;tier++){
  const a=old.runCase(type,tier),b=safe.runCase(type,tier);
  assert.equal(b.oldTier,b.visualTier);assert.deepStrictEqual(strip(b.projected),a.projected);assert.deepStrictEqual(b.stats,a.stats);
  const standard=safe.makeWeapon('cmp','slug',b.oldTier,{power:0,reload:0,range:0,rate:0},false,1);
  assert.equal(b.color,safe.glowColor(standard));
  for(const p of b.packets){
   assert(p.decoded&&p.full&&p.shortDecode&&p.cached);assert.equal(p.weapon.appearanceTier,b.oldTier);
   const oldPacket=JSON.parse(p.raw);assert(old.restoreStateTuples(oldPacket));
   const cache=new old.EquipmentCache();assert(cache.restore(oldPacket.world,false));
   assert.deepStrictEqual(oldPacket.world.players[0].weapons[0],p.weapon);
   assert.deepStrictEqual(old.stats(p.weapon),a.stats);
  }
  await safe.loadProgressionWeapons([b.projected]);
  outcomes.push({type,tier,visual:b.visualTier,unchangedStats:true,color:b.color,packetModes:b.packets.map(p=>p.t)});
 }
 assert.deepStrictEqual(urls,['/assets/weapons/unique-v1/slug_0.glb','/assets/weapons/unique-v1/slug_1.glb','/assets/weapons/unique-v1/slug_2.glb','/assets/weapons/unique-v1/slug_3.glb','/assets/weapons/unique-v1/slug_4.glb']);
 const real=safe.makeWeapon('one','slug',0,{power:0,reload:0,range:0,rate:0},false,1),other=safe.makeWeapon('two','rifle',0,{power:0,reload:0,range:0,rate:0},false,1),spoof={...real,appearanceTier:4};
 assert(safe.validNewWeapon(spoof));assert(!safe.validBattleWeapon(spoof));
 assert.throws(()=>safe.createFrontRun({runId:'spoof',seed:1,fusion:true,mode:'defense',players:[{id:'p',equipment:[spoof,other]}]}));
 assert(!safe.validBattleWeapon({...real,appearanceTier:undefined}));
 const oldSave={id:'old',kind:'slug',rarity:0,power:1,effect:'none',appearanceTier:4};
 assert(safe.validWeapon(oldSave));assert(!safe.validBattleWeapon(oldSave));
 assert.equal(safe.weaponVisualTier({...real,appearanceTier:9}),safe.weaponTier(real));
 console.log(JSON.stringify({cases:outcomes,urls,spoofRejected:true,saveValidatorStillAcceptsUnknownProperty:true,oldSaveBattleRejected:true,invalidTierFallback:true},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
