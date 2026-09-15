import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = process.env.HUD_SITE || 'http://127.0.0.1:5366';
const label = base.startsWith('https') ? 'published' : 'built';
const out = 'dist-validation/encounter-hud';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const rows = [];
try {
  for (const [width, height] of [[844, 390], [1280, 582]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/?playtest=1');
    await page.locator('#solo').click();
    await page.locator('#pt-confirm').click();
    await page.locator('#pt-start').click();
    await page.locator('#pt-enter').waitFor({ timeout: 90000 });
    await page.locator('#pt-enter').click();
    await page.evaluate(() => {
      window.hudFrames = [];
      const sample = () => {
        const d = document.querySelector('.pt-cutscene[open]');
        if (d) window.hudFrames.push({ phase: d.dataset.phase,
          displays: ['hud', 'controls', 'minimap', 'pause', 'damage', 'scope-overlay'].map(id => getComputedStyle(document.getElementById(id)).display) });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.locator('#pt-tutorial-skip').click();
    await page.locator('.pt-cutscene-ready').waitFor({ timeout: 90000 });
    const frames = await page.evaluate(() => window.hudFrames);
    assert.deepEqual([...new Set(frames.map(f => f.phase))], ['freeze', 'bars', 'zoom', 'text']);
    for (const f of frames) assert.ok(f.displays.every(d => d === 'none'), JSON.stringify(f));
    await page.screenshot({ path: `${out}/${label}-movie-${width}.png` });
    await page.locator('#pt-intro-skip').click();
    for (const id of ['hud', 'controls', 'minimap', 'pause']) await page.locator('#' + id).waitFor({ state: 'visible' });
    const fire = await page.locator('#fire').boundingBox();
    await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();
    await page.keyboard.press('r');
    await page.locator('.reload-cue').waitFor();
    await page.screenshot({ path: `${out}/${label}-resumed-${width}.png` });
    await page.locator('#pause').click();
    assert.deepEqual(errors, []);
    rows.push({ width, height, phases: [...new Set(frames.map(f => f.phase))], hiddenFrames: frames.length, restored: true, reloadVisibleAfterReturn: true, errors });
    await page.close();
    console.log('PASS', label, width);
  }
  fs.writeFileSync(`${out}/${label}.json`, JSON.stringify(rows, null, 2));
  if (label === 'published') {
    const assets = [];
    const sha = b => createHash('sha256').update(b).digest('hex');
    for (const file of ['index.html', 'sw.js', ...fs.readdirSync('dist/assets').filter(p => /\.(js|css)$/.test(p)).map(p => 'assets/' + p)]) {
      const response = await fetch(base + '/' + file);
      assert.equal(response.status, 200);
      const hash = sha(fs.readFileSync('dist/' + file));
      assert.equal(sha(Buffer.from(await response.arrayBuffer())), hash, file);
      assets.push({ file, sha256: hash });
    }
    assert.equal((await (await fetch(base + '/api/health')).json()).ok, true);
    fs.writeFileSync(`${out}/published-assets.json`, JSON.stringify(assets, null, 2));
    console.log('PASS published', assets.length, 'hashes and health');
  }
} finally { await browser.close(); }
