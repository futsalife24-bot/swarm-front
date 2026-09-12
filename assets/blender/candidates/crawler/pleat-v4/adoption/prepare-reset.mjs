import fs from 'node:fs';
const dir='assets/blender/candidates/crawler/pleat-v4/adoption';
let s=fs.readFileSync('assets/blender/candidates/crawler/pleat-audit/check-proposal-reset.mjs','utf8');
s=s.split('\n').filter(l=>!l.includes("from './proposal-")&&!l.includes('await page.route(')&&!l.includes('assert.ok(results[0]')).join('\n');
s=s.replace("for(const [version,fix] of [['v2',oldFix],['v3',newFix]])","for(const version of ['adopted'])");
s=s.replace("const browser=",`const dir='${dir}';\nconst browser=`).replaceAll('results[1]','results[0]').replace('unapplied overlays','actual adopted source');
fs.writeFileSync(dir+'/check-reset.mjs',s);
