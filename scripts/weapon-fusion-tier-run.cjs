const old=require('../dist-validation/fusion-tier-original.cjs'),proto=require('../dist-validation/fusion-tier-proto.cjs');
const assert=require('assert');
const strip=w=>{const x=structuredClone(w);delete x.appearanceTier;return x};
const results=[];
for(const [type,max] of [['new',4],['old',3]])for(let tier=0;tier<=max;tier++){
 const a=old.runCase(type,tier),b=proto.runCase(type,tier);
 assert.equal(b.oldTier,b.tierAfter);
 assert.equal(b.projected.appearanceTier,b.oldTier);
 assert(b.keyDiffers);
 assert.deepStrictEqual(strip(b.projected),a.projected);
 assert.deepStrictEqual(b.stats,a.stats);
 for(const p of b.packets){
   assert(p.restored&&p.full&&p.shortDecode&&p.shortRestored);
   assert.equal(p.encoded.appearanceTier,b.oldTier);
   assert.equal(p.afterCached.appearanceTier,b.oldTier);
   assert.deepStrictEqual(p.encoded,b.projected);
   // Existing decoder runs unmodified from the original bundle.
   const oldPacket=JSON.parse(p.raw);assert(old.restoreStateTuples(oldPacket));
   const oldCache=new old.EquipmentCache();assert(oldCache.restore(oldPacket.world,false));
   assert.deepStrictEqual(oldPacket.world.players[0].weapons[0],p.encoded);
   assert.equal(old.weaponTier(p.encoded),a.tierAfter);
   assert.deepStrictEqual(old.stats(p.encoded),a.stats);
 }
 results.push({type,tier,before:a.oldTier,oldAfter:a.tierAfter,newAfter:b.tierAfter,packetModes:b.packets.map(p=>p.tuple)});
}
const n=old.runCase('new',0),o=old.runCase('old',0);
assert.deepStrictEqual(n.projected,o.projected);
assert.notEqual(n.oldTier,o.oldTier);
const spoof={...n.projected,appearanceTier:7};assert.equal(proto.weaponTier(spoof),old.weaponTier(n.projected));
const untrusted={...proto.makeWeapon('spoof','slug',0,{power:0,reload:0,range:0,rate:0},false,1),appearanceTier:4};
assert(proto.validBattleWeapon(untrusted));assert.equal(proto.weaponTier(untrusted),4);
console.log(JSON.stringify({cases:results,collision:{oldTier:o.oldTier,newTier:n.oldTier,projected:n.projected},malformedFallback:true,untrustedFieldAccepted:true},null,2));
