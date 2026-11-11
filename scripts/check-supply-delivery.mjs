import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localRoot = path.join(repo, 'dist', 'supply-reveal');
const output = path.resolve(repo, process.env.SUPPLY_OUTPUT || 'docs/evidence/supply-kakutei-20261111/release', 'supply-delivery.json');
const publicRoot = 'https://swarm-front.melosalife-24.workers.dev/supply-reveal/';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function filesBelow(folder, prefix = '') {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await filesBelow(path.join(folder, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
    else throw Error(`配布物に通常ファイル以外があります: ${relative}`);
  }
  return files;
}

async function check(relative) {
  const local = await readFile(path.join(localRoot, ...relative.split('/')));
  const url = publicRoot + relative.split('/').map(encodeURIComponent).join('/');
  const item = {
    path: `supply-reveal/${relative}`,
    bytes: { local: local.byteLength, public: null },
    sha256: { local: sha256(local), public: null },
    status: { http: null, match: false },
  };
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const publicBytes = Buffer.from(await response.arrayBuffer());
    item.bytes.public = publicBytes.byteLength;
    item.sha256.public = sha256(publicBytes);
    item.status.http = response.status;
    item.status.match = response.status === 200 &&
      item.bytes.local === item.bytes.public &&
      item.sha256.local === item.sha256.public;
  } catch (error) {
    item.status.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  return item;
}

async function main() {
  const paths = (await filesBelow(localRoot)).sort();
  if (!paths.length) throw Error('dist/supply-reveal に配布対象がありません');
  const items = new Array(paths.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, paths.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= paths.length) return;
      items[index] = await check(paths[index]);
    }
  }));
  const result = {
    checkedAt: new Date().toISOString(),
    publicRoot,
    localRoot: 'dist/supply-reveal',
    total: items.length,
    matched: items.filter((item) => item.status.match).length,
    items,
  };
  result.ok = result.total === result.matched;
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: result.ok, total: result.total, matched: result.matched, report: path.relative(repo, output).replaceAll('\\', '/') }));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
