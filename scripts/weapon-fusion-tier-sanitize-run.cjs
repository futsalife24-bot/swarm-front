const assert=require('assert'),old=require('../dist-validation/fusion-tier-original.cjs'),safe=require('../dist-validation/fusion-tier-sanitize.cjs');
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
   const packet=JSON.parse(p.raw);assert(old.restoreStateTuples(packet));
   const cache=new old.EquipmentCache();assert(cache.restore(packet.world,false));
   assert.deepStrictEqual(packet.world.players[0].weapons[0],p.weapon);assert.deepStrictEqual(old.stats(p.weapon),a.stats);
  }
  await safe.loadProgressionWeapons([b.projected]);outcomes.push({type,tier,visual:b.visualTier,unchangedStats:true,packetModes:b.packets.map(p=>p.t)});
 }
 assert.deepStrictEqual(urls,[0,1,2,3,4].map(x=>`/assets/weapons/unique-v1/slug_${x}.glb`));
 const real=safe.makeWeapon('one','slug',0,{power:0,reload:0,range:0,rate:0},false,1),other=safe.makeWeapon('two','rifle',0,{power:0,reload:0,range:0,rate:0},false,1);
 const oldSave={id:'old',kind:'slug',rarity:0,power:1,effect:'none'};
 const spoofResults=[];
 for(const w of [real,oldSave])for(const fake of [4,0,9,'4',null,undefined]){
  const input={...w,appearanceTier:fake},snapshot=structuredClone(input);
  assert.equal(safe.validBattleWeapon(input),old.validBattleWeapon(input));assert(safe.validBattleWeapon(input));
  const actor=safe.addPlayer(safe.createWorld('direct-test'),'p',[input,other]);
  assert(!('appearanceTier' in actor.weapons[0]));assert.deepStrictEqual(input,snapshot);assert.deepStrictEqual(safe.stats(actor.weapons[0]),safe.stats(input));
  const run=safe.createFrontRun({runId:'front-test',seed:1,fusion:true,mode:'defense',players:[{id:'p',equipment:[input,other]}]});
  const initial=run.world.players[0].weapons[0];assert(!('appearanceTier' in initial));assert.equal(safe.weaponVisualTier(initial),safe.weaponTier(input));
  const offer=run.upgrades.p.offer;
  assert(safe.chooseFrontUpgrade(run,'p',{runId:'front-test',offerId:offer.id,revision:offer.revision,requestId:'one',cardId:offer.defaultCardId}));
  const projected=run.world.players[0].weapons[0];assert.equal(projected.appearanceTier,safe.weaponTier(input));
  spoofResults.push({type:w===real?'new':'old',fake:fake===undefined?'undefined':fake,accepted:true,stripped:true,canonical:projected.appearanceTier});
 }
 const invalids=[null,{}, {...real,id:''}, {...real,power:2}, {...oldSave,rarity:9}];
 for(const input of invalids)assert.equal(safe.validBattleWeapon(input),old.validBattleWeapon(input));
 console.log(JSON.stringify({cases:outcomes,urls,spoofResults,invalidValidationUnchanged:true},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
