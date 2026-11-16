import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleDir = path.join(root, 'public/supply-reveal');
const publicBase = 'https://swarm-front.melosalife-24.workers.dev/';
const stageIndex = process.argv.indexOf('--stage');
const publishedIndex = process.argv.indexOf('--published');
if ((stageIndex >= 0) === (publishedIndex >= 0))
  throw Error('--stage before|after または --published <sourceSHA> を指定してください');
const stage = publishedIndex >= 0 ? 'published' : process.argv[stageIndex + 1];
const source = publishedIndex >= 0 ? process.argv[publishedIndex + 1] : null;
if (!['before', 'after', 'published'].includes(stage) ||
  (publishedIndex >= 0 && !/^[a-f0-9]{40}$/.test(source || '')))
  throw Error('stage または公開sourceSHAが不正です');
const out = path.join(root, 'docs/evidence/gacha-marks-20261116', stage);
const cues = ['lamp', 'delayed', 'multilock', 'landing', 'reverse', 'reverseSeal', 'skeleton', 4];
const sha = (data) => createHash('sha256').update(data).digest('hex');

async function deliveryCheck() {
  const paths = ['index.html', 'front.html'];
  async function walk(dir, all = false) {
    for (const entry of await fs.readdir(path.join(root, 'dist', dir), { withFileTypes: true })) {
      const name = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(name, all);
      else if (all || /\.(js|css)$/.test(name) || name.startsWith('assets/voice-packs/')) paths.push(name);
    }
  }
  await walk('assets');
  await walk('supply-reveal', true);
  let embedded = false;
  const files = [];
  for (const name of paths) {
    const local = await fs.readFile(path.join(root, 'dist', name));
    if (name.endsWith('.js') && local.includes(Buffer.from(source))) embedded = true;
    const response = await fetch(publicBase + name, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    const remote = Buffer.from(await response.arrayBuffer());
    files.push({ name, status: response.status, local: sha(local), remote: sha(remote), match: sha(local) === sha(remote) });
  }
  const health = await fetch(publicBase + 'api/health', { cache: 'no-store' }).then((r) => r.json());
  const report = { source, embedded, health, files };
  await fs.writeFile(path.join(out, 'delivery.json'), JSON.stringify(report, null, 2));
  assert(embedded && health.ok && files.every((row) => row.status === 200 && row.match), '配信照合失敗');
  return files.length;
}

const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://local').pathname;
    if (pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/gacha.css"><div id="host"></div>');
      return;
    }
    const target = path.resolve(moduleDir, '.' + decodeURIComponent(pathname));
    if (!target.startsWith(moduleDir + path.sep)) throw Error('範囲外');
    const data = await fs.readFile(target);
    res.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});

