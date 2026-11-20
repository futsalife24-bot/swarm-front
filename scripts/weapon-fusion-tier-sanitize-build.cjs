const esbuild=require('esbuild'),fs=require('fs');
const replace=(s,from,to,label)=>{if(!s.includes(from))throw Error('missing '+label);return s.replace(from,to)};
const plugin={name:'in-memory-sanitize-variant',setup(build){
 build.onLoad({filter:/[\\/]src[\\/](shared|client)[\\/](front-run|game|progression|defs|standard-trooper|weapon-rarity-glow|progression-weapons)\.ts$/},args=>{
  let s=fs.readFileSync(args.path,'utf8');
  if(args.path.endsWith('front-run.ts')){
   s=replace(s,'      rarity: weapon.rarity,\n      power: base.damage / WEAPONS[weapon.kind].damage,','      rarity: weapon.rarity,\n      appearanceTier: ("format" in weapon && weapon.format === 2 ? weapon.rarity : weapon.rarity + 1),\n      power: base.damage / WEAPONS[weapon.kind].damage,','projection');
  } else if(args.path.endsWith('game.ts')){
   s=replace(s,'    weapons: structuredClone(weapons),','    weapons: structuredClone(weapons).map(({ appearanceTier, ...weapon }) => weapon),','strip');
  } else if(args.path.endsWith('defs.ts')) {
   s=replace(s,'export interface Weapon {','export interface Weapon {\n  appearanceTier?: 0 | 1 | 2 | 3 | 4;','type');
  } else if(args.path.endsWith('progression.ts')) {
   const marker='export const weaponYield = (w: Weapon) =>';
   const helper='export const weaponVisualTier = (w: Weapon) =>\n  (Number.isInteger(w.appearanceTier) && Number(w.appearanceTier)>=0 && Number(w.appearanceTier)<=4) ? Number(w.appearanceTier) : weaponTier(w);\n';
   s=replace(s,marker,helper+marker,'visual helper');
  } else s=s.replace(/\bweaponTier\b/g,'weaponVisualTier');
  return {contents:s,loader:'ts'};
 });
}};
esbuild.build({entryPoints:['scripts/weapon-fusion-tier-sanitize-entry.ts'],bundle:true,platform:'node',format:'cjs',outfile:'dist-validation/fusion-tier-sanitize.cjs',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},plugins:[plugin]}).catch(e=>{console.error(e);process.exitCode=1});
