import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin = process.env.BASE_ORIGIN || 'http://127.0.0.1:5362';
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const out = 'dist-validation/frame-rate';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const results = process.argv.includes('--coop-only') ? JSON.parse(fs.readFileSync(`${out}/ui-checks.json`, 'utf8')) : [];
const errors = [];
async function probe(page) {
  await page.evaluate(async () => {
    const { Renderer } = await import('/src/client/render.ts');
    if (window.__fpsProbeInstalled) return;
    window.__fpsProbeInstalled = true;
    const original = Renderer.prototype.render;
    Renderer.prototype.render = function (...args) {
      window.__fpsView = this;
      return original.apply(this, args);
    };
  });
  await page.waitForFunction(() => !!window.__fpsView);
}
try {
  for (const [width, height] of process.argv.includes('--coop-only') ? [] : [[1280, 582], [844, 390], [667, 375]]) {
    const page = await browser.newPage({ viewport: { width, height }, serviceWorkers: 'block' });
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin);
    await page.locator('#home-settings').click();
    await probe(page);
    const select = page.locator('[data-preference="frameRate"]');
    assert.equal(await select.inputValue(), '60');
    const before = await page.evaluate(() => localStorage.getItem('swarm-front-shared-progress-v3'));
    await select.selectOption('30');
    assert.equal(await page.evaluate(() => window.__fpsView.frameRate), 30);
    assert.equal(await page.evaluate(() => window.__fpsView.quality), 1);
    await select.scrollIntoViewIfNeeded();
    const layout = await select.evaluate(el => {
      const d = el.closest('dialog'), r = el.getBoundingClientRect(), b = d.querySelector('.menu-dialog-body');
      return { x: r.x, right: r.right, y: r.y, bottom: r.bottom, overflow: b.scrollWidth > b.clientWidth + 1 };
    });
    assert.ok(layout.x >= 0 && layout.right <= width && layout.y >= 0 && layout.bottom <= height && !layout.overflow);
    await page.screenshot({ path: `${out}/${width}-settings.png` });
    assert.equal(await page.evaluate(() => localStorage.getItem('swarm-front-shared-progress-v3')), before);
    await page.reload(); await page.locator('#home-settings').click(); await probe(page);
    assert.equal(await select.inputValue(), '30');
    assert.equal(await page.evaluate(() => window.__fpsView.frameRate), 30);
    // Actual WebGL draws: this measures the cap, not a phone performance guarantee.
    const samples = [];
    for (const fps of [30, 60]) {
      await select.selectOption(String(fps));
      samples.push(await page.evaluate(async fps => {
        const view = window.__fpsView, start = performance.now(), frame = view.renderer.info.render.frame;
        await new Promise(resolve => setTimeout(resolve, 2100));
        return { fps, seconds: (performance.now() - start) / 1000, draws: view.renderer.info.render.frame - frame };
      }, fps));
    }
    for (const s of samples) assert.ok(s.draws > 0 && s.draws / s.seconds <= s.fps + 2);
    // A refused storage write must leave both the selected value and renderer unchanged.
    await page.evaluate(() => {
      window.__originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'swarm-front-playtest-preferences-v1') throw new DOMException('full', 'QuotaExceededError');
        return window.__originalSetItem.call(this, key, value);
      };
    });
    await select.selectOption('30');
    assert.equal(await select.inputValue(), '60');
    assert.equal(await page.evaluate(() => window.__fpsView.frameRate), 60);
    await page.evaluate(() => { Storage.prototype.setItem = window.__originalSetItem; });
    await select.selectOption('30');
    if (width === 844) {
      await page.locator('#pt-layout').click();
      await page.locator('#layout-training').click();
      const frame = page.frameLocator('.training-frame');
      await frame.locator('#training-start:not(:disabled)').waitFor();
      const training = page.frames().find(f => f.url().includes('training=1'));
      await probe(training);
      assert.equal(await training.evaluate(() => window.__fpsView.frameRate), 30);
      await frame.locator('#training-start').click();
      await frame.locator('#training-exit').click();
    }
    results.push({ width, height, layout, samples, persisted: true, storageFailureProtected: true });
    fs.writeFileSync(`${out}/ui-checks.json`, JSON.stringify(results, null, 2));
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(45000);
  page.on('pageerror', e => errors.push(e.message));
  const endpoint = 'http://127.0.0.1:8799';
  const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(fs.readFileSync('.dev.vars', 'utf8'))?.[1];
  assert.ok(key);
  const response = await fetch(`${endpoint}/rooms`, { method: 'POST', headers: { 'X-Room-Creation-Key': key }, signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok);
  const { code } = await response.json();
  await page.addInitScript(() => localStorage.setItem('swarm-front-player-name-v1', '描画確認隊員'));
  await page.goto(`${origin}/?coop=1#${code}`);
  await page.locator('.coop-advanced summary').click();
  await page.locator('#endpoint').fill(endpoint);
  await page.locator('#launch').click();
  await page.locator('#back').click();
  await page.locator('#gear-settings').click(); await probe(page);
  await page.locator('#frame-rate').selectOption('30');
  assert.equal(await page.evaluate(() => window.__fpsView.frameRate), 30);
  await page.reload();
  await page.locator('.coop-advanced summary').click();
  await page.locator('#endpoint').fill(endpoint);
  await page.locator('#launch').click();
  await page.locator('#back').click();
  await page.locator('#gear-settings').click(); await probe(page);
  assert.equal(await page.locator('#frame-rate').inputValue(), '30');
  assert.equal(await page.evaluate(() => window.__fpsView.frameRate), 30);
  await page.locator('#frame-rate').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/coop-settings.png` });
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.locator('#launch').click();
  await page.locator('#begin:not(:disabled)').click();
  await page.waitForFunction(() => window.__swarm?.screen === 'battle' && window.__swarm.world?.time > 0);
  const startTime = await page.evaluate(() => window.__swarm.world.time);
  await page.waitForTimeout(2200);
  const endTime = await page.evaluate(() => window.__swarm.world.time);
  assert.ok(endTime - startTime > 1.5, 'server battle keeps real-time progress at 30fps');
  assert.equal(await page.evaluate(() => window.__fpsView.frameRate), 30);
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify({ results, coopPersisted: true, coopTimeDelta: endTime - startTime, trainingApplied: true, errors }, null, 2));
  console.log('PASS: 3 widths, 30/60 live WebGL cap, persistence, save failure, co-op settings, training');
} finally { await browser.close(); }
