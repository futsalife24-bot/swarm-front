import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = 'https://swarm-front.melosalife-24.workers.dev';
const input = JSON.parse(readFileSync('dist-mobile-diagnosis/release-build-manifest.json', 'utf8'));
const extras = ['briefing/index.html', 'briefing/slides.html', 'sw.js', 'icon-swarm-v4-192.png', 'icon-swarm-v4-512.png', 'icon-swarm-v4-512-maskable.png'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = [...new Set([...input.files.map(f => f.path), ...extras])];
const checks = [];
let next = 0;
async function checkFiles() {
  while (next < paths.length) {
    const path = paths[next++];
    const local = readFileSync(`dist/${path}`);
    const urlPath = path === 'front.html' ? 'front' : path;
    try {
      const response = await fetch(`${root}/${urlPath}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const remote = Buffer.from(await response.arrayBuffer());
      checks.push({ path, status: response.status, bytes: local.length, localSha256: hash(local), publicSha256: hash(remote), pass: response.ok && hash(local) === hash(remote) });
    } catch (error) {
      checks.push({ path, pass: false, error: String(error) });
    }
  }
}
await Promise.all(Array.from({ length: 4 }, checkFiles));
checks.sort((a, b) => a.path.localeCompare(b.path));
let health;
try {
  const response = await fetch(`${root}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  health = { status: response.status, body: await response.json() };
} catch (error) { health = { error: String(error) }; }
const pass = health.status === 200 && health.body?.ok === true && checks.every(item => item.pass);
const result = { checkedAt: new Date().toISOString(), source: input.gitHead, workerVersion: process.argv[2], base: root, health, pass, checks };
writeFileSync('dist-mobile-diagnosis/delivery.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ pass, health, files: checks.length, failed: checks.filter(item => !item.pass) }));
if (!pass) process.exitCode = 1;
