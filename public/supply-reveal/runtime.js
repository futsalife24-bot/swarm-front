import { createDropReveal, STOP_HOLD_MS } from './core.js';
import { install, reset as resetFx, set as setFx, setBuddyArt } from './kakutei-fx.js';
import { CLIPS } from './reference-scenes.js';
import { chooseEffect } from './effect-selection.js';

const clamp = (x) => Math.max(0, Math.min(1, x));
const tier = (r) => r.type === 'buddy' ? 5 : r.type === 'shard' ? 0 : ({ N: 1, R: 2, SR: 3, SSR: 4 })[r.rarity] ?? -1;
const sceneModel = (m) => ({ B: m.tLaunch, stops: m.stops, cues: m.cues, pods: m.pods });
const cueIn = (cue, a, b) => cue.t > a + 1e-5 && cue.t <= b + 1e-5;

/** 表示専用。結果の抽選・券・保存には一切関与しない。 */
export function createSupplyReveal(host, options = {}) {
  const o = { captions: false, ...options };
  const core = createDropReveal(host, { ...o, externalControls: true });
  let parts = [], pos = 0, elapsed = 0, presentationClock = 0, waiting = null, waitSince = 0, queued = false, active = false, closed = false;
  let fxNumber = 0, model = null, result = null, caption = null, raf = 0, last = 0;
  let muted = false, reduced = core.state().reduced, fast = core.state().fast, cleanupFx = null, heldPointer = false;
  let skipping = false;
  const confirmedCuts = new Set();
  const ready = Promise.all([core.ready, install(core, o.assetBase || new URL('./assets/', import.meta.url).href, () => reduced)]).then(([, cleanup]) => { if (closed) cleanup(); else cleanupFx = cleanup; });
  const visual = (p, sec, tap = false) => {
    const u = p.d ? clamp(sec / p.d) : 1;
    const state = p.fx ? p.fx(sec, u) : { id: null };
    const s = { ...state, caption: o.captions && fxNumber ? caption.caption : '', sub: o.captions && fxNumber ? caption.sub : '', gold: !!p.gold, notap: !!p.notap, right: !!caption?.right };
    if (reduced && s.p) {
      // 下限の色と形は保持し、揺れ・粒子・通信ノイズだけ抑える。
      if (s.id === 'jack') s.p = { ...s.p, g: 0, w: s.p.w };
      if (s.id === 'gold' || s.id === 'presage') s.p = { ...s.p, a: 0 };
    }
    setFx(s);
    const t = p.a + (p.b - p.a) * u;
    const A = p.refStart === undefined ? presentationClock : p.refStart + (p.d ? sec * p.refDuration / p.d : sec);
    core.seek(t, A - t, tap);
  };
  const cue = (c) => { if (!muted) core.playCue(c); o.onEvent?.({ type: 'cue', id: c.id }); };
  const current = () => parts[pos];
  const enter = (p) => {
    if (!p) return;
    for (const c of p.cues || []) if (c.at === 0) cue(c);
    if (p.wait) {
      if (queued && (p.wait === 'pod' || p.wait === 'promo') && !(fxNumber === 4 && p.fx)) { queued = false; advance(); return; }
      waiting = p.wait; waitSince = performance.now(); queued = false;
      o.onEvent?.({ type: p.wait === 'final' ? 'final' : 'stop', kind: p.wait, t: p.a });
    }
  };
  const advance = () => {
    pos++; elapsed = 0; waiting = null;
    if (pos < parts.length) enter(current());
    else { pos = parts.length - 1; waiting = 'final'; }
  };
  const render = () => {
    const p = current(); if (!p) return;
    visual(p, elapsed, !!waiting && waiting !== 'final');
    if (skipping && waiting === 'cut') core.root.querySelector('[data-act="skip"]').disabled = true;
  };
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)) * (fast ? 2 : 1); last = now;
    if (!active) return;
    if (waiting) { const prev = elapsed; elapsed += dt; presentationClock += dt; for (const c of current()?.cues || []) if (c.at > 0 && prev < c.at && c.at <= elapsed) cue(c); render(); return; }
    let remain = dt;
    while (remain > 0 && !waiting) {
      const p = current(); if (!p) break;
      const step = Math.min(remain, Math.max(0, p.d - elapsed));
      const prev = elapsed; elapsed += step; presentationClock += step; remain -= step;
      if (p.snd && !muted && p.b > p.a) {
        const a = p.a + (p.b - p.a) * prev / p.d, b = p.a + (p.b - p.a) * elapsed / p.d;
        for (const c of model.cues) if (cueIn(c, a, b)) cue(c);
      }
      for (const c of p.cues || []) if (c.at > 0 && prev < c.at && c.at <= elapsed) cue(c);
      if (elapsed >= p.d - 1e-6) advance();
      if (step <= 0 && !waiting) break;
    }
    render();
  };
  const motion = (a, b, opt = {}) => ({ a, b, d: Math.max(0, b - a), snd: true, ...opt });
  const waitPart = (s, fx = null, seg = null) => ({ a: s.t, b: s.t, d: 0, wait: s.kind, fx, gold: !!seg?.gold, notap: !!seg?.notap, refStart: seg?.refStart === undefined ? undefined : seg.refStart + seg.refDuration });
  const skippedParts = (indices) => [
    ...indices.map((i) => {
      const c = model.cuts.find((c) => c.p.i === i);
      return { ...waitPart({ t: c.tDone, kind: 'cut' }), skipCut: i };
    }),
    waitPart(model.stops.at(-1)),
  ];
  const append = (out, seg, stops, omit = new Set()) => {
    if (seg.b > seg.a + 1e-6) {
      let a = seg.a, used = 0;
      for (const s of stops) if (!omit.has(s) && s.t > a + 1e-5 && s.t < seg.b - 1e-5) {
        const ratio = (s.t - seg.a) / (seg.b - seg.a), d = seg.d * ratio - used, offset = used;
        out.push({ ...seg, a, b: s.t, d, refStart: seg.refStart === undefined ? undefined : seg.refStart + offset * seg.refDuration / seg.d, refDuration: seg.refStart === undefined ? undefined : seg.refDuration * d / seg.d, cues: (seg.cues || []).filter((c) => c.at >= offset && c.at < offset + d).map((c) => ({ ...c, at: c.at - offset })), fx: seg.fx ? (sec) => seg.fx(sec + offset, (sec + offset) / seg.d) : null });
        out.push(waitPart(s, seg.fx ? () => seg.fx(seg.d * ratio, ratio) : null, { ...seg, refStart: seg.refStart === undefined ? undefined : seg.refStart + ratio * seg.refDuration, refDuration: 0 }));
        a = s.t; used += d;
      }
      const offset = used;
      out.push({ ...seg, a, d: seg.d - offset, refStart: seg.refStart === undefined ? undefined : seg.refStart + offset * seg.refDuration / seg.d, refDuration: seg.refStart === undefined ? undefined : seg.refDuration * (seg.d - offset) / seg.d, cues: (seg.cues || []).filter((c) => c.at >= offset).map((c) => ({ ...c, at: c.at - offset })), fx: seg.fx ? (sec) => seg.fx(sec + offset, (sec + offset) / seg.d) : null });
    } else out.push(seg);
    const endpoint = stops.find((s) => Math.abs(s.t - seg.b) < 1e-5 && !omit.has(s));
    if (endpoint) out.push(waitPart(endpoint, seg.fx ? () => seg.fx(seg.d, 1) : null, seg));
  };
  const makeParts = (m, n) => {
    const stops = m.stops, out = [];
    if (!n) {
      let at = 0;
      for (const s of stops) { append(out, motion(at, s.t), [s]); at = s.t; }
      return out;
    }
    const clip = CLIPS[n - 1], M = sceneModel(m);
    const target = n === 4 ? m.pods.find((p) => p.tier >= 3)
      : n === 10 ? m.pods.find((p) => p.tier === 5)
      : [5, 6, 7, 8, 9].includes(n) ? m.pods.find((p) => p.tier === 4) : null;
    if (target) {
      const proxy = n === 4 ? { ...target, tier: 3 } : target;
      M.pods = [proxy, ...m.pods.filter((p) => p !== target)];
      if (n === 4) M.pods = m.pods.map((p) => p === target ? proxy : p);
    }
    const original = clip.make(M);
    let referenceAt = 0;
    for (const seg of original) { seg.refStart = referenceAt; seg.refDuration = seg.d; referenceAt += seg.d; }
    // 元動画は単体ポッドが画面中央。10連ではFXの座標だけ対象ポッドへ寄せる。
    if (target && m.multi && [5, 6, 8, 9].includes(n)) for (const s of original) if (s.fx) {
      const draw = s.fx;
      s.fx = (sec, u) => { const state = draw(sec, u); if (state.p && Number.isFinite(state.p.x)) state.p = { ...state.p, x: state.p.x + target.x }; return state; };
    }
    let segs = original.filter((s) => !s.tap), start = Math.min(...segs.map((s) => s.a)), end = Math.max(...segs.map((s) => s.b));
    // ④は停止点を跨がず、目印を待機中に表示する。
    if (n === 4) { start = target.tStop; end = start + 1.3; segs = [original[2]]; }
    // ⑦は最後の停止点から押下後に充填する。
    if (n === 7) { start = M.pods[0].last[0]; end = M.pods[0].tOpen + 1.396; segs = original.slice(1).map((s, i) => i === 1 ? { ...s, holdReady: true } : s); }
    // ⑧は静止の前後を元の時間軸へ戻す。
    if (n === 8) { start = M.pods[0].last[0]; end = M.pods[0].tOpen + 1.396; }
    // ⑨のカットインは元動画の時刻・状態をそのまま使用する。
    if (n === 9) { start = M.pods[0].hold[0]; end = M.pods[0].cut.c0 + 1.7; }
    // ⑩はバディ確定後に通信ジャックを挟む。
    if (n === 10) { start = M.pods[0].beats[1].t1 + 0.78; end = M.pods[0].beats[2].t1 + 1.296; }
    let at = 0;
    for (const s of stops) { if (s.t > start + 1e-5) break; if (s.t < start - 1e-5) { append(out, motion(at, s.t), [s]); at = s.t; } }
    if (start > at + 1e-5) append(out, motion(at, start), stops);
    if (n === 4) { const pod = out.findLast((p) => p.wait === 'pod' && Math.abs(p.a - start) < 1e-5); if (pod) { pod.fx = (sec) => original[1].fx(sec, clamp(sec / original[1].d)); pod.cues = original[1].cues; pod.refStart = original[1].refStart; } }
    const skipped = new Set(stops.filter((s) => s.t > start + 1e-5 && s.t < end - 1e-5 && [5, 6, 9, 10].includes(n) && (!target || s.i === target.i || (s.i === -1 && s.kind === 'cut'))));
    for (const seg of segs) append(out, { ...seg, d: reduced ? seg.d * 0.6 : seg.d }, stops.filter((s) => s.t > start + 1e-5 && s.t <= end + 1e-5), skipped);
    if (n === 1) { const launch = out.find((p) => p.wait === 'launch'); if (launch) { launch.fx = () => original[1].fx(0, 0); launch.gold = true; launch.refStart = original[1].refStart; } }
    at = end;
    for (const s of stops) if (s.t > at + 1e-5) { append(out, motion(at, s.t), [s]); at = s.t; }
    if (out.at(-1)?.wait !== 'final') out.push(waitPart(stops.at(-1)));
    return out.filter((p, i) => !(p.wait && out[i - 1]?.wait === p.wait && Math.abs(out[i - 1].a - p.a) < 1e-5));
  };
  const api = {
    ready,
    async play(results, cfg = {}) {
      if (closed) throw Error('破棄済みの演出です');
      if (active) api.close();
      await ready;
      resetFx();
      muted = !!cfg.silent;
      await core.play(results, { manual: true, silent: muted });
      model = core.model(); result = results;
      skipping = false; confirmedCuts.clear();
      fxNumber = chooseEffect(model, cfg.effects);
      setBuddyArt(fxNumber === 10 ? model.pods.find((p) => p.tier === 5)?.r.art : null);
      caption = fxNumber ? CLIPS[fxNumber - 1] : null;
      parts = makeParts(model, fxNumber); pos = 0; elapsed = 0; presentationClock = 0; waiting = null; queued = false; active = true;
      if (parts.length) enter(parts[0]);
      render(); last = performance.now(); cancelAnimationFrame(raf);
      if (!cfg.manual) raf = requestAnimationFrame(tick);
      o.onEvent?.({ type: 'play', n: model.n, effect: fxNumber });
    },
    tap() {
      if (!active || waiting === 'final') return;
      if (!waiting) { const next = parts.slice(pos + 1).find((p) => p.wait); if (next && (next.wait === 'pod' || next.wait === 'promo')) queued = true; return; }
      if (performance.now() - waitSince < (STOP_HOLD_MS[waiting] || 0)) return;
      if (waiting === 'cut') {
        const c = model.cuts.find((c) => Math.abs(c.tDone - current().a) < 1e-4);
        if (c) confirmedCuts.add(c.p.i);
      }
      advance(); render();
    },
    skip() {
      if (!active || waiting === 'final') return;
      if (skipping) return; // 獲得確認は再度スキップしても飛ばさない。
      const remaining = model.cuts.filter((c) => !confirmedCuts.has(c.p.i));
      if (remaining.length) {
        skipping = true; queued = false;
        parts = skippedParts(remaining.map((c) => c.p.i)); pos = 0; elapsed = 0; waiting = null;
        setFx(null); enter(parts[0]); render();
        return;
      }
      pos = parts.length - 1; elapsed = 0; waiting = 'final';
      const end = model.tEnd; setFx(null); core.seek(end, 0, false);
      cue({ id: 'done' });
      o.onEvent?.({ type: 'final', t: end, skipped: true });
    },
    close() { if (!active) return; active = false; cancelAnimationFrame(raf); setFx(null); core.close(); },
    destroy() { if (closed) return; api.close(); closed = true; cleanupFx?.(); root.removeEventListener('pointerdown', onPointer); root.removeEventListener('click', onClick, true); window.removeEventListener('pointerup', onRelease); window.removeEventListener('pointercancel', onRelease); window.removeEventListener('keydown', onKey); core.destroy(); },
    setFast(v) { fast = !!v; core.setFast(fast); },
    setReduced(v) { reduced = !!v; core.setReduced(reduced); if (active) { const old = current(), fr = old?.d ? elapsed / old.d : 0; model = core.model(); parts = skipping ? skippedParts(parts.filter((p) => p.skipCut !== undefined).map((p) => p.skipCut)) : makeParts(model, fxNumber); pos = Math.min(pos, parts.length - 1); elapsed = (current()?.d || 0) * fr; render(); } },
    setSound(v) { core.setSound(v); },
    seek(t, idle = 0, tap = false, fx = null) { setFx(fx); core.seek(t, idle, tap); },
    state() { return { active, effect: fxNumber, waiting, part: pos, skipping, t: current() ? current().a + (current().b - current().a) * (current().d ? elapsed / current().d : 1) : 0, reduced, fast }; },
    model() { return model; },
    timeline() { return parts.map((p) => ({ a: p.a, b: p.b, d: p.d, refStart: p.refStart, refDuration: p.refDuration, wait: p.wait || null, gold: !!p.gold, fx: p.fx?.(p.d * 0.5, 0.5)?.id || null, cues: (p.cues || []).map((c) => ({ at: c.at, id: c.id })), snd: !!p.snd })); },
    root: core.root,
    core,
  };
  const root = core.root;
  const onPointer = (e) => { if (e.target.closest('button')) return; heldPointer = true; api.tap(); };
  const onRelease = () => { heldPointer = false; if (active && fxNumber === 7 && current()?.holdReady && elapsed >= 0.05) { advance(); render(); } };
  const onClick = (e) => {
    const finalId = e.target.closest('.gx-actions [data-id]')?.dataset.id;
    if (finalId === 'close') { e.stopPropagation(); api.close(); o.onAction?.('close'); return; }
    const action = e.target.closest('[data-act]')?.dataset.act;
    if (!action) return;
    e.stopPropagation();
    if (action === 'skip') api.skip();
    else if (action === 'fast') api.setFast(!fast);
    else if (action === 'reduced') api.setReduced(!reduced);
    else if (action === 'sound') api.setSound(root.querySelector('[data-act="sound"]').getAttribute('aria-pressed') !== 'true');
  };
  const onKey = (e) => { if (!active) return; if (e.key === 'Escape') api.skip(); else if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest?.('button')) api.tap(); };
  root.addEventListener('pointerdown', onPointer);
  root.addEventListener('click', onClick, true);
  window.addEventListener('pointerup', onRelease);
  window.addEventListener('pointercancel', onRelease);
  window.addEventListener('keydown', onKey);
  return api;
}
