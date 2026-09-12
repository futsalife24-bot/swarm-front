import fs from 'node:fs';
const dir='assets/blender/candidates/crawler/pleat-v4/adoption';
let s=fs.readFileSync('assets/blender/candidates/crawler/pleat-audit/check-proposal-v3.mjs','utf8');
s=s.replace("import {dir,gameFix,renderFix} from './proposal-v3.mjs';",`const dir='${dir}';`);
s=s.replace("**/assets/enemies/hound_motion_v1.glb","**/assets/enemies/pleat_motion_v4.glb");
s=s.replace("return r.fulfill({path:'assets/blender/candidates/crawler/pleat-v3/pleat_motion_v3.glb',contentType:'model/gltf-binary'});","return r.continue();");
s=s.split('\n').filter(l=>!l.includes('for(const [pattern,fix]')).join('\n').replace('isolated Vite response substitution; production unchanged','actual source and public GLB; network timing/failure controlled only');
fs.writeFileSync(dir+'/check-runtime.mjs',s);
