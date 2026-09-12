import fs from 'node:fs';
import path from 'node:path';
const root='assets/blender/candidates/crawler/pleat-v2-r2/audit-workspace';
const seen=new Set();
function copy(p){p=p.replaceAll('\\','/');if(seen.has(p))return;seen.add(p);const dest=root+'/'+p;fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(p,dest);
 if(!/\.(ts|js|mjs|html)$/.test(p))return;
 const text=fs.readFileSync(p,'utf8');
 const refs=[...text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]);
 for(const s of refs){if(!s.startsWith('.')&&!s.startsWith('/src/'))continue;const rel=s.startsWith('/src/')?s.slice(1):path.normalize(path.join(path.dirname(p),s));const found=[rel,rel+'.ts',rel+'.js',rel+'/index.ts'].find(x=>fs.existsSync(x)&&fs.statSync(x).isFile());if(found&&!found.startsWith('node_modules'))copy(found);}
}
for(const p of ['src/client/render.ts','src/client/hound-motion.ts','src/client/structure-motion.ts','src/shared/game.ts','tests/hound-motion.test.ts','tests/structure-motion.test.ts','e2e/structure-fixture.html','package.json','package-lock.json','tsconfig.json','vitest.config.ts'])copy(p);
fs.writeFileSync(root+'/AUDIT-README.md','# E02 reproducibility snapshot\n\nSource closure for Renderer, game, motion loader, fixture and two relevant tests, with package/lock and configuration. No node_modules or credentials. Original paths preserved. npm ci then npx vitest run tests/hound-motion.test.ts tests/structure-motion.test.ts. Full deployment is outside scope. Rendering needs game public assets and candidate folder mounted at their documented paths; this snapshot does not claim a full deployable game. The immutable source hashes and preserved-110 before/after list are in the parent validation folder.\n');
console.log('Source snapshot files',seen.size);
