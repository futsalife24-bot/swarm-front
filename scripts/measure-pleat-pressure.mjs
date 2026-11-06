import { build } from 'esbuild';
import fs from 'node:fs';
fs.mkdirSync('dist-validation/balance-20261106',{recursive:true});
const source='docs/evidence/pleat-pressure-20261106/measure.ts';
const contents=fs.readFileSync(source,'utf8').replace("import { it, expect } from 'vitest';",'const it=(_name, fn)=>fn(); const expect=(x)=>({toBe:y=>{if(x!==y)throw Error("count mismatch")}});');
await build({stdin:{contents,resolveDir:process.cwd()+'/docs/evidence/pleat-pressure-20261106',loader:'ts'},platform:'node',bundle:true,format:'esm',outfile:'dist-validation/balance-20261106/run.mjs'});
await import('../dist-validation/balance-20261106/run.mjs?run='+Date.now());

