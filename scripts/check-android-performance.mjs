import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyze, distribution } from './analyze-android-performance.mjs';
const out = 'dist-validation/android-performance';
fs.mkdirSync(out, { recursive: true });
assert.equal(distribution([10, 20, 60, 120]).p95, 120);
assert.equal(distribution([null, undefined]), null);
const synthetic = analyze({ schema: 1, frames: [
  { t: 0, dt: null, active: true, renderCpuMs: 1 },
  { t: 20, dt: 20, active: true, renderCpuMs: 1 },
  { t: 100, dt: 80, active: false, renderCpuMs: 1 },
  { t: 120, dt: 20, active: true, renderCpuMs: 1 },
], samples: [], inputToRender: [], events: [], elapsedMs: 120 });
assert.equal(synthetic.battle.frameMs.n, 1);
assert.equal(synthetic.battle.renderedFps, 50);
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(60000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5193/');
  if (await page.locator('#landscape-start').isVisible()) await page.locator('#landscape-start').click();
  await page.locator('#solo').click();
  await page.locator('#player-name').fill('Performance QA');
  await page.locator('#player-name-form button[type=submit]').click();
  await page.locator('#pt-confirm').click();
  const storageBefore = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  await page.evaluate(async () => {
    const { Renderer } = await import('/src/client/render.ts');
    window.__qaOriginalRender = Renderer.prototype.render;
    const { install } = await import('/scripts/android-performance-probe.mjs');
    await install({ sourceSha: '7827b9c07886efbad50c2bee3bf17a940b79a1fd', device: 'PC QA - not Android' });
    window.__androidPerf.start('A', 1);
  });
  await page.waitForFunction(() => window.__androidPerf.result().stopReason === 'duration');
  assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), storageBefore);
  assert(await page.evaluate(async () => (await import('/src/client/render.ts')).Renderer.prototype.render === window.__qaOriginalRender));
  await page.locator('#pt-start').click();
  await page.locator('#pt-enter').click();
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const skip = page.getByRole('button', { name: /スキップ/ }).first();
    if (await skip.isVisible()) await skip.click();
    if (await page.evaluate(() => window.__playtest.world?.enemies.length > 0 && !window.__playtest.encounterActive)) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.__androidPerf.start('A', 5));
  await page.waitForFunction(() => window.__androidPerf.result().stopReason === 'duration');
  const result = await page.evaluate(() => window.__androidPerf.result());
  assert(result.frames.some(f => f.active));
  assert(result.samples.some(s => s.render.calls > 0 && s.render.triangles > 0));
  assert(result.samples.every(s => Number.isFinite(s.objects)));
  assert(!JSON.stringify(result).includes('Performance QA'));
  assert(!JSON.stringify(result).includes('swarm-front-shared-progress-v3'));
  const skip = page.getByRole('button', { name: /スキップ/ }).first();
  if (await skip.isVisible()) await skip.click();
  await page.screenshot({ path: out + '/probe.png' });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON保存' }).click();
  const download = await downloadEvent;
  await download.saveAs(out + '/pc-qa.json');
  const reloaded = JSON.parse(fs.readFileSync(out + '/pc-qa.json', 'utf8'));
  assert.deepEqual(reloaded, result);
  const summary = analyze(reloaded);
  assert.equal(summary.physicalAndroidVerified, false);
  fs.writeFileSync(out + '/pc-qa.summary.json', JSON.stringify(summary, null, 2));
  await page.evaluate(() => window.__androidPerf.dispose());
  assert.equal(await page.locator('#android-perf').count(), 0);
  assert(await page.evaluate(async () => (await import('/src/client/render.ts')).Renderer.prototype.render === window.__qaOriginalRender));
  assert.deepEqual(errors, []);
  fs.writeFileSync(out + '/checks.json', JSON.stringify({ passed: true, platform: 'PC Chrome, not Android',
    checks: ['quantiles', 'active interval filtering', 'no probe save writes', 'timer stop', 'render hook restored',
      'real renderer counters', 'no player name export', 'JSON download/reload', 'analysis', 'dispose', 'no pageerrors'],
    frames: result.frames.length, samples: result.samples.length }, null, 2));
  console.log('PASS diagnostic collection/export/reload/analysis and cleanup; PC only');
} finally { await browser.close(); }
