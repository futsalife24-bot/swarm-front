import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const b = await chromium.launch({ channel: 'chrome' });
try {
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
  await p.goto('http://localhost:5193/scripts/android-performance-setup.html');
  await p.getByRole('button', { name: '専用試験データを作成' }).click();
  await p.getByRole('link', { name: 'ゲームを開く' }).waitFor();
  const raw = await p.evaluate(() => localStorage.getItem('swarm-front-shared-progress-v3'));
  const save = JSON.parse(raw);
  assert.equal(save.mode, 'normal');
  assert.equal(save.inventory[0].rarity, 4);
  assert.equal(save.inventory[1].rarity, 4);
  assert.equal(Object.keys(save.missions).length, 27);
  const stages = await p.evaluate(async () => {
    const { STAGES, HARROW_BRANCH } = await import('/src/shared/stages.ts');
    return { a: STAGES[0].name, b: STAGES[22].name, c: HARROW_BRANCH.name };
  });
  assert.deepEqual(stages, { a: '前哨掃討', b: '白嶺の反攻', c: '異翼の痕跡' });
  await p.reload();
  await p.getByRole('button', { name: '専用試験データを作成' }).click();
  await p.waitForFunction(() => document.querySelector('#status').textContent.includes('既存データあり'));
  assert.equal(await p.evaluate(() => localStorage.getItem('swarm-front-shared-progress-v3')), raw);
  fs.mkdirSync('dist-validation/android-performance', { recursive: true });
  fs.writeFileSync('dist-validation/android-performance/setup-checks.json', JSON.stringify({ passed: true,
    checks: ['isolated fixture creation using save writer lock', '27 stage unlocks', 'rank 4 existing weapons',
      'A/B/C stage names match', 'existing save rejected without mutation'], stages }, null, 2));
  console.log('PASS fixture and refusal to overwrite; PC only');
} finally { await b.close(); }
