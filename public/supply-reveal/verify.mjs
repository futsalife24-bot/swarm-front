import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ADOPTED, choosePlan, phaseOf, validatePlan } from './effect-selection.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const evidenceAt = process.argv.indexOf('--evidence');
const evidence = path.resolve(root, evidenceAt < 0 ? 'docs/evidence/gacha-signals-20261115' : process.argv[evidenceAt + 1]);
const foundation = process.argv.includes('--foundation');
const narrow = process.argv.includes('--narrow');
if (narrow && foundation) throw Error('--narrow と --foundation は併用できません');
const effectAt = process.argv.indexOf('--effect');
const only = effectAt < 0 ? null : process.argv[effectAt + 1];
if (effectAt >= 0 && !only) throw Error('--effect に演出IDが必要です');
const adopted = [1, 2, 3, 4, 9, 10, 'response', 'signature', 'heartbeat', 'multilock', 'sonic', 'reverse', 'reverseSeal', 'lamp', 'landing', 'delayed', 'skeleton'];
const enabled = foundation ? adopted.slice(0, 6) : adopted;
const effect = only && /^\d+$/.test(only) ? Number(only) : only;
if (only && !enabled.includes(effect)) throw Error('対象外の演出IDです');
const narrowSet = ['response', 'signature', 'heartbeat', 'lamp', 'sonic', 'landing', 'delayed', 'skeleton'];
const selected = only ? [effect] : narrow ? narrowSet : enabled;
const suffix = narrow ? '-narrow' : '';

