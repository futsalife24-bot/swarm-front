const esbuild=require('esbuild'),fs=require('fs'),path=require('path');
const wd=process.cwd(),out=path.join(wd,'dist-validation');
const plugin={name:'in-memory-prototype',setup(build){
 build.onLoad({filter:/[\\/]src[\\/]shared[\\/](front-run|progression)\.ts$/},args=>{
  let s=fs.readFileSync(args.path,'utf8');
  if(args.path.endsWith('front-run.ts')){
    const before='      rarity: weapon.rarity,\n      power: base.damage / WEAPONS[weapon.kind].damage,';
    const after='      rarity: weapon.rarity,\n      appearanceTier: ("format" in weapon && weapon.format === 2 ? weapon.rarity : weapon.rarity + 1),\n      power: base.damage / WEAPONS[weapon.kind].damage,';
    if(!s.includes(before))throw Error('front-run marker missing');s=s.replace(before,after);
  } else {
    const before='export const weaponTier = (w: Weapon) =>\n  "format" in w && w.format === 2 ? w.rarity : w.rarity + 1;';
    const after='export const weaponTier = (w: Weapon) =>\n  ("appearanceTier" in w && Number.isInteger(w.appearanceTier) && Number(w.appearanceTier)>=0 && Number(w.appearanceTier)<=4) ? Number(w.appearanceTier) : ("format" in w && w.format === 2 ? w.rarity : w.rarity + 1);';
    if(!s.includes(before))throw Error('progression marker missing');s=s.replace(before,after);
  }
  return {contents:s,loader:'ts'};
 });
}};
(async()=>{for(const proto of [false,true])await esbuild.build({entryPoints:['scripts/weapon-fusion-tier-entry.ts'],bundle:true,platform:'node',format:'cjs',outfile:path.join(out,proto?'fusion-tier-proto.cjs':'fusion-tier-original.cjs'),plugins:proto?[plugin]:[]});})().catch(e=>{console.error(e);process.exitCode=1});
