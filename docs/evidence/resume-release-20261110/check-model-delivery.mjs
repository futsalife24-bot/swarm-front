import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = 'https://swarm-front.melosalife-24.workers.dev';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const results = [];
for (const file of ['assets/enemies/harrow_motion_v14.glb', 'assets/enemies/foundry_zero_mechanical_legs_v2.glb']) {
  const expected = hash(readFileSync(`dist/${file}`));
  const response = await fetch(`${base}/${file}`, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = hash(bytes);
  results.push({ file, status: response.status, size: bytes.length, expected, actual, pass: response.ok && expected === actual });
}
const result = { at: new Date().toISOString(), base, passed: results.every(r => r.pass), results };
writeFileSync('dist-validation/resume-release-20261110/model-delivery.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (!result.passed) process.exitCode = 1;
