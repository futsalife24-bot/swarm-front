import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const base = process.env.FOUNDRY_SITE ?? 'https://swarm-front.melosalife-24.workers.dev';
const production = base.startsWith('https://');
const output = process.env.FOUNDRY_SITE_OUTPUT || 'dist-validation/foundry-concept-implementation';
mkdirSync(output, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const [name, width, height, touch] of [['desktop', 1440, 900, false], ['touch', 915, 412, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    assert.equal((await page.goto(base, { waitUntil: 'domcontentloaded' })).status(), 200);
    const js = await page.locator('script[type="module"]').last().getAttribute('src');
    const hashes = {};
    if (production) {
      const local = readFileSync('dist/index.html', 'utf8');
      assert.equal(js, local.match(/src="([^"]+\.js)"/)[1]);
      for (const path of [js, local.match(/href="([^"]+\.css)"/)[1], '/assets/enemies/foundry_zero_mechanical_legs_v2.glb']) {
        const response = await page.request.get(base + path);
        assert.equal(response.status(), 200);
        const remote = sha(await response.body());
        assert.equal(remote, sha(readFileSync('dist' + path)));
        hashes[path] = remote;
      }
    }
    await page.locator('#open-bestiary').click();
    await page.locator('[data-enemy="boss"]').click();
    assert.match(await page.locator('.enemy-description').innerText(), /PRISM/);
    const glb = page.waitForResponse(r => r.url().endsWith('/foundry_zero_mechanical_legs_v2.glb'));
    await page.locator('[data-worm="true"]').click();
    assert.equal((await glb).status(), 200);
    await page.evaluate(() => new Promise(resolve => {
      let frames = 0; const frame = () => ++frames > 30 ? resolve() : requestAnimationFrame(frame); requestAnimationFrame(frame);
    }));
    const report = await page.locator('.enemy-description').innerText();
    assert.match(report, /残存節と同じ数/);
    assert.match(report, /両側の鎖が加速/);
    assert.doesNotMatch(report, /PRISM|PHASE|踏み下ろし/);
    assert.equal(await page.locator('.enemy-viewport canvas').count(), 1);
    await page.locator('#rotate-left').click();
    await page.locator('#view-reset').click();
    await page.screenshot({ path: `${output}/${production ? 'published' : 'local'}-report-${name}.png` });
    await page.locator('[data-worm="false"]').click();
    assert.match(await page.locator('.enemy-description').innerText(), /PRISM/);
    await page.locator('#report-close').click();
    await page.locator('#solo').click();
    await page.locator('#launch').click();
    await page.locator('#pause').click();
    await page.locator('#pause-leave').click();
    await page.locator('#pause-quit').click();
    await page.locator('#launch').waitFor({ state: 'visible' });
    let health;
    if (production) {
      const response = await page.request.get(base + '/api/health');
      assert.equal(response.status(), 200); health = await response.json(); assert.equal(health.ok, true);
    }
    assert.deepEqual(errors, []);
    results.push({ name, width, height, touch, js, hashes, health, errors, reportAndFormSwitch: true, sortieAndRetreat: true });
    await context.close();
  }
  writeFileSync(`${output}/${production ? 'published' : 'local'}-browser.json`, JSON.stringify({ pass: true, base, results }, null, 2));
  console.log('FOUNDRY SITE PASS:', base, 'desktop + touch, report/form/model, sortie/retreat' + (production ? ', asset hashes + health' : ''));
} finally { await browser.close(); }