await fs.mkdir(out, { recursive: true });
let deliveryFiles = null;
if (stage === 'published') deliveryFiles = await deliveryCheck();
let browser;
const errors = [], writes = [], rows = [];
try {
  if (stage !== 'published') await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ channel: 'chrome' });
  for (const [width, height] of [[844, 390], [640, 360]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (request.method() !== 'GET') writes.push({ method: request.method(), url: request.url() });
    });
    if (stage === 'published') {
      await page.goto(publicBase + 'supply-reveal/README.md');
      await page.evaluate(() => {
        document.open();
        document.write('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/supply-reveal/gacha.css"><div id="host"></div>');
        document.close();
      });
    } else await page.goto(`http://127.0.0.1:${server.address().port}/`);
    for (const cue of cues) for (const count of [1, 10]) for (const reduced of [false, true]) {
      const name = `${cue}-${count}-${width}-${reduced ? 'reduced' : 'normal'}`;
      const result = await page.evaluate(async ({ cue, count, reduced, published }) => {
        const prefix = published ? '/supply-reveal/' : '/';
        const { createSupplyReveal } = await import(prefix + 'runtime.js');
        const { PRESETS1, PRESETS10, tierOf } = await import(prefix + 'core.js');
        const { validatePlan } = await import(prefix + 'effect-selection.js');
        const { signalLayers } = await import(prefix + 'signal-timeline.js');
        const values = structuredClone(count === 1 ? PRESETS1['SSR武器'] : PRESETS10['SSR＋SR']);
        if (count === 10) values[9] = { ...PRESETS1['SR武器'][0] };
        const resultsBefore = JSON.stringify(values);
        const storageBefore = JSON.stringify({ ...localStorage });
        const api = createSupplyReveal(document.getElementById('host'), {
          sound: false, warm: false, haptics: false,
        });
        api.setReduced(reduced);
        await api.play(values, { effects: cue, initialTiers: values.map((_, i) => count === 10 && i === 9 ? 2 : 1), manual: true, silent: true });
        const plan = api.state().plan, model = api.model();
        const planBefore = JSON.stringify(plan);
        const phase = ['lamp', 'multilock', 'reverse', 'reverseSeal'].includes(cue) ? 0
          : cue === 'landing' ? 1 : 2;
        const target = plan.targets[phase];
        const pod = target === null ? null : model.pods[target];
        const time = phase === 0 ? model.tLaunch : cue === 'landing' ? pod.tLand + 0.2
          : pod.beats[0].t0 + 0.5;
        const legacyFx = cue === 4 ? { id: 'presage', p: { x: 422 + pod.x,
          gy: pod.gy, h: pod.h, k: 1, a: 1 } } : null;
        for (const sample of [time * 0.3, time * 0.7, time])
          api.seek(sample, phase === 0 ? 1 : 0.25, false, sample === time ? legacyFx : null);
        const layers = signalLayers(plan, model, time, time + (phase === 0 ? 1 : 0.25));
        const output = { cue, count, reduced, time, phase, target, plan,
          planValid: validatePlan({ tiers: values.map(tierOf), multi: count === 10,
            initialTiers: values.map((_, i) => count === 10 && i === 9 ? 2 : 1) }, plan),
          layerFound: cue === 4 ? api.timeline().some((item) => item.fx === 'presage')
            : layers.some((layer) => layer.id === cue),
          resultSame: JSON.stringify(values) === resultsBefore &&
            JSON.stringify(model.results.map(({ initialTier, ...value }) => value)) === resultsBefore,
          planSame: JSON.stringify(api.state().plan) === planBefore,
          storageSame: JSON.stringify({ ...localStorage }) === storageBefore,
          visible: !api.root.hidden };
        window.markCheck = api;
        window.markStorageBefore = storageBefore;
        window.markPlanBefore = planBefore;
        return output;
      }, { cue, count, reduced, published: stage === 'published' });
      assert(result.planValid && result.plan.phases[result.phase] === cue && result.layerFound &&
        result.resultSame && result.planSame && result.storageSame && result.visible, `${name}: ${JSON.stringify(result)}`);
      await page.screenshot({ path: path.join(out, `${name}.png`) });
      if (cue === 'landing' && count === 10) {
        await page.evaluate(() => {
          const api = window.markCheck;
          api.seek(api.model().mass[1] - 0.2);
        });
        await page.screenshot({ path: path.join(out, `${name}-grid.png`) });
      }
      if (cue === 'reverseSeal' && !reduced) {
        const back = await page.evaluate(() => {
          window.markCheck.seek(window.markCheck.model().tLaunch * 0.58);
          return JSON.stringify(window.markCheck.state().plan) === window.markPlanBefore;
        });
        assert(back, `${name}: 裏面seek後にplanが変化`);
        await page.screenshot({ path: path.join(out, `${name}-back.png`) });
      }
      const cleanup = await page.evaluate(() => {
        const api = window.markCheck;
        api.close(); api.destroy(); delete window.markCheck;
        return { roots: document.querySelectorAll('.gx-root').length,
          caps: document.querySelectorAll('.kx-cap').length,
          storageSame: JSON.stringify({ ...localStorage }) === window.markStorageBefore };
      });
      assert(cleanup.roots === 0 && cleanup.caps === 0 && cleanup.storageSame,
        `${name}: 残留または保存変化 ${JSON.stringify(cleanup)}`);
      rows.push({ name, ...result, cleanup });
    }
    await context.close();
  }
  assert(rows.length === 64 && errors.length === 0 && writes.length === 0);
  const report = { stage, source, deliveryFiles, cases: rows.length, rows, errors, writes,
    scope: 'Chrome固定結果。通常抽選・報酬受領・保存/API書込なし。見た目の最終判定は画像で確認。' };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ stage, cases: rows.length, deliveryFiles, errors, writes }));
} finally {
  await browser?.close();
  if (server.listening) server.close();
}
