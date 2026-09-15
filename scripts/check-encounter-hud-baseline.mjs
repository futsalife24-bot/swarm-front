import { build } from 'vite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const out = 'dist-validation/encounter-hud', base = 'https://swarm-front.melosalife-24.workers.dev';
const sha = b => createHash('sha256').update(b).digest('hex');
await build({ build: { outDir: `${out}/baseline` }, plugins: [{ name: 'before-hud-change', enforce: 'pre', transform(code, id) {
  if (id.replaceAll('\\', '/').endsWith('/src/client/playtest.css')) return fs.readFileSync(`${out}/playtest.before.css`, 'utf8');
} }] });
const root = `${out}/baseline`, rows = [];
const ignored = fs.readFileSync(`${root}/.assetsignore`, 'utf8').split(/\r?\n/).filter(s => s && !s.startsWith('#'));
for (const path of fs.readdirSync(root, { recursive: true }).filter(p => fs.statSync(`${root}/${p}`).isFile())) {
  const url = path.replaceAll('\\', '/');
  if (url.startsWith('.') || ignored.includes(url)) continue;
  const response = await fetch(`${base}/${url}`);
  assert.equal(response.status, 200, url);
  const hash = sha(fs.readFileSync(`${root}/${path}`));
  assert.equal(sha(Buffer.from(await response.arrayBuffer())), hash, url);
  rows.push({ file: url, sha256: hash });
}
const worker = sha(fs.readFileSync('dist-worker-production/worker.js'));
assert.equal(worker, JSON.parse(fs.readFileSync('dist-validation/menu-entry/worker-live-comparison.json')).liveSHA256);
fs.writeFileSync(`${out}/baseline-live.json`, JSON.stringify({ files: rows, workerMatchesPriorPublished: worker }, null, 2));
console.log('PASS baseline', rows.length, 'published files; worker unchanged');
