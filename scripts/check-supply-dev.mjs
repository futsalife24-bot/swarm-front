import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const site = (process.env.SUPPLY_SITE || 'http://127.0.0.1:8796').replace(/\/$/, '');
const host = new URL(site).hostname;
const local = ['127.0.0.1', 'localhost'].includes(host);
const label = local ? 'local' : 'public';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(repo, process.env.SUPPLY_DEV_OUTPUT || `docs/evidence/supply-dev-preview-20261111/${label}`);
const passwordFile = process.env.SUPPLY_PASSWORD_FILE;
const password = local ? 'test-only-random-developer-password' : process.env.SUPPLY_PASSWORD;
const storageState = process.env.SUPPLY_STORAGE_STATE;

if (!local && !storageState && !password && !passwordFile)
  throw Error('公開環境には SUPPLY_STORAGE_STATE、SUPPLY_PASSWORD、SUPPLY_PASSWORD_FILE のいずれかが必要です。');

const fullStorage = (page) => page.evaluate(() =>
  Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])));
const settle = (page) => page.waitForFunction(() =>
  !document.querySelector('.split-shutter,.menu-route-shutter'));
async function tap(page, selector) {
  // 正式ログインの遷移先も新しいdocumentなのでTAP STARTが再表示される。
  if (await page.locator('.title-entry-start').isVisible()) {
    await page.locator('.title-entry-start').click();
    await page.locator('dialog.title-entry').waitFor({ state: 'detached' });
  }
  await settle(page);
  await page.locator(selector).click();
}
async function selectEffect(page, effect) {
  const select = page.locator('[data-supply-preview-select]');
  const custom = page.locator('[data-game-select-for="supply-preview-effect"]');
  if (await custom.count()) {
    const index = await select.evaluate((element, value) =>
      [...element.options].findIndex((option) => option.value === value), String(effect));
    assert.ok(index >= 0, `選択肢がありません: ${effect}`);
    await tap(page, '[data-game-select-for="supply-preview-effect"]');
    await tap(page, `dialog[open] [data-option-index="${index}"]`);
  } else await select.selectOption(String(effect));
  assert.equal(await select.inputValue(), String(effect));
}

async function layout(page) {
  await settle(page);
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(dimensions.document <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1,
    `横方向にはみ出しています: ${JSON.stringify(dimensions)}`);
  for (const button of await page.locator('button:visible').all()) {
    const box = await button.boundingBox();
    if (!box) continue;
    assert.ok(box.x >= -1 && box.x + box.width <= dimensions.viewport + 1,
      `画面外のボタン: ${await button.getAttribute('id') || await button.textContent()}`);
  }
}

async function authenticate(page, context) {
  if (storageState) {
    await page.goto(site + '/?developer=1');
    await page.locator('#pt-developer-exit').waitFor();
  } else {
    await page.goto(site + '/');
    await page.locator('#home-settings').waitFor();
    if (await page.locator('.title-entry-start').isVisible()) {
      await page.locator('.title-entry-start').click();
      await page.locator('dialog.title-entry').waitFor({ state: 'detached' });
    }
    if (await page.locator('#landscape-start').isVisible())
      await page.locator('#landscape-start').click();
    await tap(page, '#home-settings');
    await tap(page, '#pt-developer-entry');
    const value = passwordFile ? (await import('node:fs/promises')).readFile(passwordFile, 'utf8') : password;
    await page.locator('#developer-password').fill((await value).trim());
    await tap(page, '#developer-login-submit');
    await page.locator('#pt-developer-exit').waitFor();
  }
  assert.equal(new URL(page.url()).searchParams.get('developer'), '1');
  if (await page.locator('#landscape-start').isVisible())
    await page.locator('#landscape-start').click();
  const response = await context.request.get(site + '/api/developer/session');
  assert.equal(response.ok(), true);
  assert.equal((await response.json()).authenticated, true);
}

