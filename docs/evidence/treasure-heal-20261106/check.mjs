import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const out = 'dist-validation/treasure-heal';
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
try {
  for (const [width, height] of [[844, 390], [640, 360]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultTimeout(120000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/__heal-preview', route => route.fulfill({ contentType: 'text/html', body: '<html><head><link rel="stylesheet" href="/src/client/front-reward-ui.css"><style>body{margin:0;background:#13242e;color:#fff;font-family:sans-serif;--menu-heading:sans-serif}#ui{height:100vh;display:flex;align-items:center;justify-content:center}</style></head><body class="front-game"><div id="ui"></div></body></html>' }));
    await page.goto('http://127.0.0.1:5186/__heal-preview', { waitUntil: 'domcontentloaded', timeout: 120000 });
    const amount = 28.835476666666807;
    const unchanged = await page.evaluate(async amount => {
      const { frontTreasureMarkup } = await import('/src/client/front-reward-ui.ts');
      const view = { treasure: { reward: { kind: 'heal', amount } } };
      document.querySelector('#ui').innerHTML = frontTreasureMarkup(view, '/', true);
      return view.treasure.reward.amount;
    }, amount);
    const label = page.locator('.front-treasure-bonus strong');
    await expect(label).toHaveText('HP +29');
    const box = await label.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(unchanged).toBe(amount);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `${out}/${width}-heal.png` });
    results.push({ width, height, text: await label.innerText(), inputAmount: amount, unchanged, errors, fixture: '実表示関数とCSS。戦闘・回復発生は再現していない' });
    await page.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/ui.json`, JSON.stringify(results, null, 2) + '\n');
}
console.log(JSON.stringify(results));
