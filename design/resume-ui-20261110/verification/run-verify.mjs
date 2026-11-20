// 補給ポッド演出の実ブラウザ検証（Chrome / Playwright）。
// 使い方（rootで）：node design/resume-ui-20261110/verification/run-verify.mjs [--old <旧試作フォルダ>] [--no-shots]
// - 静的サーバーを127.0.0.1の空きポートで内部起動し、終了時に止める。外部へは送信しない。
// - 結果：verification/results.json、verification/shots/*.jpg、compare/*.jpg（--old 指定時）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const designDir = path.resolve(here, '..');
const repoRoot = path.resolve(designDir, '..', '..');
const require = createRequire(path.join(repoRoot, 'package.json'));
const { chromium } = require('playwright');
let sharp = null; try { sharp = require('sharp'); } catch { /* 比較画像は sharp がある時だけ */ }

const args = process.argv.slice(2);
const oldDir = args.includes('--old') ? path.resolve(args[args.indexOf('--old') + 1]) : null;
const SHOTS = !args.includes('--no-shots');
const SIZES = [[844, 390], [640, 360], [568, 320]];
const shotDir = path.join(here, 'shots');
const cmpDir = path.join(designDir, 'compare');
if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };
function serve(root) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const f = path.resolve(root, '.' + (u === '/' ? '/index.html' : u));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    }).listen(0, '127.0.0.1', () => ok(s));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { date: new Date().toISOString(), browser: null, sizes: {}, audit: null, behavior: {}, perf: {}, failures: [] };
const fail = (where, what) => { results.failures.push(`${where}: ${what}`); };

const srv = await serve(designDir);
const base = `http://127.0.0.1:${srv.address().port}`;
let oldSrv = null, oldBase = null;
if (oldDir) { oldSrv = await serve(oldDir); oldBase = `http://127.0.0.1:${oldSrv.address().port}`; }

let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); results.browser = `Google Chrome ${browser.version()}`; }
catch { browser = await chromium.launch(); results.browser = `Chromium ${browser.version()}（Playwright同梱）`; }

async function open(W, H, { reduced = false, fast = false, url = '/preview.html?check=1' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: false });
  await ctx.addInitScript(([r, f]) => { try { if (!localStorage.getItem('supply-reveal-preview-opt')) localStorage.setItem('supply-reveal-preview-opt', JSON.stringify({ reduce: r, fast: f })); } catch { /* noop */ } }, [reduced, fast]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + url);
  await page.waitForFunction(() => window.SupplyRevealPreview && window.__check);
  await page.evaluate(() => document.fonts?.ready);
  return { ctx, page, errors };
}
const ng = (c) => [...c.offscreen, ...c.small, ...c.clipped, ...c.overlap];
async function check(page, label) { return page.evaluate((l) => window.__check(l), label); }
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(shotDir, name + '.jpg'), type: 'jpeg', quality: 84 }); }
const startPreset = (page, kind, name, o) => page.evaluate(([k, n, oo]) => { const P = window.SupplyRevealPreview; P.start((k === 1 ? P.PRESETS1 : P.PRESETS10)[n], oo); }, [kind, name, o || {}]);
const state = (page) => page.evaluate(() => window.SupplyRevealPreview.reveal.state());
const seek = (page, t) => page.evaluate((tt) => window.SupplyRevealPreview.reveal.seek(tt), t);
const waitMs = (page, ms) => page.waitForTimeout(ms);
async function closeStage(page) {
  const vis = await page.evaluate(() => !document.querySelector('.sr-root').hidden);
  if (vis) { await page.evaluate(() => window.SupplyRevealPreview.reveal.close()); await waitMs(page, 320); }
}
// 区間の時刻（見せたい場面）を時間軸から取り出す
const times = (page, kind, name, reduced) => page.evaluate(([k, n, r]) => {
  const P = window.SupplyRevealPreview; const m = P.build(P.validate((k === 1 ? P.PRESETS1 : P.PRESETS10)[n]), r);
  const hi = m.pods.filter((p) => p.focus || !m.multi).sort((a, b) => a.open[0] - b.open[0]);
  return { dur: m.dur, omen: m.omenEnd - 0.05, wave: m.multi ? m.wave + 0.25 : null, open: hi.length ? hi[0].open[0] + 0.14 : null, focus: m.multi && hi.length ? hi[0].focus[0] + 0.45 : null, stops: m.stops, drop: m.pods[0].drop[0] + 0.12 };
}, [kind, name, reduced]);

