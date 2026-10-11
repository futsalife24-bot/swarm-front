import {createServer} from 'vite';
import {writeFileSync} from 'node:fs';
const s=await createServer({server:{middlewareMode:true}});
try {
 const g=await s.ssrLoadModule('/src/shared/game.ts');
 const {MAPS,STAGES}=await s.ssrLoadModule('/src/shared/stages.ts');
 const {ENEMIES}=await s.ssrLoadModule('/src/shared/defs.ts');
 const failures=[];
 for(const map of MAPS.slice(3)) {
  const stage=STAGES.find(s=>MAPS[s.map]===map);
  for(let seed=1;seed<=30;seed++) {
   const w=g.createWorld('entries',seed,stage.id);
   for(const kind of Object.keys(ENEMIES)) {
    g.spawn(w,kind);const e=w.enemies.at(-1);
    if(g.blocked(e.x,e.z,ENEMIES[kind].radius,e.y,map.blocks)) failures.push({map:map.name,stage:stage.id,seed,kind,x:e.x,y:e.y,z:e.z,radius:ENEMIES[kind].radius});
   }
  }
 }
 writeFileSync('dist-validation/pr163/map-failure-probe.json',JSON.stringify(failures,null,2));
 console.log(JSON.stringify({count:failures.length,examples:failures.slice(0,3),kinds:[...new Set(failures.map(f=>f.kind))]}));
} finally {await s.close();}