function inspectCombinations() {
  const end = (first, last, lastColor) => ({
    multi: true,
    tiers: [first, 1, 1, 1, 1, 1, 1, 1, 1, last],
    initialTiers: [1, 1, 1, 1, 1, 1, 1, 1, 1, lastColor],
  });
  const cases = {
    '単発SSR': { multi: false, tiers: [4] },
    '単発BUDDY': { multi: false, tiers: [5] },
    '10連SSR1': end(4, 3, 2),
    '10連SSR複数': end(4, 4, 2),
    '10連BUDDY最後SR': end(5, 3, 2),
    '10連最後SSRデフォルト': end(4, 4, 1),
    '10連最後SSRのみデフォルト': end(1, 4, 1),
  };
  const byPhase = [0, 1, 2].map((phase) => [0, ...ADOPTED.filter((cue) => phaseOf(cue) === phase)]);
  const summary = {};
  for (const [name, m] of Object.entries(cases)) {
    let accepted = 0, rejected = 0, badTargets = 0, multiAccepted = 0;
    const reasons = {};
    for (const launch of byPhase[0]) for (const drop of byPhase[1]) for (const reveal of byPhase[2]) {
      try {
        const plan = choosePlan(m, [launch, drop, reveal]);
        validatePlan(m, plan);
        accepted++;
        if (plan.phases.filter(Boolean).length > 1) multiAccepted++;
        for (let phase = 0; phase < 3; phase++) {
          const cue = plan.phases[phase], index = plan.targets[phase];
          const targetRequired = [3, 4, 9, 10, 'heartbeat', 'sonic', 'landing', 'delayed', 'skeleton'].includes(cue);
          const tier = index === null ? null : m.tiers[index];
          if (targetRequired ? (index === null || ([10, 'heartbeat'].includes(cue)
            ? tier !== 5 : [3, 9].includes(cue) ? tier !== 4 : tier < 4)) : index !== null) badTargets++;
        }
      } catch (error) {
        rejected++;
        reasons[error.message] = (reasons[error.message] || 0) + 1;
      }
    }
    const total = byPhase.reduce((count, group) => count * group.length, 1);
    if (accepted + rejected !== total || badTargets) throw Error(`組合せ検査失敗: ${name}`);
    summary[name] = { total, accepted, rejected, multiAccepted, badTargets, reasons };
  }
  return summary;
}
const combinations = inspectCombinations();
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  if (pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/gacha.css"><div id="host"></div>');
    return;
  }
  const target = path.resolve(dir, '.' + decodeURIComponent(pathname));
  if (!target.startsWith(dir + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
});
let browser;
const errors = [], rows = [], live = [];
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext({ viewport: narrow ? { width: 640, height: 360 } : { width: 844, height: 390 } })).newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async () => {
    const { createSupplyReveal } = await import('/runtime.js');
    window.gachaCheck = createSupplyReveal(document.getElementById('host'), { sound: false, haptics: false });
    await window.gachaCheck.ready;
  });
  fs.mkdirSync(evidence, { recursive: true });

  const inspect = async (name, request, fixture, reduced = false, capture = false) => {
    const found = await page.evaluate(async ({ request, fixture, reduced, foundation, only, adopted }) => {
      const { PRESETS1, PRESETS10, tierOf } = await import('/core.js');
      const { phaseOf, validatePlan } = await import('/effect-selection.js');
      const { signalLayers } = await import('/signal-timeline.js');
      const api = window.gachaCheck;
      const values = structuredClone(fixture.includes('single')
        ? PRESETS1[fixture.includes('buddy') ? 'バディ' : 'SSR武器']
        : PRESETS10[fixture.includes('buddy') ? 'バディ＋SSR＋SR' : 'SSR＋SR']);
      if (values.length === 10) values[9] = { ...PRESETS1['SR武器'][0] };
      if (fixture === 'ten-two') values[9] = { ...PRESETS1['SSR武器'][0] };
      if (fixture === 'ten-last-only') {
        values[5] = { ...PRESETS1['R武器'][0] };
        values[9] = { ...PRESETS1['SSR武器'][0] };
      }
      const before = JSON.stringify(values), tiers = values.map(tierOf);
      const initialTiers = tiers.map(() => 1);
      if (tiers.length === 10 && tiers[9] === 3) initialTiers[9] = 2;
      if (fixture === 'ten-two') initialTiers[9] = 2;
      api.setReduced(reduced);
      await api.play(values, { effects: request, initialTiers, manual: true, silent: true,
        signalCandidates: foundation ? [1, 2, 3, 4, 9, 10]
          : only ? [...adopted.slice(0, 6), request] : undefined });
      const plan = api.state().plan, model = api.model();
      const expectedPhase = typeof request === 'number' || typeof request === 'string' ? phaseOf(request) : null;
      const selectedCue = expectedPhase === null || plan.phases[expectedPhase] === request;
      const targetValid = plan.targets.every((index, phase) => index === null ||
        (index >= 0 && index < values.length && ([10, 'heartbeat'].includes(plan.phases[phase])
          ? tiers[index] === 5 : tiers[index] >= 4)));
      const resultSame = before === JSON.stringify(values)
        && before === JSON.stringify(model.results.map(({ initialTier, ...value }) => value));
      const target = expectedPhase === null ? null : plan.targets[expectedPhase];
      const suggested = expectedPhase === 0 ? model.tLaunch * 0.85
        : expectedPhase === 1 && target !== null ? model.pods[target].tLand + 0.25
        : expectedPhase === 1 ? model.tLaunch + 1
        : expectedPhase === 2 && target !== null ? model.pods[target].beats[0].t0 + 0.2
        : model.tLaunch;
      const newCue = typeof request === 'string';
      const samples = [];
      if (newCue) for (let candidate = 0; candidate <= model.tEnd; candidate += 0.08) {
        if (signalLayers(plan, model, candidate, candidate + 0.25).some((layer) => layer.id === request))
          samples.push(candidate);
      }
      const firstSampleTime = samples.length ? samples[Math.floor(samples.length / 2)] : null;
      const p = target === null ? null : model.pods[target];
      const t = newCue && expectedPhase === 0 ? model.tLaunch
        : request === 'heartbeat' && p ? p.tLand + 0.4
        : request === 'sonic' && p ? p.tLand + 0.04
        : request === 'landing' && p ? p.tLand + 0.2
        : request === 'delayed' && p ? p.beats[0].t0 + 0.25
        : request === 'skeleton' && p ? p.beats[0].t0 + 0.25
        : samples.length ? samples[Math.floor(samples.length / 2)] : suggested;
      const idle = newCue && expectedPhase === 0 ? 1 : 0.25;
      const legacyFx = request === 4 && p ? { id: 'presage', p: { x: 422 + p.x, gy: p.gy, h: p.h, k: 1, a: 1 } }
        : request === 9 && p ? { id: 'shatter', p: { x: 422 + p.x, cy: p.gy - p.h / 2, crack: 1, fall: 0.3 } }
        : request === 10 ? { id: 'jack', p: { g: 1, w: 1, a: 1 } } : null;
      api.seek(t, idle, false, legacyFx);
      const oldThird = [4, 9, 10].includes(request) && api.timeline().some((item) =>
        item.fx === ({ 4: 'presage', 9: 'shatter', 10: 'jack' })[request]);
      const podWaitAtBeat = !fixture.includes('single') || !['delayed', 'skeleton'].includes(request)
        || api.timeline().some((item) => item.wait === 'pod' &&
          Math.abs(item.a - p.beats[0].t0) < 1e-4);
      return { plan, planValid: validatePlan({ tiers, multi: values.length === 10, initialTiers }, plan),
        selectedCue, targetValid, resultSame, visible: !api.root.hidden, oldThird, podWaitAtBeat,
        layerFound: !newCue || samples.length > 0, sampleTime: t, firstSampleTime, idle };
    }, { request, fixture, reduced, foundation, only, adopted });
    if (!found.planValid || !found.selectedCue || !found.targetValid || !found.resultSame || !found.visible
      || !found.layerFound || !found.podWaitAtBeat
      || ([4, 9, 10].includes(request) && !found.oldThird)) throw Error(`${name}: ${JSON.stringify(found)}`);
    if (capture) await page.screenshot({ path: path.join(evidence, `${name}${suffix}.png`) });
    let tailTime = null;
    let backTime = null;
    if (capture && request === 'reverseSeal') {
      backTime = await page.evaluate(() => {
        const api = window.gachaCheck, t = api.model().tLaunch * 0.58;
        api.seek(t, 0, false);
        return t;
      });
      await page.screenshot({ path: path.join(evidence, `${name}-reverse-back${suffix}.png`) });
    }
    if (capture && request === 'heartbeat') {
      tailTime = await page.evaluate(() => {
        const api = window.gachaCheck, plan = api.state().plan, p = api.model().pods[plan.targets[1]];
        const t = p.tFall + (p.tLand - p.tFall) * 0.94;
        api.seek(t, 0.25, false);
        return t;
      });
      await page.screenshot({ path: path.join(evidence, `${name}-tail${suffix}.png`) });
      await page.evaluate(() => {
        const api = window.gachaCheck, plan = api.state().plan, p = api.model().pods[plan.targets[1]];
        api.seek(p.tFall + (p.tLand - p.tFall) * 0.6, 0.25, false);
      });
      await page.screenshot({ path: path.join(evidence, `${name}-tail-early${suffix}.png`) });
    }
    rows.push({ name, request, fixture, reduced, phases: found.plan.phases,
      targets: found.plan.targets, sampleTime: found.sampleTime,
      firstSampleTime: found.firstSampleTime, tailTime, backTime, idle: found.idle,
      layerFound: found.layerFound, podWaitAtBeat: found.podWaitAtBeat });
    await page.evaluate(() => window.gachaCheck.close());
  };

  for (const cue of selected) {
    const buddy = [10, 'response', 'signature', 'heartbeat'].includes(cue);
    await inspect(`${cue}-ten`, cue, buddy ? 'ten-buddy' : 'ten-ssr', false, true);
    await inspect(`${cue}-ten-reduced`, cue, buddy ? 'ten-buddy' : 'ten-ssr', true, true);
    if (!foundation) {
      await inspect(`${cue}-single`, cue, buddy ? 'single-buddy' : 'single-ssr', false, true);
      await inspect(`${cue}-single-reduced`, cue, buddy ? 'single-buddy' : 'single-ssr', true, true);
    }
  }
  if (!only && !narrow) {
    const combos = foundation ? [
      ['old-three', [1, 2, 10], 'ten-buddy'],
      ['old-two-ssr', [1, 3, 9], 'ten-two'],
    ] : [
      ['buddy-three', ['signature', 'heartbeat', 10], 'ten-buddy'],
      ['ssr-three', ['reverse', 'landing', 'delayed'], 'ten-two'],
      ['old-new', [1, 'sonic', 4], 'ten-two'],
    ];
    for (const [name, request, fixture] of combos) await inspect(name, request, fixture, false, true);
    const implicit = await page.evaluate(async ({ foundation }) => {
      const { PRESETS1, PRESETS10 } = await import('/core.js');
      const api = window.gachaCheck, values = structuredClone(PRESETS10['SSR＋SR']);
      values[5] = { ...PRESETS1['R武器'][0] };
      values[9] = { ...PRESETS1['SSR武器'][0] };
      const initialTiers = values.map(() => 1);
      await api.play(values, { effects: false, initialTiers, manual: true, silent: true,
        signalCandidates: foundation ? [1, 2, 3, 4, 9, 10] : undefined });
      const plan = api.state().plan;
      api.close();
      let conflict = false;
      try { await api.play(values, { effects: [0, 2, 0], initialTiers, manual: true, silent: true }); }
      catch { conflict = true; }
      api.close();
      return { phases: plan.phases, implicitLast: plan.implicitLast, conflict };
    }, { foundation });
    if (implicit.phases[1] !== 'last-default' || !implicit.implicitLast || !implicit.conflict)
      throw Error(`最後枠の検査失敗: ${JSON.stringify(implicit)}`);
    rows.push({ name: 'last-default', ...implicit });
  }

  const liveCases = only || narrow ? [] : foundation ? [[1, 2, 10]] : [
    ['signature', 'heartbeat', 10], ['reverse', 'landing', 'delayed'], [1, 'sonic', 4],
  ];
  for (const request of liveCases) {
    const result = await page.evaluate(async ({ request, foundation }) => {
      const { PRESETS10, STOP_HOLD_MS } = await import('/core.js');
      const api = window.gachaCheck, values = structuredClone(PRESETS10['バディ＋SSR＋SR']);
      values[9] = { type: 'weapon', rarity: 'SR', name: '検査用SR' };
      const initialTiers = values.map(() => 1); initialTiers[9] = 2;
      api.setFast(true); api.setReduced(false);
      await api.play(values, { effects: request, initialTiers, silent: true,
        signalCandidates: foundation ? [1, 2, 3, 4, 9, 10] : undefined });
      // 2倍速の実再生時間＋タップ禁止時間から待機上限を決める。旧20秒は正常完走実績20.093秒より短い。
      const timeline = api.timeline();
      const motionMs = timeline.reduce((sum, part) => sum + part.d * 500, 0);
      const holdMs = timeline.reduce((sum, part) => sum + (STOP_HOLD_MS[part.wait] || 0), 0);
      const pollMs = timeline.filter((part) => part.wait).length * 90;
      const limitMs = Math.min(45000, Math.max(30000, Math.ceil((motionMs + holdMs + pollMs + 10000) / 1000) * 1000));
      const start = performance.now(); let taps = 0, progressAt = start, previous = api.state(), stalled = false;
      while (api.state().waiting !== 'final' && performance.now() - start < limitMs) {
        const state = api.state();
        if (state.part !== previous.part || state.t !== previous.t) { progressAt = performance.now(); previous = state; }
        if (performance.now() - progressAt > 5000) { stalled = true; break; }
        if (api.state().waiting && api.state().waiting !== 'fracture') { api.tap(); taps++; }
        await new Promise((resolve) => setTimeout(resolve, 90));
      }
      const result = { request, final: api.state().waiting === 'final',
        taps, ms: Math.round(performance.now() - start), motionMs, holdMs, limitMs, stalled };
      api.close();
      return result;
    }, { request, foundation });
    if (!result.final) throw Error(`ライブ再生未完了: ${JSON.stringify(result)}`);
    live.push(result);
  }
  const cleanup = await page.evaluate(async () => {
    const { PRESETS1 } = await import('/core.js');
    const api = window.gachaCheck;
    await api.play(PRESETS1['SSR武器'], { effects: 9, manual: true, silent: true });
    api.skip();
    const first = api.state().waiting;
    api.skip();
    const second = api.state().waiting;
    api.close(); api.destroy();
    return { confirmStillNeeded: first === 'cut' && second === 'cut',
      roots: document.querySelectorAll('.gx-root').length,
      caps: document.querySelectorAll('.kx-cap').length };
  });
  if (!cleanup.confirmStillNeeded || cleanup.roots || cleanup.caps || errors.length)
    throw Error(`後始末検査失敗: ${JSON.stringify({ cleanup, errors })}`);
  const mode = foundation ? 'foundation' : only ? `effect-${only}${suffix}` : narrow ? 'narrow' : 'all';
  const report = { mode, viewport: narrow ? [640, 360] : [844, 390], checked: rows.length,
    rows, live, cleanup, errors, combinations,
    fixtureNote: '旧PRESETS10の最終枠にはSR未満があるため、実検査では最後枠をSR/SSRの固定結果へ置換した。旧fixture不整合は今回の実装失敗に数えない。',
    samplingNote: '初回のsonic中央値カットは輪の出現前だった。firstSampleTimeを保持し、sonicはtLand+0.04へ変更。heartbeatはtLand+0.4の札と、降下94%の尾を別撮影。' };
  fs.writeFileSync(path.join(evidence, `verify-${mode}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode, checked: rows.length, viewport: report.viewport,
    combinations: Object.fromEntries(Object.entries(combinations).map(([name, item]) => [name,
      { accepted: item.accepted, rejected: item.rejected, badTargets: item.badTargets }])), live, cleanup, errors }));
} finally {
  await browser?.close();
  server.close();
}