/* 1. 予兆の正直さ・停止点の登録・new:false（全プリセット×通常/動き減、1/60秒刻み） */
{
  const { ctx, page, errors } = await open(844, 390);
  results.audit = await page.evaluate(() => window.SupplyRevealPreview.audit());
  results.audit.filter((r) => !r.ok).forEach((r) => fail('audit', `${r.name}${r.reduced ? '（動き減）' : ''} ${r.errs.join(' / ')}`));
  results.perf.stateAndApplyMsPerFrame10 = await page.evaluate(() => { const P = window.SupplyRevealPreview; P.start(P.PRESETS10['バディ＋SSR＋SR']); return P.reveal.perf(600); });
  if (errors.length) fail('console', errors.join(' | '));
  await ctx.close();
}

/* 2. 3サイズの配置：重なり・文字切れ・44px・画面外（通常の動き） */
for (const [W, H] of SIZES) {
  for (const reduced of [false, true]) {
    const key = `${W}x${H}${reduced ? '-reduced' : ''}`;
    const rows = [];
    const { ctx, page, errors } = await open(W, H, { reduced });
    const add = async (label, file) => { const c = await check(page, label); rows.push({ label, ng: ng(c) }); if (ng(c).length) fail(key, `${label} ${ng(c).join(', ')}`); if (file && !reduced) await shot(page, `${W}x${H}-${file}`); };
    await add('入口', 'launcher');
    for (const name of ['武装片', 'N武器', 'R武器', 'SR武器', 'SSR武器', 'バディ', 'バディ（所持済み）']) {
      const tm = await times(page, 1, name, reduced);
      await startPreset(page, 1, name); await waitMs(page, 80);
      if (!reduced) {
        await seek(page, tm.drop); await waitMs(page, 40); await add(`1連${name} 降下`, name === 'SSR武器' ? '1-ssr-a-drop' : null);
        await seek(page, tm.omen); await waitMs(page, 40); await add(`1連${name} 予兆`, name === 'SSR武器' ? '1-ssr-b-omen' : name === 'バディ' ? '1-buddy-b-omen' : null);
        await seek(page, tm.open); await waitMs(page, 40); await add(`1連${name} 開封`, name === 'SSR武器' ? '1-ssr-c-open' : name === 'SR武器' ? '1-sr-c-open' : null);
      }
      await page.evaluate(() => window.SupplyRevealPreview.reveal.skip()); await waitMs(page, 60);
      await add(`1連${name} 最終`, reduced ? null : name === 'SSR武器' ? '1-ssr-d-final' : name === 'バディ' ? '1-buddy-d-final' : name === 'SR武器' ? '1-sr-d-final' : name === 'N武器' ? '1-n-d-final' : null);
      await closeStage(page);
    }
    for (const name of ['バディ＋SSR＋SR', '長い名前の確認', '通常のみ']) {
      const tm = await times(page, 10, name, reduced);
      await startPreset(page, 10, name); await waitMs(page, 80);
      const tag = name === 'バディ＋SSR＋SR' ? '10-mix' : name === '長い名前の確認' ? '10-long' : '10-low';
      if (!reduced) { await seek(page, tm.drop + 0.2); await waitMs(page, 40); await add(`10連${name} 降下`, tag === '10-mix' ? `${tag}-a-drop` : null); }
      await seek(page, tm.omen); await waitMs(page, 40); await add(`10連${name} 予兆`, reduced ? null : `${tag}-b-omen`);
      await seek(page, tm.wave); await waitMs(page, 40); await add(`10連${name} 一斉開封`, reduced || tag === '10-low' ? null : `${tag}-c-wave`);
      if (tm.focus != null) { await seek(page, tm.focus); await waitMs(page, 40); await add(`10連${name} 個別開封`, reduced ? null : `${tag}-d-focus`); }
      // 停止点：通常再生と同じ advance→render を固定刻みで回し、停止したコマを検査する
      await page.evaluate(() => { const r = window.SupplyRevealPreview.reveal; r.seek(0); r.tap(); });
      let k = 0;
      for (const st of tm.stops) {
        await page.evaluate(() => window.SupplyRevealPreview.reveal.simulate(30));
        const s = await state(page);
        if (Math.abs(s.t - st) > 0.002 || !s.hold) fail(key, `${name} 停止点${st.toFixed(2)}で止まらない（t=${s.t}）`);
        await add(`10連${name} 停止${++k}`, reduced || tag !== '10-mix' ? null : `${tag}-e-stop${k}`);
        await waitMs(page, 560); await page.evaluate(() => window.SupplyRevealPreview.reveal.tap());
      }
      await page.evaluate(() => window.SupplyRevealPreview.reveal.skip()); await waitMs(page, 60);
      await add(`10連${name} 一覧`, reduced ? null : `${tag}-f-list`);
      await closeStage(page);
    }
    if (errors.length) fail(key, 'console ' + errors.join(' | '));
    results.sizes[key] = { scenes: rows.length, ng: rows.filter((r) => r.ng.length) };
    await ctx.close();
  }
}

