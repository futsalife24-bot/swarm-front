import { chromium } from '@playwright/test';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const remote = process.argv[2];
const server = remote ? null : await preview({ preview: { host: '127.0.0.1', port: 4192, strictPort: true } });
const base = remote || 'http://127.0.0.1:4192';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const width of [667, 915]) {
    const context = await browser.newContext({ viewport: { width, height: 375 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    const hashes = {};
    const html = readFileSync('dist/index.html', 'utf8');
    for (const path of [html.match(/src="([^"]+\.js)"/)[1], html.match(/href="([^"]+\.css)"/)[1]]) {
      const response = await page.request.get(base + path);
      assert.equal(response.status(), 200);
      const sha = bytes => createHash('sha256').update(bytes).digest('hex');
      hashes[path] = sha(await response.body());
      assert.equal(hashes[path], sha(readFileSync('dist' + path)));
    }
    // Use the actual editable name field, preserving native selection support.
    const inputs = await page.locator('input:not([type]), input[type="text"]').all();
    for (const input of inputs) {
      assert.notEqual(await input.evaluate(el => getComputedStyle(el).webkitUserSelect), 'none');
    }
    await page.locator('#solo').tap();
    await page.locator('#launch').tap();
    await page.locator('#pause').waitFor({state:'visible'});
    for (const selector of ['#pause', '#fire', '#move', '#hud']) {
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).webkitUserSelect), 'none');
    }
    // Browser-generated multi-click and drag must not select the pause glyph.
    await page.locator('#pause').dblclick();
    assert.equal(await page.evaluate(() => getSelection().toString()), '');
    await page.locator('#pause-resume').tap();
    await page.locator('#pause').tap();
    await page.locator('#pause-fire-sense').fill('2');
    await page.locator('#pause-resume').tap();
    assert.equal(await page.locator('#pause-menu').isVisible(), false);
    await page.locator('#pause').tap();
    assert.equal(await page.locator('#pause-fire-sense').inputValue(), '2');
    mkdirSync('dist-validation', {recursive:true});
    await page.screenshot({path:`dist-validation/touch-selection-${remote ? 'published' : 'local'}-${width}.png`});
    await page.locator('#pause-leave').tap();
    await page.locator('#pause-quit').tap();
    await page.locator('#launch').waitFor({state:'visible'});
    assert.deepEqual(errors, []);
    results.push({width, hashes, errors, pass:true});
    await page.goto('about:blank');
    await context.close();
  }
  writeFileSync(`dist-validation/touch-selection-${remote ? 'published' : 'local'}.json`, JSON.stringify({base, results, limitation:'Chrome touch emulation; real iOS callout not verified'}, null, 2));
  console.log('TOUCH SELECTION PASS', JSON.stringify(results));
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
