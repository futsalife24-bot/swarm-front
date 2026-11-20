const fs=require('fs'),esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['dist-validation/oldclient-d7/server-entry.ts'],bundle:true,platform:'node',format:'cjs',outfile:'dist-validation/oldclient-d7/server.cjs',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}});
const common={entryPoints:['dist-validation/old-server-current-entry.ts'],bundle:true,platform:'node',format:'cjs',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}};
const variants={
 baseline:`export const weaponVisualTier = (w: Weapon) =>\n  Number.isInteger(w.appearanceTier) && Number(w.appearanceTier) >= 0 && Number(w.appearanceTier) <= 4 ? Number(w.appearanceTier) : weaponTier(w);\n`,
 candidate:`export const weaponVisualTier = (w: Weapon) => {\n  if (Number.isInteger(w.appearanceTier) && Number(w.appearanceTier) >= 0 && Number(w.appearanceTier) <= 4) return Number(w.appearanceTier);\n  const tier = weaponTier(w);\n  return Number.isInteger(tier) ? Math.max(0, Math.min(4, tier)) : 0;\n};\n`
};
function plugin(name){return{name:'in-memory-visual-tier-'+name,setup(build){build.onLoad({filter:/[\\/]src[\\/]shared[\\/]progression\.ts$/},args=>{const s=fs.readFileSync(args.path,'utf8'),a=s.indexOf('export const weaponVisualTier ='),b=s.indexOf('export const weaponYield =',a);if(a<0||b<a)throw Error('visual tier marker missing');return{contents:s.slice(0,a)+variants[name]+s.slice(b),loader:'ts'}})}}}
(async()=>{await esbuild.build({...common,outfile:'dist-validation/old-server-current.cjs',plugins:[plugin('baseline')]});await esbuild.build({...common,outfile:'dist-validation/old-server-clamped.cjs',plugins:[plugin('candidate')]});})().catch(e=>{console.error(e);process.exitCode=1});