/* 3. 操作：演出中のスキップ、停止点の保持、連打、多重化なし、new:false、中断と再開、2倍速 */
{
  const B = results.behavior;
  const { ctx, page, errors } = await open(844, 390);
  // 3-1 入口のボタンを実際にクリックして再生し、演出の途中でスキップを押す
  await page.selectOption('#preset10', 'バディ＋SSR＋SR');
  await page.click('.use[data-use="10"]');
  await waitMs(page, 900);
  const mid = await state(page);
  const skipBox = await page.locator('[data-sr="skip"]').boundingBox();
  const skipEnabled = await page.locator('[data-sr="skip"]').isEnabled();
  await page.click('[data-sr="skip"]');
  await waitMs(page, 120);
  const after = await state(page);
  const listVisible = await page.evaluate(() => getComputedStyle(document.querySelector('.sr-list')).visibility === 'visible');
  B.skipDuringPlayback = { tBeforeSkip: mid.t, phaseBeforeSkip: mid.phase, skipButton: skipBox && { w: Math.round(skipBox.width), h: Math.round(skipBox.height) }, skipEnabled, tAfter: after.t, dur: after.dur, listVisible };
  if (!(mid.t > 0 && mid.t < mid.dur && skipEnabled && after.t === after.dur && listVisible)) fail('behavior', '演出中のスキップ');

  // 3-2 「同じ結果でもう一度」を11回（実クリック）→ 動いている再生処理の数を数える
  for (let i = 0; i < 11; i++) {
    await page.click('[data-sr-action="again"]');
    await waitMs(page, 340);
    await page.click('[data-sr="skip"]');
    await waitMs(page, 60);
  }
  await page.click('[data-sr-action="again"]');
  await waitMs(page, 400);
  const g1 = await page.evaluate(() => window.SupplyRevealPreview.reveal.ticksByGen());
  await waitMs(page, 400);
  const g2 = await page.evaluate(() => window.SupplyRevealPreview.reveal.ticksByGen());
  const live = Object.keys(g2).filter((k) => (g2[k] || 0) > (g1[k] || 0));
  B.noMultiplexAfterAgain = { liveLoops: live.length, generations: Object.keys(g2).length };
  if (live.length !== 1) fail('behavior', `再生処理が${live.length}本動いている`);

  // 3-3 実時間で停止点まで再生し、止まり続けるか・連打で流れないか
  const stops = (await state(page)).stops;
  let s = await state(page);
  for (let i = 0; i < 200 && !s.hold; i++) { await waitMs(page, 50); s = await state(page); }
  const heldAt = s.t;
  const center = { x: 422, y: 200 };
  // 停止直後（0.5秒未満）に8回タップしても流れない
  for (let i = 0; i < 8; i++) { await page.mouse.click(center.x, center.y); await waitMs(page, 35); }
  const s3 = await state(page);
  // タップしないまま2秒待っても止まったまま
  await waitMs(page, 2000);
  const s2 = await state(page);
  await page.mouse.click(center.x, center.y);
  await waitMs(page, 300);
  const s4 = await state(page);
  B.realtimeStop = { firstStop: stops[0], heldAt, stillHeldAfter2s: s2.hold && s2.t === heldAt, heldAfter8Taps: s3.hold && s3.t === heldAt, passedAfterHold: s4.t > heldAt || !s4.hold };
  if (Math.abs(heldAt - stops[0]) > 0.002 || !B.realtimeStop.stillHeldAfter2s || !B.realtimeStop.heldAfter8Taps || !B.realtimeStop.passedAfterHold) fail('behavior', '実時間の停止点');

  // 3-4 固定刻みで1倍・2倍の停止点（1コマで素通りしない）
  for (const fast of [false, true]) {
    const r = await page.evaluate(async (f) => {
      const R = window.SupplyRevealPreview.reveal; R.setFast(f); R.replay(); R.seek(0);
      await new Promise((ok) => setTimeout(ok, 150)); R.tap(); // 検証シークを解除（連打の間引き120msを空ける）
      const reached = []; const st = R.state().stops;
      for (const stop of st) {
        const x = R.simulate(30); // 30秒分を1/60秒刻みで進めても、停止点で止まるか
        const t0 = R.state().t; R.simulate(3);
        reached.push({ stop, t: x.t, hold: x.hold, firstHoldFrame: x.holdsReached[0] ?? null, movedWhileHeld: R.state().t !== t0 });
        await new Promise((ok) => setTimeout(ok, 520)); R.tap(); // 0.5秒後のタップで次へ
      }
      R.setFast(false); return reached;
    }, fast);
    B[fast ? 'stops2x' : 'stops1x'] = r;
    if (r.some((x) => x.movedWhileHeld || !x.hold || Math.abs(x.t - x.stop) > 0.002)) fail('behavior', `${fast ? '2倍' : '1倍'}で停止点を通過`);
  }
  await page.evaluate(() => window.SupplyRevealPreview.reveal.skip());
  await closeStage(page);

  // 3-5 new:false のバディに「新しい」「NEW」を出さない
  await startPreset(page, 1, 'バディ（所持済み）'); await waitMs(page, 60);
  await page.evaluate(() => window.SupplyRevealPreview.reveal.skip()); await waitMs(page, 60);
  const owned = await page.evaluate(() => ({ sub: document.querySelector('.sr-cut-sub').textContent, newHidden: document.querySelector('.sr-cut-new').hidden, cardNew: document.querySelectorAll('.sr-new').length }));
  B.ownedBuddy = owned;
  if (/新しい/.test(owned.sub) || !owned.newHidden || owned.cardNew) fail('behavior', 'new:falseに新しい/NEW');
  await closeStage(page);

  // 3-6 中断と再開：途中で再読み込み → 入口の案内 → 結果を見る → 入力どおりの一覧
  await page.selectOption('#preset10', 'SSR＋SR');
  await page.click('.use[data-use="10"]');
  await waitMs(page, 700);
  await page.reload();
  await page.waitForFunction(() => window.SupplyRevealPreview);
  const banner = await page.locator('#resume').isVisible();
  await page.click('#resume-open');
  await waitMs(page, 200);
  const resumed = await page.evaluate(() => ({ tiles: [...document.querySelectorAll('.sr-tile')].map((t) => t.getAttribute('aria-label')), final: window.SupplyRevealPreview.reveal.state(), pending: sessionStorage.getItem('supply-reveal-preview-pending') }));
  const expected = await page.evaluate(() => window.SupplyRevealPreview.PRESETS10['SSR＋SR'].length);
  B.resume = { bannerShown: banner, tiles: resumed.tiles.length, atFinal: resumed.final.t === resumed.final.dur, pendingCleared: resumed.pending === null };
  if (!banner || resumed.tiles.length !== expected || !B.resume.atFinal || !B.resume.pendingCleared) fail('behavior', '中断と再開');
  await closeStage(page);

  // 3-7 動き減の途中切替：結果は変わらず、到達済みの段から続く
  await startPreset(page, 10, 'SSR＋SR'); await waitMs(page, 50);
  await seek(page, 2.0);
  const before = await page.evaluate(() => [...document.querySelectorAll('.sr-tile')].map((t) => t.getAttribute('aria-label')).join('|'));
  await page.click('[data-sr="reduce"]');
  await waitMs(page, 80);
  const afterR = await page.evaluate(() => ({ list: [...document.querySelectorAll('.sr-tile')].map((t) => t.getAttribute('aria-label')).join('|'), reduced: document.querySelector('.sr-root').dataset.reduced }));
  B.reduceToggle = { sameResults: before === afterR.list, reduced: afterR.reduced === '1' };
  if (!B.reduceToggle.sameResults || !B.reduceToggle.reduced) fail('behavior', '動き減の切替');
  await page.click('[data-sr="reduce"]');
  await closeStage(page);

  // 3-8 実時間の描画間隔（このPC・ヘッドレスChrome。端末性能の代わりにはならない）
  await startPreset(page, 10, 'バディ＋SSR＋SR');
  const fr = await page.evaluate(() => new Promise((ok) => { const ts = []; const f = (t) => { ts.push(t); if (ts.length < 180) requestAnimationFrame(f); else ok(ts); }; requestAnimationFrame(f); }));
  const d = fr.slice(1).map((t, i) => t - fr[i]).sort((a, b) => a - b);
  results.perf.realtimeFrameMs = { median: +d[Math.floor(d.length / 2)].toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2), frames: d.length };
  if (errors.length) fail('behavior', 'console ' + errors.join(' | '));
  await ctx.close();
}

