import { createFrontRun, chooseFrontUpgrade } from '../src/shared/front-run';
import { makeWeapon, weaponTier } from '../src/shared/progression';
import { stats } from '../src/shared/defs';
for (let tier=0; tier<5; tier++) {
  const variance={power:0,reload:0,range:0,rate:0};
  const equipment=[makeWeapon('one','slug',tier,variance,false,1),makeWeapon('two','rifle',tier,variance,false,1)];
  const run=createFrontRun({runId:'tiercheck',seed:1,fusion:true,mode:'defense',players:[{id:'p',equipment}]});
  const before=run.world.players[0].weapons[0];
  const offer=run.upgrades.p.offer!;
  const ok=chooseFrontUpgrade(run,'p',{runId:'tiercheck',offerId:offer.id,revision:offer.revision,requestId:'one',cardId:offer.defaultCardId});
  const after=run.world.players[0].weapons[0];
  const pick=(w:typeof before)=>{const s=stats(w);return {tier:weaponTier(w),format:'format' in w?w.format:null,damage:s.damage,mag:s.mag,reload:s.reload,range:s.range,interval:s.interval}};
  console.log(JSON.stringify({tier,card:offer.defaultCardId,ok,before:pick(before),after:pick(after)}));
}