async function run(viewport, browser) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block',
    ...(storageState ? { storageState } : {}) });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  const supplyRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^\/api\/supply\//.test(new URL(request.url()).pathname))
      supplyRequests.push(request.method());
  });
  const record = { viewport, scenarios: [], supplyRequests: 0, storagePreserved: false, errors };
  try {
    await authenticate(page, context);
    await tap(page, '#open-armory');
    const entry = page.locator('#pt-base-supply');
    await entry.waitFor();
    assert.equal(await entry.isEnabled(), true);
    await tap(page, '#pt-base-supply');
    await page.locator('[data-supply-preview-select]').waitFor();
    const before = await fullStorage(page);
    await layout(page);
    const size = `${viewport.width}x${viewport.height}`;
    await page.screenshot({ path: path.join(out, `${size}-entry.png`) });

    const play = async (kind, effect) => {
      if (kind === 'selected') {
        await selectEffect(page, effect);
        await tap(page, '[data-supply-preview-play]');
      } else {
        await tap(page, '[data-supply-preview-random]');
      }
      const overlay = page.locator('.gx-root');
      await overlay.waitFor({ state: 'visible' });
      await page.locator('[data-supply-preview-note]').filter({ hasText: '再生中です。' }).waitFor();
      const value = Number(await page.locator('[data-supply-preview-effect]').getAttribute('data-supply-preview-effect'));
      assert.ok(Number.isInteger(value) && value >= 0 && value <= 10, `演出値が不正です: ${value}`);
      if (kind === 'selected') assert.equal(value, effect);
      await layout(page);
      await page.screenshot({ path: path.join(out, `${size}-${kind}-${effect}-effect.png`) });
      await tap(page, '.gx-skip');
      for (let cut=0; cut<11 && !await page.locator('.gx-actions [data-id="close"]').isVisible(); cut++) { await page.waitForTimeout(550); await page.locator('.gx-root').click({position:{x:320,y:180}}); }
      const close = page.locator('.gx-actions [data-id="close"]');
      await close.waitFor({ state: 'visible' });
      await layout(page);
      await page.screenshot({ path: path.join(out, `${size}-${kind}-${effect}-result.png`) });
      await tap(page, '.gx-actions [data-id="close"]');
      await overlay.waitFor({ state: 'detached' });
      await page.locator('[data-supply-preview-select]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.gx-root').count(), 0);
      assert.deepEqual(await fullStorage(page), before);
      assert.equal(supplyRequests.length, 0);
      record.scenarios.push({ kind, selected: kind === 'selected' ? effect : null, played: value, cleanup: true });
    };

    for (let effect = 1; effect <= 10; effect++) await play('selected', effect);
    await play('random', 1);
    await play('random', 2);
    await layout(page);
    assert.deepEqual(errors, []);
    assert.deepEqual(await fullStorage(page), before);
    assert.equal(supplyRequests.length, 0);
    record.storagePreserved = true;
    record.supplyRequests = supplyRequests.length;
    record.ok = true;
    return record;
  } catch (error) {
    record.ok = false;
    record.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    await page.screenshot({ path: path.join(out, `${viewport.width}x${viewport.height}-failure.png`) }).catch(() => {});
    throw Object.assign(Error(record.error), { record });
  } finally {
    await context.close();
  }
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const results = { site, label, checkedAt: new Date().toISOString(), viewports: [] };
try {
  for (const viewport of [{ width: 844, height: 390 }, { width: 640, height: 360 }]) {
    try { results.viewports.push(await run(viewport, browser)); }
    catch (error) { results.viewports.push(error.record || { viewport, ok: false }); break; }
  }
  results.ok = results.viewports.length === 2 && results.viewports.every((row) => row.ok);
} finally {
  await browser.close();
  await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
if (!results.ok) {
  console.error('補給演出の実UI確認が失敗しました。詳細は results.json を確認してください。');
  process.exitCode = 1;
} else console.log('補給演出の実UI確認に成功しました。');
