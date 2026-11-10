import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = 'https://swarm-front.melosalife-24.workers.dev';
const out = 'dist-validation/resume-release-20261110/ui';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const result = { at: new Date().toISOString(), base, passed: false, cases: [], errors: [], scope: '公開URL・隔離保存・実Chrome。通常ソロ導線と協力入口。実機・協力戦闘・CATENA遭遇は含まない。' };
try {
  for (const [width, height] of [[640, 360]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('swarm-front-player-name-v1', '公開確認'));
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    const failures = [];
    page.on('pageerror', e => result.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') failures.push({ text: m.text(), location: m.location() }); });
    await page.addLocatorHandler(page.locator('#pt-intro-skip'), async () => page.locator('#pt-intro-skip').click());
    const settle = () => page.waitForFunction(() => !document.querySelector('.split-shutter,.menu-route-shutter'));
    const tap = async selector => { await settle(); await page.locator(selector).click(); };
    await page.goto(base + '/front.html?coop=1', { timeout: 120000 });
    await page.locator('#room-id').waitFor();
    await expect(page.locator('#room-list-status')).toContainText('数字3桁');
    await settle();
    const coopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await page.screenshot({ path: `${out}/${width}-coop-entry.png` });
    await page.goto(base, { timeout: 120000 });
    await tap('.title-entry-start');
    await tap('#solo');
    await tap('[data-operation="advance"]');
    if (await page.locator('#pt-confirm').count()) await tap('#pt-confirm');
    await page.locator('#pt-start').waitFor();
    await settle();
    await page.screenshot({ path: `${out}/${width}-prep.png` });
    await tap('#pt-start');
    await page.getByRole('button', { name: 'タップで戦場へ' }).click({ timeout: 120000 });
    if (await page.locator('#pt-tutorial-skip').count()) await tap('#pt-tutorial-skip');
    if (await page.locator('#pt-intro-skip').count()) await tap('#pt-intro-skip');
    await page.locator('.operation-cue').waitFor({ state: 'detached' });
    await page.waitForTimeout(1500);
    const canvas = await page.locator('canvas').first().boundingBox();
    if (!canvas || canvas.width < 100 || canvas.height < 100) throw Error('実戦Canvas未表示');
    await page.screenshot({ path: `${out}/${width}-battle.png` });
    await tap('#pause');
    await page.locator('dialog[open]').waitFor();
    await page.screenshot({ path: `${out}/${width}-pause.png` });
    await page.getByRole('button', { name: 'タップで再開', exact: true }).click();
    await page.locator('#hud').waitFor({ state: 'visible' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${width}-battle-active.png` });
    result.cases.push({ width, height, coopEntry: true, coopOverflow, prep: true, battle: true, pause: true, canvas, consoleErrors: failures });
    if (failures.length) throw Error(`ブラウザエラー ${failures.length}件`);
    await context.close();
  }
  if (result.errors.length) throw Error('pageerrorあり');
  result.passed = true;
} catch (error) {
  result.failure = String(error);
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
    result.lastUrl = page.url();
    result.lastText = (await page.locator('body').innerText().catch(() => '')).slice(0, 2500);
  }
  process.exitCode = 1;
} finally {
  writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(result));
