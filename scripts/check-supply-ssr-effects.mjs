import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('public');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') {
    res.setHeader('content-type', 'text/html');
    res.end(`<link rel="stylesheet" href="/supply-reveal/gacha.css"><script type="module">import{createSupplyReveal}from'/supply-reveal/runtime.js';window.reveal=createSupplyReveal(document.body,{sound:false,warm:false});await reveal.ready;window.ready=true;</script>`);
    return;
  }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
  for (const [width, height] of [[844, 390], [640, 360]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.ready);
    const rows = await page.evaluate(async () => {
      const make = (types) => types.map((v, i) => v === 'B' ? { type: 'buddy', name: 'バディ', art: 'b-tatara' } : { type: 'weapon', rarity: v, name: v + i, art: 'w-rifle' });
      const run = async (types, random) => {
        const old = Math.random;
        Math.random = () => random;
        try {
          await reveal.play(make(types), { silent: true, manual: true });
          return { effect: reveal.state().effect, fx: reveal.timeline().map((p) => p.fx) };
        } finally { Math.random = old; }
      };
      return [await run(['N', 'R', 'SR', 'N', 'N', 'N', 'N', 'N', 'N', 'SR'], 0), await run(['SSR', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'SR'], 0.12), await run(['B', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'SR'], 0.999)];
    });
    assert.equal(rows[0].effect, 0);
    assert(!rows[0].fx.includes('meteor'));
    assert.equal(rows[1].effect, 2);
    assert(rows[1].fx.includes('meteor'));
    assert.equal(rows[2].effect, 10);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, height, effects: rows.map((row) => row.effect), errors }));
    await page.close();
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
