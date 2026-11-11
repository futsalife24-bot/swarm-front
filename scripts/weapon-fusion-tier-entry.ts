import { createFrontRun, chooseFrontUpgrade } from '../src/shared/front-run';
import { makeWeapon, weaponTier } from '../src/shared/progression';
import { stats, validBattleWeapon } from '../src/shared/defs';
import { prepareState, EquipmentCache } from '../src/shared/state-wire';
import { restoreStateTuples } from '../src/shared/state-tuples';
const variance={power:0,reload:0,range:0,rate:0};
export function runCase(type:'new'|'old',tier:number) {
  const first=type==='new'?makeWeapon('one','slug',tier,variance,false,1):{id:'one',kind:'slug',rarity:tier,power:1,effect:'none'} as any;
  const second=makeWeapon('two','rifle',0,variance,false,1);
  if(!validBattleWeapon(first)) throw new Error('invalid fixture');
  const run=createFrontRun({runId:'tier-proto',seed:1,fusion:true,mode:'defense',players:[{id:'p',equipment:[first,second]}]});
  const original=run.world.players[0].weapons[0], oldTier=weaponTier(original);
  const offer=run.upgrades.p.offer!;
  const ok=chooseFrontUpgrade(run,'p',{runId:'tier-proto',offerId:offer.id,revision:offer.revision,requestId:'one',cardId:offer.defaultCardId});
  if(!ok)throw Error('selection failed');
  const projected=run.world.players[0].weapons[0], base=stats(projected);
  const prepare=prepareState(run.world,0,{members:[],stage:1});
  const without=structuredClone(run.world);delete (without.players[0].weapons[0] as any).appearanceTier;
  const keyDiffers=prepare.equipmentKey!==prepareState(without,0,{members:[],stage:1}).equipmentKey;
  const packets=[];
  for (const tuple of [0,1,2]) {
    const packet=JSON.parse(prepare.packet('p',false,-1,undefined,true,tuple!==0,false,false,tuple===1?1:2));
    const raw=JSON.stringify(packet),encoded=packet.world.players[0].weapons[0];
    const restored=restoreStateTuples(packet);
    const cache=new EquipmentCache(), full=cache.restore(packet.world,false);
    const short=JSON.parse(prepare.packet('p',true,-1,undefined,true,tuple!==0,false,false,tuple===1?1:2));
    const shortDecode=restoreStateTuples(short), shortRestored=cache.restore(short.world,true);
    packets.push({tuple,raw,encoded,restored,full,shortDecode,shortRestored,afterCached:short.world.players[0].weapons[0]});
  }
  return {type,tier,oldTier,projected,tierAfter:weaponTier(projected),stats:base,packets,keyDiffers};
}
export {weaponTier,stats,restoreStateTuples,EquipmentCache,validBattleWeapon,makeWeapon};
