import { createServer } from 'vite';
import { mkdirSync,writeFileSync,copyFileSync,existsSync } from 'node:fs';
const dir='dist-validation/maps-blender';mkdirSync(dir,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {MAPS}=await server.ssrLoadModule('/src/shared/stages.ts');
 const {CAVE_NODES,CAVE_EDGES,CAVE_RADIUS}=await server.ssrLoadModule('/src/shared/cave.ts');
 const data={maps:MAPS,nodes:CAVE_NODES,edges:CAVE_EDGES,radius:CAVE_RADIUS};
 const file=process.argv.includes('--before')?'before.json':'source.json';
 writeFileSync(`${dir}/${file}`,JSON.stringify(data,null,2));
 if(file==='source.json')writeFileSync('assets/blender/maps-layout-v1.json',JSON.stringify(data,null,2));
 if(file==='before.json') for(const p of ['src/shared/stages.ts','src/shared/game.ts','src/shared/cave.ts','src/client/render.ts','src/client/minimap.ts','src/client/cave-scene.ts','src/client/changelog.ts','tests/maps.test.ts','tests/bot.ts','tests/stages.test.ts']) {
  const out=`${dir}/before/${p}`; mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});if(!existsSync(out))copyFileSync(p,out);
 }
} finally {await server.close();}
