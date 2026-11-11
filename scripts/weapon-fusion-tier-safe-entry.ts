import {createFrontRun,chooseFrontUpgrade} from '../src/shared/front-run';
import {makeWeapon,weaponTier,weaponVisualTier,validNewWeapon} from '../src/shared/progression';
import {stats,validBattleWeapon,validWeapon} from '../src/shared/defs';
import {prepareState,EquipmentCache} from '../src/shared/state-wire';
import {restoreStateTuples} from '../src/shared/state-tuples';
import {WeaponRarityGlow} from '../src/client/weapon-rarity-glow';
import {loadProgressionWeapons} from '../src/client/progression-weapons';
import {StandardTrooper} from '../src/client/standard-trooper';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const variance={power:0,reload:0,range:0,rate:0};
export function runCase(type:'new'|'old',tier:number){
 const first=type==='new'?makeWeapon('one','slug',tier,variance,false,1):{id:'one',kind:'slug',rarity:tier,power:1,effect:'none'} as any;
 const second=makeWeapon('two','rifle',0,variance,false,1);
 if(!validBattleWeapon(first))throw Error('valid input rejected');
 const run=createFrontRun({runId:'tier-proto',seed:1,fusion:true,mode:'defense',players:[{id:'p',equipment:[first,second]}]});
 const before=run.world.players[0].weapons[0],oldTier=weaponTier(before),offer=run.upgrades.p.offer!;
 if(!chooseFrontUpgrade(run,'p',{runId:'tier-proto',offerId:offer.id,revision:offer.revision,requestId:'one',cardId:offer.defaultCardId}))throw Error('selection');
 const projected=run.world.players[0].weapons[0],prepare=prepareState(run.world,0,{members:[],stage:1}),packets=[];
 const color=glowColor(projected);
 for(const t of [0,1,2]){
  const packet=JSON.parse(prepare.packet('p',false,-1,undefined,true,t!==0,false,false,t===1?1:2)),raw=JSON.stringify(packet);
  const decoded=restoreStateTuples(packet),cache=new EquipmentCache(),full=cache.restore(packet.world,false);
  const short=JSON.parse(prepare.packet('p',true,-1,undefined,true,t!==0,false,false,t===1?1:2));
  const shortDecode=restoreStateTuples(short),cached=cache.restore(short.world,true);
  packets.push({t,raw,decoded,full,shortDecode,cached,weapon:short.world.players[0].weapons[0]});
 }
 return {type,tier,oldTier,projected,stats:stats(projected),visualTier:weaponVisualTier(projected),legacyTier:weaponTier(projected),color,packets};
}
export function glowColor(w:any){const glow=new WeaponRarityGlow(new T.Group(),w),color=(glow as any).color.getHex();glow.dispose();return color}
export {validBattleWeapon,validNewWeapon,validWeapon,makeWeapon,weaponVisualTier,weaponTier,loadProgressionWeapons,StandardTrooper,GLTFLoader,T,createFrontRun};
