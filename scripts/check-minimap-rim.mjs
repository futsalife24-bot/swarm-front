import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'dist-validation/minimap-rim';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5197');
  const result = await page.evaluate(async () => {
    const { Minimap } = await import('/src/client/minimap.ts');
    document.body.innerHTML = '<canvas id="minimap" style="width:240px;height:auto"></canvas>';
    const m = new Minimap();
    const marks = [];
    for (const method of ['dot', 'ring']) {
      const original = m[method].bind(m);
      m[method] = (x, y, r, ...rest) => { marks.push({ x, y, r: r + (method === 'ring' ? rest[1] / 2 : 0) }); original(x, y, r, ...rest); };
    }
    let cases = 0;
    for (const dpr of [1, 2]) {
      Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
      for (const turning of [false, true]) for (const yaw of [0, Math.PI / 2, Math.PI, 0.73]) {
        m.rotates = turning;
        const enemies = Array.from({ length: 16 }, (_, i) => ({ kind: i % 2 ? 'boss' : 'crawler', x: 1000 * Math.cos(i * Math.PI / 8), z: 1000 * Math.sin(i * Math.PI / 8), y: i % 3 ? 0 : 3 }));
        marks.length = 0;
        m.draw({ players: [{ id: 'self', x: 0, z: 0 }], enemies }, 'self', yaw, ++cases * 101);
        const cx = m.canvas.width / 2, cy = m.canvas.height / 2;
        marks.forEach((p, i) => {
          const dx = p.x - cx, dy = p.y - cy;
          const a = turning ? i * Math.PI / 8 - yaw : Math.atan2(m.pz(enemies[i].z) - cy, m.px(enemies[i].x) - cx);
          if (Math.abs(dx * Math.sin(a) - dy * Math.cos(a)) > 0.001) throw Error('bearing changed');
          const margin = (p.r + 1) * dpr;
          if (turning) {
            if (Math.abs(Math.hypot(dx, dy) - (Math.min(cx, cy) - margin)) > 0.001) throw Error('not on circle rim');
          } else if (Math.abs(Math.max(Math.abs(dx) / (cx - margin), Math.abs(dy) / (cy - margin)) - 1) > 0.001) throw Error('not on rectangle rim');
        });
      }
    }
    return { pass: true, cases, markers: cases * 16 };
  });
  assert(result.pass);
  await page.screenshot({ path: out + '/rim.png' });
  writeFileSync(out + '/checks.json', JSON.stringify(result, null, 2));
  console.log(result);
} finally { await browser.close(); }
