import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin = 'http://127.0.0.1:5362', out = 'dist-validation/frame-rate';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(45000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('swarm-front-player-name-v1', '描画検証'));
  await page.goto(origin);
  await page.locator('#solo').click();
  await page.locator('#pt-confirm').click();
  await page.locator('#pt-home').click();
  // Seed only already-seen introductions so an encounter modal cannot pause the clock sample.
  await page.evaluate(async () => {
    const { loadProgress, persistProgress } = await import('/src/client/progression-save.ts');
    const save = loadProgress('normal');
    for (const kind of ['crawler', 'ant', 'spider', 'spitter', 'hornet', 'boss', 'worm']) save.encounters[kind] = 'solo';
    persistProgress(save);
  });
  await page.reload(); await page.locator('#home-settings').waitFor();
  const before = await page.evaluate(() => localStorage.getItem('swarm-front-shared-progress-v3'));
  assert.ok(before);
  await page.locator('#home-settings').click();
  await page.locator('[data-preference="frameRate"]').selectOption('30');
  assert.equal(await page.evaluate(() => localStorage.getItem('swarm-front-shared-progress-v3')), before);
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.locator('#solo').click();
  await page.locator('#pt-start').click();
  await page.locator('#pt-enter').click();
  for (let i = 0; i < 12; i++) {
    const skip = page.getByRole('button', { name: /スキップ/ }).first();
    if (await skip.isVisible()) await skip.click();
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => window.__playtest?.screen === 'battle' && !window.__playtest.modalCount && !window.__playtest.paused);
  const start = await page.evaluate(() => ({ time: window.__playtest.world.time, wall: performance.now() }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2100);
  await page.keyboard.up('KeyW');
  const end = await page.evaluate(() => ({ time: window.__playtest.world.time, wall: performance.now(), modal: window.__playtest.modalCount }));
  assert.equal(end.modal, 0);
  assert.ok(end.time - start.time > 1.5);
  await page.locator('#pause').click();
  const paused = await page.evaluate(() => window.__playtest.world.time);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__playtest.world.time), paused);
  await page.screenshot({ path: `${out}/solo-paused.png` });
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/solo.json`, JSON.stringify({ savedProgressUnchanged: true, frameRate: 30, start, end, pauseFrozen: true, errors }, null, 2));
  console.log('PASS: 30fps solo battle clock, input, pause and progress preservation');
} finally { await browser.close(); }
