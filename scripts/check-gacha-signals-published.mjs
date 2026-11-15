import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = 'https://swarm-front.melosalife-24.workers.dev/';
const out = 'docs/evidence/gacha-signals-20261115/published';
const source = process.argv[2] || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const paths = ['index.html', 'front.html'];
async function walk(dir, all = false) {
  for (const entry of await fs.readdir('dist/' + dir, { withFileTypes: true })) {
    const name = dir + '/' + entry.name;
    if (entry.isDirectory()) await walk(name, all);
    else if (all || /\.(js|css)$/.test(name) || name.startsWith('assets/voice-packs/')) paths.push(name);
  }
}
await walk('assets'); await walk('supply-reveal', true);
await fs.mkdir(out, { recursive: true });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
let embedded = false;
const delivery = [];
for (const path of paths) {
  const local = await fs.readFile('dist/' + path);
  if (path.endsWith('.js') && local.includes(Buffer.from(source))) embedded = true;
  const response = await fetch(base + path, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  delivery.push({ path, http: response.status, local: sha(local), published: sha(bytes), match: sha(local) === sha(bytes) });
}
const health = await fetch(base + 'api/health').then((response) => response.json());
await fs.writeFile(out + '/delivery.json', JSON.stringify({ source, embedded, health, files: delivery }, null, 2));
assert(embedded && health.ok && delivery.every((row) => row.http === 200 && row.match));

const browser = await chromium.launch({ channel: 'chrome' });
const cases = [], errors = [], writes = [];
try {
  for (const [width, height] of [[844, 390], [640, 360]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (request.method() !== 'GET') writes.push({ method: request.method(), url: request.url() }); });
    // 公開されている静的文書を入口にし、API・保存を呼ばず公開モジュールの表示だけを確認する。
    await page.goto(base + 'supply-reveal/README.md');
    await page.evaluate(() => {
      document.open(); document.write('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/supply-reveal/gacha.css"><div id="host"></div>'); document.close();
    });
    for (const name of ['buddy', 'reverseSeal', 'skeleton', 'mixed']) {
      const result = await page.evaluate(async (name) => {
        const { createSupplyReveal } = await import('/supply-reveal/runtime.js');
        const { PRESETS1, PRESETS10, tierOf } = await import('/supply-reveal/core.js');
        const { validatePlan } = await import('/supply-reveal/effect-selection.js');
        const values = structuredClone(name === 'buddy' ? PRESETS1['バディ'] : name === 'reverseSeal' ? PRESETS1['SSR武器'] : PRESETS10['SSR＋SR']);
        if (values.length === 10) values[9] = { ...PRESETS1['SR武器'][0] };
        if (name === 'mixed') values[0] = { ...PRESETS1['SSR武器'][0] };
        const initialTiers = values.map(() => 1); if (values.length === 10) initialTiers[9] = 2;
        const effects = name === 'buddy' ? ['signature', 'heartbeat', 10] : name === 'reverseSeal' ? 'reverseSeal' : name === 'skeleton' ? 'skeleton' : ['reverse', 'landing', 'delayed'];
        const before = JSON.stringify(values), saved = JSON.stringify({ ...localStorage });
        const api = createSupplyReveal(document.getElementById('host'), { sound: false, warm: false, haptics: false });
        await api.play(values, { effects, initialTiers, manual: true, silent: true });
        const plan = api.state().plan, m = api.model();
        validatePlan({ tiers: values.map(tierOf), multi: values.length === 10, initialTiers }, plan);
        const p = m.pods[plan.targets[name === 'skeleton' ? 2 : 1] ?? 0];
        const t = name === 'reverseSeal' ? m.tLaunch : name === 'skeleton' ? p.beats[0].t0 + 0.5 : p.tLand + 0.3;
        api.seek(t, name === 'reverseSeal' ? 1 : 0);
        window.publishedReveal = api;
        return { plan, unchanged: before === JSON.stringify(values), saveUnchanged: saved === JSON.stringify({ ...localStorage }), visible: !api.root.hidden };
      }, name);
      assert(result.unchanged && result.saveUnchanged && result.visible);
      await page.screenshot({ path: `${out}/${name}-${width}.png` });
      cases.push({ name, width, height, ...result });
      await page.evaluate(() => window.publishedReveal.destroy());
    }
    await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  await fs.writeFile(out + '/browser.json', JSON.stringify({ source, cases, errors, writes, scope: '公開静的モジュールの固定結果再生。実機・実聴と有償/通常抽選の実行はしていない。' }, null, 2));
  console.log(JSON.stringify({ source, files: delivery.length, matched: delivery.length, health: health.ok, browserCases: cases.length, errors, writes }));
} finally { await browser.close(); }
