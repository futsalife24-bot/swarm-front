import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const origin = process.env.VOICE_ORIGIN || 'http://127.0.0.1:5358';
const out = process.env.VOICE_OUTPUT || 'assets-src/voice-soldier-v2/young-soldier/browser-verification.json';
const expected = JSON.parse(fs.readFileSync('assets-src/voice-soldier-v2/young-soldier/manifest.json', 'utf8')).clips;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
const results = [];
try {
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#home-settings').click({ timeout: 60000 });
  await page.getByRole('button', { name: 'サウンドテスト', exact: true }).click();
  const select = page.getByLabel('試聴する音声');
  const media = page.getByLabel('音声試聴');
  assert.equal(await select.locator('optgroup[label="兵士ボイス"] option').count(), 11);
  for (const clip of expected) {
    await select.selectOption('voice:' + clip.id);
    await page.waitForFunction(id => {
      const a = document.querySelector('audio[aria-label="音声試聴"]');
      return a?.dataset.track === 'voice:' + id && a.ended && !a.error;
    }, clip.id, { timeout: 12000 });
    const result = await media.evaluate(a => ({ src: a.currentSrc, duration: a.duration, currentTime: a.currentTime, ended: a.ended, error: a.error?.code ?? null }));
    assert(result.src.endsWith('/assets/audio/voice-young-soldier-v1/' + clip.id + '.wav'));
    assert(Math.abs(result.duration - clip.seconds) < .001);
    results.push({ id: clip.id, ...result });
  }
  await page.screenshot({ path: out.replace(/\.json$/, '.png') });
  await page.goto(origin + '/front', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#home-settings').click({ timeout: 60000 });
  // Battle playback uses the real Sound/WebAudio implementation and actual world events.
  const battle = await page.evaluate(async () => {
    const { Sound } = await import('/src/client/audio.ts');
    const { createWorld, addPlayer, start } = await import('/src/shared/game.ts');
    const { STARTERS } = await import('/src/shared/defs.ts');
    const sound = new Sound();
    await sound.preload();
    await sound.unlock();
    await sound.decoding;
    const w = createWorld('young-voice-check');
    const p = addPlayer(w, 'voice-player', structuredClone(STARTERS.slice(0, 2)));
    start(w);
    w.enemies = [];
    sound.update(w, p.id, 0, true);
    w.time = 3;
    w.events.push({ id: (w.events.at(-1)?.id ?? 0) + 1, type: 'shot', owner: p.id, x: 0, y: 1, z: 0 });
    sound.update(w, p.id, 0, true);
    const speech = sound.speech;
    const loaded = [...sound.buffers.keys()].filter(k => k.startsWith('voice:'));
    const result = { loaded, activeSpeech: !!speech, duration: speech?.buffer?.duration, contextState: sound.context?.state };
    sound.stop();
    result.stopped = !sound.speech;
    return result;
  });
  assert.equal(battle.loaded.length, 11);
  assert.equal(battle.activeSpeech, true);
  assert.equal(battle.contextState, 'running');
  assert.equal(battle.stopped, true);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), origin, platform: 'Windows Chrome', pass: true, soundTest: results, battleFixture: battle, errors, limitations: '実Sound/WebAudioと実worldイベントの有限確認。人の聴感・全戦闘・実機性能の保証ではない' }, null, 2));
  console.log(JSON.stringify({ pass: true, clips: results.length, battle, errors }));
} finally {
  await browser.close();
}
