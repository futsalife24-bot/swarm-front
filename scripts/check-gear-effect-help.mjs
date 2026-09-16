import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:5347';
const out = 'dist-validation/gear-effect-help';
fs.mkdirSync(out, { recursive: true });
const fixture = JSON.parse(fs.readFileSync('dist-validation/gear-pinned/fixture.json', 'utf8'));
const cases = [
  ['rifle', 'pierce', '貫通×3', '最大3体'],
  ['rifle', 'reserve', '残数装填', '上限50%'],
  ['shotgun', 'repel', '撃退散弾', '最大3m'],
  ['rocket', 'chain', '誘爆弾頭', '半径3.5m'],
  ['rifle', 'quick', 'ー', null],
  ['shotgun', 'pierce', 'ー', null],
  ['rifle', 'none', 'ー', null],
];
fixture.inventory = cases.map(([kind, effect], i) => ({ ...fixture.inventory[0], id: `help-${i}`, kind, effect, rarity: 1, power: 1.15 }));
fixture.soldiers.find(p => p.id === fixture.selectedSoldier).equipped = ['help-0', 'help-3'];
fixture.locks = [];
fixture.pending = [];
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
try {
  for (const [width, height] of [[844,390], [640,360]]) {
    const page = await browser.newPage({ viewport: { width,height }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await page.addInitScript(save => localStorage.setItem('swarm-front-progression-v2-normal', JSON.stringify(save)), fixture);
    await page.goto(origin);
    await page.locator('#solo').click();
    await page.locator('#player-name').fill('効果確認');
    await page.locator('#player-name-form button[type=submit]').click();
    for (const organizing of [false, true]) {
      if (organizing) await page.locator('#pt-organize').click();
      const before = await page.evaluate(() => localStorage.getItem('swarm-front-progression-v2-normal'));
      for (const [i, [,effect,label,description]] of cases.entries()) {
        const cell = page.locator(`[data-row="help-${i}"] .gear-effect`);
        assert.equal(await cell.innerText(), label);
        assert.ok([...label].length <= 4);
        if (description) {
          const button = cell.locator('button');
          await button.tap();
          const dialog = page.locator('.weapon-help-dialog[open]');
          assert.ok((await dialog.innerText()).includes(description));
          const box = await dialog.boundingBox();
          assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
          if (effect === 'reserve') await page.screenshot({ path: `${out}/${width}-${organizing}-dialog.png` });
          await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
          await page.locator('.weapon-help-dialog').waitFor({ state: 'detached' });
          assert.equal(await page.locator('.weapon-help-dialog').count(), 0);
          assert.ok(await button.evaluate(el => el === document.activeElement));
          await button.press('Enter');
          assert.equal(await page.locator('.weapon-help-dialog[open]').count(), 1);
          await page.keyboard.press('Escape');
          await page.locator('.weapon-help-dialog').waitFor({ state: 'detached' });
        } else {
          assert.equal(await cell.locator('button').count(), 0);
          await cell.tap();
          assert.equal(await page.locator('dialog[open]').count(), 0);
        }
      }
      await page.locator('[data-pinned] [data-effect-help]').tap();
      await page.locator('.weapon-help-dialog button').click();
      await page.locator('.weapon-help-dialog').waitFor({ state: 'detached' });
      assert.equal(await page.locator('[data-check]:checked').count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('swarm-front-progression-v2-normal')), before);
      await page.screenshot({ path: `${out}/${width}-${organizing}-list.png` });
      results.push({ width, height, organizing, cases: cases.length, saveUnchanged: true });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
