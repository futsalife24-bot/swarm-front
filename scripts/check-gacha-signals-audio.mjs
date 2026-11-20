import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { IDS, render } from '../public/supply-reveal/sfx.js';

const dir = path.resolve('public/supply-reveal');
const out = path.resolve('docs/evidence/gacha-signals-20261115/audio.json');
const sounds = IDS.filter((id) => id.startsWith('sig-'));
const waves = sounds.map((id) => {
  const [left, right] = render(id);
  assert(left.length && left.length === right.length);
  assert(left.every(Number.isFinite) && right.every(Number.isFinite));
  const peak = left.reduce((v, x) => Math.max(v, Math.abs(x)), 0);
  assert(peak > 0 && peak <= 1.01);
  return { id, samples: left.length, seconds: left.length / 44100, peak };
});
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  if (pathname === '/') {
    res.setHeader('content-type', 'text/html');
    res.end('<button id="start">音を確認</button>');
    return;
  }
  const target = path.resolve(dir, '.' + pathname);
  if (!target.startsWith(dir + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
  res.setHeader('content-type', 'text/javascript'); fs.createReadStream(target).pipe(res);
});
let browser;
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async () => {
    const Native = window.AudioContext;
    window.audioProbe = { sources: 0, stopped: 0, contexts: [] };
    window.AudioContext = function (...args) {
      const ctx = new Native(...args), source = ctx.createBufferSource.bind(ctx);
      const compressor = ctx.createDynamicsCompressor.bind(ctx);
      ctx.createBufferSource = () => {
        const node = source(), stop = node.stop.bind(node);
        window.audioProbe.sources++;
        node.stop = (...params) => { window.audioProbe.stopped++; return stop(...params); };
        return node;
      };
      ctx.createDynamicsCompressor = () => {
        const node = compressor(), analyser = ctx.createAnalyser();
        analyser.fftSize = 1024; node.connect(analyser); ctx.probeAnalyser = analyser;
        return node;
      };
      window.audioProbe.contexts.push(ctx); return ctx;
    };
    const { createPlayer } = await import('/sfx.js');
    window.playerProbe = createPlayer();
    document.getElementById('start').onclick = () => window.playerProbe.unlock();
  });
  await page.click('#start');
  // Chromeはrunningへ変わってから実デバイスの時計が動くまで時間差がある。
  await page.waitForFunction(() => window.audioProbe.contexts[0].currentTime > 0.05);
  const playback = await page.evaluate(async (ids) => {
    const player = window.playerProbe, probe = window.audioProbe, rows = [];
    for (const id of ids) {
      player.play({ id, vol: 0.6 });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const ctx = probe.contexts[0], values = new Float32Array(1024);
      ctx.probeAnalyser.getFloatTimeDomainData(values);
      const rms = Math.sqrt(values.reduce((sum, x) => sum + x * x, 0) / values.length);
      rows.push({ id, rms, running: ctx.state === 'running', time: ctx.currentTime });
      player.stop();
    }
    const beforeMute = probe.sources;
    player.setMuted(true); player.play({ id: ids[0] });
    const muted = probe.sources === beforeMute;
    player.setMuted(false); player.play({ id: ids[0] }); player.stop();
    const stopped = probe.stopped >= ids.length + 1;
    player.dispose();
    return { rows, muted, stopped, closed: probe.contexts[0].state === 'closed' };
  }, sounds);
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out.replace('.json', '-attempt.json'), JSON.stringify(playback, null, 2));
  assert(playback.rows.every((row) => row.running && row.rms > 0.00001));
  assert(playback.muted && playback.stopped && playback.closed);
  assert.deepEqual(errors, []);
  const report = { waves, playback, errors, note: '初回2試行はChromeの冷起動でcurrentTime=0のうちに観測して失敗。時計の実進行を待つ検査へ修正。実ChromeのWebAudio信号確認。人間の実聴・実機スピーカーの音質は未確認。' };
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ sounds: sounds.length, finite: true, signal: true, muted: playback.muted, stopped: playback.stopped, closed: playback.closed, errors }));
} finally { await browser?.close(); server.close(); }
