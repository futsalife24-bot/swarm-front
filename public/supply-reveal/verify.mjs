import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const { chromium } = createRequire(path.join(root, 'task-pleat-lightweight/package.json'))('playwright');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname;
  if (pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/gacha.css"><div id="host"></div>'); return; }
  const target = path.resolve(dir, '.' + decodeURIComponent(pathname));
  if (!target.startsWith(dir + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream' }); fs.createReadStream(target).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const report = await page.evaluate(async ({ quick, liveMulti, onlySeven }) => {
    const { createSupplyReveal } = await import('/runtime.js');
    const { PRESETS1, PRESETS10 } = await import('/core.js');
    const cases = [
      [1, PRESETS1['SSR武器']], [2, PRESETS10['SSR＋SR']], [3, PRESETS10['SSR＋SR']], [4, PRESETS10['SSR＋SR']],
      [5, PRESETS1['SSR武器']], [6, PRESETS1['SSR武器']], [7, PRESETS1['SSR武器']], [8, PRESETS1['SSR武器']],
      [9, PRESETS1['SSR武器']], [10, PRESETS1['バディ']],
      [4, PRESETS10['SSR＋SR'].map((r) => r.rarity === 'SR' ? { ...r, rarity: 'R' } : r)],
      ...[5, 6, 7, 8, 9].map((n) => [n, PRESETS10['SSR＋SR']]),
      [10, PRESETS10['バディ＋SSR＋SR']],
    ];
    const api = createSupplyReveal(document.getElementById('host'), { sound: false, haptics: false });
    await api.ready;
    const rows = [];
    for (const [n, values] of cases) {
      await api.play(values, { effects: n, manual: true, silent: true });
      const initial = api.state();
      const effectNames = { 1: 'gold', 2: 'meteor', 3: 'crack', 4: 'presage', 5: 'skip', 6: 'relight', 7: 'hold', 8: 'freeze', 9: 'shatter', 10: 'jack' };
      const timeline = api.timeline();
      const effectPresent = timeline.some((p) => p.fx === effectNames[n]);
      const expectedCues = { 1: ['promote4'], 2: ['whoosh'], 3: ['land', 'promote4'], 4: ['lock', 'star'], 5: ['slam'], 6: ['tile', 'slam'], 7: ['charge2', 'charge3', 'charge4', 'hold'], 8: [], 9: ['land_s', 'slam', 'open4'], 10: ['ui', 'whoosh', 'call'] }[n];
      const cueIds = timeline.flatMap((p) => p.cues.map((c) => c.id));
      let index = -1; const cuesOrdered = expectedCues.every((id) => { index = cueIds.indexOf(id, index + 1); return index >= 0; });
      api.tap(); api.skip();
      const final = api.state();
      rows.push({ n, initial, final, items: api.model().results.length, effectPresent, cuesOrdered, visible: !api.root.hidden });
      api.close();
      api.setReduced(true);
      await api.play(values, { effects: n, manual: true, silent: true });
      api.skip(); api.close(); api.setReduced(false);
    }
    await api.play(PRESETS1['SSR武器'], { effects: 1, silent: true });
    await new Promise((resolve) => setTimeout(resolve, 850));
    const goldWait = api.state().waiting === 'launch' && api.root.classList.contains('kx-gold') && getComputedStyle(api.root.querySelector('.gx-launch b')).color === 'rgb(255, 242, 192)';
    api.close();
    const create = document.createElement.bind(document); let snapshots = 0;
    document.createElement = (...args) => { if (args[0] === 'canvas') snapshots++; return create(...args); };
    const shatter = { id: 'shatter', p: { x: 422, cy: 200, crack: 1, fall: 0.3 } };
    await api.play(PRESETS1['SSR武器'], { effects: 9, manual: true, silent: true });
    api.seek(3, 0, false, shatter); const firstSnapshot = snapshots; api.close();
    await api.play(PRESETS1['SSR武器'], { effects: 9, manual: true, silent: true });
    api.seek(3, 0, false, shatter); const secondSnapshot = snapshots; api.close();
    document.createElement = create;
    const live = [];
    const liveCases = quick ? [] : onlySeven ? [cases[6]] : liveMulti ? cases.slice(11) : cases.slice(0, 10);
    for (const [n, values] of liveCases) {
      api.setFast(true);
      await api.play(values, { effects: n, silent: true });
      const start = performance.now(); let taps = 0, stops = new Set(), released = false;
      while (api.state().waiting !== 'final' && performance.now() - start < 30000) {
        const state = api.state();
        if (state.waiting && !stops.has(state.part)) { stops.add(state.part); taps++; }
        if (onlySeven && n === 7 && state.waiting && api.timeline()[state.part + 1]?.fx === 'hold' && !released) {
          api.root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          if (!api.state().waiting) { released = true; setTimeout(() => window.dispatchEvent(new PointerEvent('pointerup')), 450); }
        } else if (!onlySeven || state.waiting) api.tap();
        await new Promise((resolve) => setTimeout(resolve, 85));
      }
      live.push({ n, final: api.state().waiting === 'final', taps, released, ms: Math.round(performance.now() - start) });
      api.close();
    }
    api.destroy();
    return { rows, live, goldWait, snapshots: [firstSnapshot, secondSnapshot], roots: document.querySelectorAll('.gx-root').length, caps: document.querySelectorAll('.kx-cap').length, styles: [...document.querySelectorAll('style')].filter((e) => e.textContent.includes('.kx-cap')).length };
  }, { quick: process.env.SUPPLY_QUICK === '1', liveMulti: process.env.SUPPLY_LIVE_MULTI === '1', onlySeven: process.env.SUPPLY_ONLY7 === '1' });
  if (errors.length || report.rows.some((r) => r.initial.effect !== r.n || r.final.waiting !== 'final' || !r.effectPresent || !r.cuesOrdered || !r.visible || r.items < 1) || report.live.some((r) => !r.final || (process.env.SUPPLY_ONLY7 === '1' && !r.released)) || !report.goldWait || report.snapshots[1] <= report.snapshots[0] || report.roots || report.caps || report.styles) throw Error(JSON.stringify({ errors, report }));
  console.log(JSON.stringify({ checked: report.rows.length, live: report.live, goldWait: report.goldWait, snapshotRecreated: report.snapshots[1] > report.snapshots[0], normalAndReduced: true, skip: true, cleanup: true, errors }));
} finally { await browser.close(); server.close(); }