/* 4. 旧試作との比較画像（同じ結果・同じ場面を左右に並べる） */
if (oldBase && sharp && SHOTS) {
  fs.mkdirSync(cmpDir, { recursive: true });
  const scenes = [
    ['1-ssr-omen', 1, 'SSR武器', 'omen'], ['1-ssr-open', 1, 'SSR武器', 'open'], ['1-ssr-cut', 1, 'SSR武器', 'stop0'],
    ['1-sr-final', 1, 'SR武器', 'end'], ['10-mix-omen', 10, 'バディ＋SSR＋SR', 'omen'], ['10-mix-wave', 10, 'バディ＋SSR＋SR', 'wave'],
    ['10-mix-focus', 10, 'バディ＋SSR＋SR', 'focus'], ['10-mix-buddy', 10, 'バディ＋SSR＋SR', 'stop1'], ['10-mix-list', 10, 'バディ＋SSR＋SR', 'end'],
  ];
  const cap = async (b, isOld, kind, name, when, file) => {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(b + (isOld ? '/index.html' : '/preview.html'));
    await page.waitForFunction((o) => (o ? window.GachaProto : window.SupplyRevealPreview), isOld);
    const t = await page.evaluate(([o, k, n, w]) => {
      const A = o ? window.GachaProto : window.SupplyRevealPreview;
      const raw = (k === 1 ? A.PRESETS1 : A.PRESETS10)[n];
      const m = A.build(A.validate(raw), false);
      const hi = m.pods.filter((p) => p.focus || !m.multi).sort((a, b2) => a.open[0] - b2.open[0]);
      const T = { omen: m.omenEnd - 0.05, open: hi[0] && hi[0].open[0] + 0.14, wave: m.multi ? m.wave + 0.25 : 0, focus: m.multi && hi[0] ? hi[0].focus[0] + 0.45 : 0, stop0: m.stops[0], stop1: m.stops[1], end: m.dur }[w];
      if (o) { A.play(raw); } else { A.start(raw); }
      return T;
    }, [isOld, kind, name, when]);
    await page.waitForTimeout(150);
    await page.evaluate(([o, tt]) => { const A = o ? window.GachaProto : window.SupplyRevealPreview.reveal; A.seek(tt); }, [isOld, t]);
    await page.waitForTimeout(150);
    await page.screenshot({ path: file, type: 'png' });
    await ctx.close();
  };
  for (const [id, kind, name, when] of scenes) {
    const a = path.join(cmpDir, `_old-${id}.png`), b = path.join(cmpDir, `_new-${id}.png`);
    await cap(oldBase, true, kind, name, when, a);
    await cap(base, false, kind, name, when, b);
    await sharp({ create: { width: 844 * 2 + 12, height: 390, channels: 3, background: '#e8eef0' } })
      .composite([{ input: a, left: 0, top: 0 }, { input: b, left: 844 + 12, top: 0 }]).jpeg({ quality: 84 }).toFile(path.join(cmpDir, `${id}.jpg`));
    fs.rmSync(a); fs.rmSync(b);
  }
  results.compare = scenes.map((s) => `compare/${s[0]}.jpg`);
}

await browser.close();
srv.close(); oldSrv?.close();
results.ok = results.failures.length === 0;
fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ ok: results.ok, browser: results.browser, failures: results.failures.slice(0, 20), sizes: Object.fromEntries(Object.entries(results.sizes).map(([k, v]) => [k, `${v.scenes}場面 NG${v.ng.length}`])), behavior: results.behavior, perf: results.perf }, null, 1));
