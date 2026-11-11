// 補給ポッド演出（作り込み版）。確定済みの結果配列を再生するだけの表示専用モジュール。
// 抽選・確率・券の消費・保存は行わない。予兆は「下限」だけを示し、結果の段階を超えない。
import { createPlayer, CHARGE, fastId } from './sfx.js';

export const TIER_NAME = ['武装片', 'N', 'R', 'SR', 'SSR', 'バディ'];
const TIER_KEY = ['shard', 'n', 'r', 'sr', 'ssr', 'buddy'];
const TIER_COL = ['#8fa3a8', '#c9d4d6', '#4db8ff', '#b28cff', '#ffc94d', '#6fffd2'];
const NEUTRAL = '#57c7d4';
const LV_COL = [NEUTRAL, NEUTRAL, TIER_COL[2], TIER_COL[3], TIER_COL[4], TIER_COL[5]]; // 予兆の段階色（1は中立）
const PRISM = ['#6fffd2', '#7fd0ff', '#d7a0ff', '#ffe08a'];
export const TAP_GAP_MS = 120;
// 動いている間のタップを次の停止点へ持ち越せる種類と、持ち越せる残り時間（カットインのあとは持ち越さない）
const QUEUE_KINDS = new Set(['pod', 'promo']), QUEUE_SEC = 0.6;
const TAU = Math.PI * 2, H = 390;
const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const E = { in2: (x) => x * x, in3: (x) => x * x * x, out3: (x) => 1 - (1 - x) ** 3, out5: (x) => 1 - (1 - x) ** 5, io3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2), back: (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2, expo: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)) };
const seg = (t, a, b, e) => { const p = c01((t - a) / (b - a || 1e-9)); return e ? e(p) : p; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
const RGB = new Map();
const rgba = (hex, a) => { let c = RGB.get(hex); if (!c) { c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(','); RGB.set(hex, c); } return `rgba(${c},${c01(a).toFixed(3)})`; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── 入力 ── */
export function tierOf(r) { return r.type === 'buddy' ? 5 : r.type === 'shard' ? 0 : { N: 1, R: 2, SR: 3, SSR: 4 }[r.rarity]; }
export function validate(arr) {
  if (!Array.isArray(arr)) throw new Error('配列ではありません');
  if (arr.length !== 1 && arr.length !== 10) throw new Error('件数は1件または10件です');
  arr.forEach((r, i) => {
    const at = `${i + 1}件目：`;
    if (!r || typeof r !== 'object') throw new Error(at + '形式が不正です');
    if (!['weapon', 'shard', 'buddy'].includes(r.type)) throw new Error(at + 'type は weapon / shard / buddy');
    if (r.type === 'weapon' && !['N', 'R', 'SR', 'SSR'].includes(r.rarity)) throw new Error(at + 'rarity は N / R / SR / SSR');
    if (r.type !== 'shard' && !(typeof r.name === 'string' && r.name.trim())) throw new Error(at + 'name が必要です');
    if (r.type === 'shard' && !(Number.isInteger(r.amount) && r.amount > 0)) throw new Error(at + 'amount は正の整数');
  });
  return Object.freeze(arr.map((r) => Object.freeze({ ...r })));
}
const nameOf = (r) => (r.type === 'shard' ? `武装片 ×${r.amount}` : r.name);
const subOf = (r) => (r.type === 'shard' ? '素材' : r.type === 'buddy' ? 'バディ' : '武器');
const starCount = (tier) => (tier === 5 ? 5 : tier);
const rarText = (tier) => (tier === 5 ? 'BUDDY' : tier === 0 ? '' : TIER_NAME[tier]);
const SHARD_SVG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d7e6ea"/><stop offset="1" stop-color="#5c7a84"/></linearGradient></defs><path d="M60 8 96 44 78 110 40 112 22 52Z" fill="url(#g)" stroke="#eaf6f8" stroke-width="2"/><path d="M60 8 58 60 96 44M58 60 78 110M58 60 40 112M58 60 22 52" fill="none" stroke="#0c1a20" stroke-opacity=".45" stroke-width="2"/><path d="M60 8 58 60 22 52Z" fill="#fff" fill-opacity=".28"/></svg>');
// 絵の決め方：結果に art（URL か素材名）があればそれを使い、なければ種類と名前から仮に選ぶ
function artOf(r, base) {
  if (r.art) return /[/.:]/.test(r.art) ? r.art : `${base}${r.art}.webp`;
  if (r.type === 'shard') return SHARD_SVG;
  if (r.type === 'buddy') return `${base}b-oriha.webp`;
  const n = r.name;
  return base + (/散弾|ショット/.test(n) ? 'w-shotgun' : /ランチャー|ロケット|グレネード/.test(n) ? 'w-rocket' : 'w-rifle') + '.webp';
}

/* ── 時間軸：結果配列 → 合図・揺れ・停止点 ──
   操作の流れ（2026-11-11 本人指定）：
   1. 「射出」の停止点でタップ → ポッドが降ってくる
   2. 10連は1個ずつ、タップで溜め→開封。溜めは全ポッド同じ長さ・同じ音で、終わるまで結果は分からない
   3. SR以上は1回目の溜めで「SR+」に昇格して止まり、以後タップ1回ごとに1段ずつ上がる（SSR+ → バディ）。
      上がり切ったあとのタップで開封。昇格は上がるだけで、見せた段階より結果が下がることはない
   停止点の種類：launch（射出）/ pod（次のポッド）/ promo（昇格のあと）/ cut（カットインのあと）/ final */
export const STOP_HOLD_MS = { launch: 250, pod: 120, promo: 220, cut: 500, final: 0 }; // 止まってから次のタップを受け付けるまで
const SETTLE_PROMO = 0.78, SETTLE_POP = 0.48; // 昇格・開封の光が収まってから止める（止まっている間は時間が進まないため）
export function build(results, reduced = false) {
  const n = results.length, multi = n > 1, tiers = results.map(tierOf), q = reduced ? 0.6 : 1;
  const m = { results, n, multi, tiers, maxT: Math.max(...tiers), reduced, pods: [], cues: [], stops: [], shakes: [], cuts: [], dur: 0 };
  const cue = (t, id, o) => m.cues.push({ t, id, vol: 1, pan: 0, rate: 1, ...o });
  const shake = (t, amp, dur = 0.35) => { if (!reduced) m.shakes.push({ t, amp, dur }); };
  const stop = (t, kind, p) => { m.stops.push({ t, kind, i: p ? p.i : -1 }); if (p) p.waits.push(t); };
  const B = 0.55 * q; m.tLaunch = B; stop(B, 'launch');
  const pod = (i, x, gy, h) => { const p = { i, r: results[i], tier: tiers[i], x, gy, h, pan: 0, beats: [], waits: [], tCall: B + i * 0.03 * q }; m.pods.push(p); return p; };
  cue(B, 'call'); cue(B, 'bed', { vol: 0.45 }); cue(B, 'slam', { vol: 0.75, buzz: 45 }); shake(B, 6, 0.3);
  // 開封（ポッドの溜めが終わった時刻 t から）
  const open = (p, t, j) => {
    if (multi && p.tier <= 2) { p.wave = true; p.hold = [t, t]; p.tOpen = t; cue(t, p.tier === 2 ? 'pop_r' : 'pop', { rate: 2 ** (PENTA[j] / 12), pan: p.pan, vol: 0.95, buzz: 15 }); shake(t, 2.5, 0.2); return t; }
    const hd = p.tier >= 4 ? 0.6 * q : 0; p.hold = [t, t + hd]; if (hd) cue(t, 'hold'); t += hd;
    p.tOpen = t; cue(t, 'open' + p.tier, { pan: p.pan * 0.6, buzz: p.tier >= 4 ? [60, 40, 120] : p.tier === 3 ? 60 : 20 });
    shake(t, [2, 2, 3, 7, 15, 15][p.tier], p.tier >= 4 ? 0.6 : 0.3);
    return t;
  };
  // タップ1回分の溜め。1回目は全ポッド同じ（k0）。N・R・武装片はそのまま開き、SR以上はSR+へ上がって止まる
  const steps = (p, t, k0, j) => {
    const d0 = CHARGE[k0] * q; cue(t, 'charge' + k0, { pan: p.pan });
    if (p.tier <= 2) { p.last = [t, t + d0, k0]; return open(p, t + d0, j); }
    let lv = 3, k = k0; p.beats.push({ t0: t, t1: t + d0, to: 3, from: 1, k }); t += d0;
    cue(t, 'promote3', { pan: p.pan, buzz: 30 }); shake(t, 3 + 3 * 1.6, 0.3);
    if (multi) p.focus = [t, t + 0.3 * q];
    for (lv = 4; lv <= p.tier; lv++) {
      t += SETTLE_PROMO; stop(t, 'promo', p); k = Math.min(k + 1, 4);
      const d = CHARGE[k] * q; p.beats.push({ t0: t, t1: t + d, to: lv, from: lv - 1, k }); cue(t, 'charge' + k, { pan: p.pan }); t += d;
      cue(t, 'promote' + lv, { pan: p.pan, buzz: 30 }); shake(t, 3 + lv * 1.6, 0.3);
    }
    t += SETTLE_PROMO; stop(t, 'promo', p); k = Math.min(k + 1, 4);
    p.last = [t, t + CHARGE[k] * q, k]; cue(t, 'charge' + k, { pan: p.pan });
    return open(p, p.last[1], j);
  };
  const cut = (p, t) => {
    const ns = starCount(p.tier), c0 = t + 0.32 * q;
    const c = { p, c0, tSlam: c0 + 0.45 * q, tStars: c0 + 0.8 * q, ns, tNew: c0 + (0.8 + ns * 0.09 + 0.08) * q, tDone: c0 + (0.8 + ns * 0.09 + 0.4) * q };
    c.tOut = c.tDone + 0.3 * q; c.step = 0.09 * q;
    cue(c0, 'whoosh'); cue(c.tSlam, 'slam', { buzz: 40 }); shake(c.tSlam, 8, 0.3);
    for (let s = 0; s < ns; s++) cue(c.tStars + s * 0.09 * q, 'star', { rate: 2 ** ([0, 2, 4, 7, 9][s] / 12), pan: -0.3 + s * 0.15, vol: 0.85 });
    if (p.r.new) cue(c.tNew, 'new');
    m.cuts.push(c); stop(c.tDone, 'cut'); p.cut = c;
    return c.tOut;
  };
  if (!multi) {
    const p = pod(0, 0, 310, 168); p.tFall = B + 0.4 * q; p.tLand = p.tFall + 0.55 * q;
    cue(p.tFall, 'fall'); cue(p.tLand, 'land', { buzz: 50 }); shake(p.tLand, 9, 0.4);
    let t = steps(p, p.tLand + 0.34 * q, 0, 0); // 射出のタップで1回目の溜めまで進む
    if (p.tier >= 4) { t = cut(p, t); p.tCard = t - 0.12 * q; cue(p.tCard + 0.1, 'done'); m.tEnd = p.tCard + 0.6 * q; }
    else { p.tCard = t + 0.1 * q; for (let s = 0; s < p.tier; s++) cue(p.tCard + (0.42 + s * 0.09) * q, 'star', { rate: 2 ** ([0, 2, 4][s] / 12), vol: 0.7 }); if (p.r.new) cue(p.tCard + 0.75 * q, 'new'); m.tEnd = p.tCard + (p.tier === 3 ? 1.0 : 0.75) * q; }
  } else {
    results.forEach((r, i) => {
      const c = i % 5, p = pod(i, (c - 2) * 124, i < 5 ? 192 : 340, 98); p.pan = (c - 2) * 0.3;
      p.tFall = B + (0.35 + i * 0.07) * q; p.tLand = p.tFall + 0.4 * q;
      cue(p.tFall, 'fall', { rate: 1.375, vol: 0.3, pan: p.pan }); cue(p.tLand, 'land_s', { pan: p.pan, rate: 2 ** (i / 30), buzz: 15 }); shake(p.tLand, 3.5, 0.2);
    });
    let t = m.pods[9].tLand + 0.75; m.mass = [m.pods[9].tLand, t];
    m.pods.forEach((p, j) => {
      p.tStop = t; stop(t, 'pod', p);
      t = steps(p, t, 2, j); // 10連の1回目の溜めは短め（10回押すため）
      if (p.tier <= 2) t += SETTLE_POP;
      else { if (p.tier >= 4) t = cut(p, t); else { p.cap = [t + 0.12 * q, t + 0.9 * q]; t += 0.95 * q; } p.focus.push(t, t + 0.25 * q); t += 0.25 * q + 0.15; }
    });
    m.tList = t + 0.1 * q;
    for (let i = 0; i < 10; i++) cue(m.tList + (0.1 + i * 0.06) * q, 'tile', { rate: 2 ** (PENTA[i] / 12), pan: ((i % 5) - 2) * 0.3 });
    cue(m.tList + 0.85 * q, 'done'); m.tEnd = m.tList + 1.0 * q;
  }
  stop(m.tEnd, 'final'); m.dur = m.tEnd;
  m.cues.sort((a, b) => a.t - b.t);
  return m;
}
// 10連の開封音と一覧の音につける音階。幅を1オクターブ半に抑え、高い側が甲高くならないようにする
const PENTA = [-7, -5, -3, 0, 2, 4, 7, 9, 12, 14];
const levelAt = (p, t) => { let lv = 1, since = -9, from = 1; for (const b of p.beats) if (t >= b.t1) { lv = b.to; since = b.t1; from = b.from; } return { lv, since, from }; };
const chargeAt = (m, p, t) => {
  for (const b of p.beats) if (t >= b.t0 && t < b.t1) return [(t - b.t0) / (b.t1 - b.t0), b.k];
  if (p.last && t >= p.last[0] && t < p.last[1]) return [(t - p.last[0]) / (p.last[1] - p.last[0]), p.last[2]];
  return [0, 0];
};
// 止まって待っているポッドか（t がそのポッドの停止点と一致）
const waitingAt = (p, t) => p.waits.some((w) => Math.abs(w - t) < 1e-6);
// 予兆の検査：表示する段階が結果を超えないこと、開封前に表を出さないこと
export function audit(results) {
  const errs = [];
  for (const red of [false, true]) { const m = build(validate(results), red);
    for (let t = 0; t <= m.dur; t += 1 / 60) for (const p of m.pods) { const { lv } = levelAt(p, t); if (lv > Math.max(1, p.tier)) errs.push(`t=${t.toFixed(2)} ${p.i}の予兆が結果を超える`); }
    for (const p of m.pods) if (p.cut && p.tier < 4) errs.push(`${p.i} SSR未満にカットイン`);
    if (m.stops.at(-1).kind !== 'final') errs.push('最後の停止点がない');
    if (m.stops[0].kind !== 'launch') errs.push('射出の停止点がない');
    m.stops.forEach((s, i) => { if (i && s.t <= m.stops[i - 1].t + 0.05) errs.push(`停止点${i}が前と近すぎる`); });
    // 昇格の停止点は、SR以上のポッドで「上がる段階の数」だけある（1タップで1段）
    for (const p of m.pods) { const np = m.stops.filter((s) => s.kind === 'promo' && s.i === p.i).length; if (np !== (p.tier >= 3 ? p.tier - 2 : 0)) errs.push(`${p.i}の昇格の停止点が${np}回`); }
    if (m.multi && m.stops.filter((s) => s.kind === 'pod').length !== 10) errs.push('ポッドごとの停止点が10回ではない'); }
  return errs;
}

/* ── 描画（Canvas） ── */
const LAMPS_BODY = [[39.2, 35.2, 4.5, 0.9], [14.0, 40.4, 0.7, 9.6], [69.7, 41.0, 0.8, 9.6], [39.3, 75.8, 4.5, 0.9]];
const LAMPS_LID = [[36.0, 15.1, 11.6, 1.1], [84.3, 11.8, 4.1, 3.1]];
const SEAM = 0.293, POD_ASPECT = 1157 / 1078;
function createRenderer(cv, imgs) {
  const ctx = cv.getContext('2d'); let S = 1, VW = 844, bg = null; const PAD = 60;
  const sprites = new Map();
  const sprite = (col) => { let s = sprites.get(col); if (!s) { s = document.createElement('canvas'); s.width = s.height = 64; const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, rgba(col, 0.95)); gr.addColorStop(0.5, rgba(col, 0.32)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); sprites.set(col, s); } return s; };
  const dot = (col, x, y, r, a) => { if (a <= 0.004 || r <= 0) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(sprite(col), x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1; };
  // 昇格するとポッド自体が段階色に染まる（陰影は残し、色だけ乗せた画像を作って使い回す）
  const tints = new Map(), TINT_A = [0, 0, 0.4, 0.46, 0.82, 0.7];
  const tinted = (img, col) => { const key = img.src + col; let c = tints.get(key); if (!c) { c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'color'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'soft-light'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0); tints.set(key, c); } return c; };
  const add = () => { ctx.globalCompositeOperation = 'lighter'; };
  const over = () => { ctx.globalCompositeOperation = 'source-over'; };
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return false;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); S = cv.height / H; VW = cv.width / S;
    // 背景は1回だけ描いて使い回す（投下場：夜空・遠景・遠近の床・霧）
    bg = document.createElement('canvas'); bg.width = Math.round((VW + 2 * PAD) * S); bg.height = Math.round((H + 2 * PAD) * S);
    const g = bg.getContext('2d'); g.setTransform(S, 0, 0, S, PAD * S, PAD * S);
    const X0 = -PAD, X1 = VW + PAD, HZ = 118, cx = VW / 2;
    let gr = g.createLinearGradient(0, -PAD, 0, HZ); gr.addColorStop(0, '#02060a'); gr.addColorStop(1, '#0a2029'); g.fillStyle = gr; g.fillRect(X0, -PAD, X1 - X0, HZ + PAD);
    for (let i = 0; i < 110; i++) { const a = 0.15 + 0.6 * hash(i, 1) ** 3; g.fillStyle = `rgba(200,230,240,${a.toFixed(2)})`; g.fillRect(X0 + hash(i, 2) * (X1 - X0), -PAD + hash(i, 3) * (HZ + PAD - 14), 0.9, 0.9); }
    for (let i = 0; i < 26; i++) { const w2 = 14 + 50 * hash(i, 5), hh = 6 + 26 * hash(i, 6) ** 2, x = X0 + hash(i, 4) * (X1 - X0); g.fillStyle = '#050d12'; g.fillRect(x, HZ - hh, w2, hh + 1); if (hash(i, 7) > 0.55) { g.fillStyle = hash(i, 8) > 0.5 ? 'rgba(255,90,70,.8)' : 'rgba(87,199,212,.8)'; g.fillRect(x + w2 * 0.5, HZ - hh - 1.5, 1.4, 1.4); } }
    gr = g.createLinearGradient(0, HZ, 0, H + PAD); gr.addColorStop(0, '#0d2731'); gr.addColorStop(0.35, '#081820'); gr.addColorStop(1, '#03080c'); g.fillStyle = gr; g.fillRect(X0, HZ, X1 - X0, H + PAD - HZ);
    g.lineWidth = 0.7;
    for (let i = -22; i <= 22; i++) { g.strokeStyle = `rgba(87,199,212,${(0.13 - Math.abs(i) * 0.004).toFixed(3)})`; g.beginPath(); g.moveTo(cx + i * 10, HZ); g.lineTo(cx + i * 150, H + PAD); g.stroke(); }
    for (let i = 1; i <= 16; i++) { const y = HZ + (H + PAD - HZ) * (i / 16) ** 2.1; g.strokeStyle = `rgba(87,199,212,${(0.05 + 0.1 * (i / 16)).toFixed(3)})`; g.beginPath(); g.moveTo(X0, y); g.lineTo(X1, y); g.stroke(); }
    gr = g.createLinearGradient(0, HZ - 26, 0, HZ + 46); gr.addColorStop(0, 'rgba(87,199,212,0)'); gr.addColorStop(0.36, 'rgba(110,200,214,.2)'); gr.addColorStop(1, 'rgba(87,199,212,0)'); g.fillStyle = gr; g.fillRect(X0, HZ - 26, X1 - X0, 72);
    gr = g.createRadialGradient(cx, H * 0.52, H * 0.3, cx, H * 0.52, VW * 0.72); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.72)'); g.fillStyle = gr; g.fillRect(X0, -PAD, X1 - X0, H + 2 * PAD);
    return true;
  }
  // 後光：細い光の筋を2層、逆向きに回して重ねる（重なりが揺らいで見える）
  const rays = (x, y, R, col, a, rot, n = 14, wid = 0.1, seed = 0) => { if (a <= 0.004) return;
    for (let L = 0; L < 2; L++) { const RR = R * (L ? 0.78 : 1), g = ctx.createRadialGradient(x, y, 0, x, y, RR), aa = a * (L ? 0.55 : 0.6); g.addColorStop(0, rgba(col, aa)); g.addColorStop(0.4, rgba(col, aa * 0.42)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath();
      const nn = Math.round(n * 1.5), r0 = L ? -rot * 0.8 + 1 : rot;
      for (let i = 0; i < nn; i++) { const an = r0 + i * TAU / nn + (hash(i, seed + 11 + L * 7) - 0.5) * 0.3, w = wid * 0.5 * (0.35 + hash(i, seed + 3 + L * 5)), len = RR * (0.6 + 0.4 * hash(i, seed + 17 + L)); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an - w) * len, y + Math.sin(an - w) * len); ctx.lineTo(x + Math.cos(an + w) * len, y + Math.sin(an + w) * len); ctx.closePath(); } ctx.fill(); } };
  const pillar = (x, yb, w, col, a) => { if (a <= 0.004 || w <= 0.1) return; const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.3, rgba(col, a * 0.45)); g.addColorStop(0.5, rgba('#ffffff', a)); g.addColorStop(0.7, rgba(col, a * 0.45)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - w, -PAD - 300, 2 * w, yb + PAD + 300);
    dot(col, x, yb, w * 1.6, a * 0.8); ctx.save(); ctx.translate(x, yb); ctx.scale(4, 0.3); dot(col, 0, 0, w * 1.1, a * 0.7); ctx.restore(); };
  const ring = (x, y, r, col, a, lw, sy = 1) => { if (a <= 0.004 || r <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(1, sy); ctx.strokeStyle = rgba(col, a); ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.restore(); };
  // 粒子：発生からの経過時間だけで位置が決まる（録画でも同じ絵になる）
  const burst = (seed, n, age, o) => { for (let i = 0; i < n; i++) { const life = lerp(o.life[0], o.life[1], hash(seed + 3.1, i)); if (age >= life) continue; const u = age / life, an = o.ang[0] + (hash(seed, i) - 0.5) * o.ang[1], sp = lerp(o.sp[0], o.sp[1], hash(seed + 1.7, i) ** (o.pw || 1)), d = (1 - Math.exp(-o.drag * age)) / o.drag;
    dot(o.alt && i % 3 === 0 ? o.alt : o.col, o.x + Math.cos(an) * sp * d, o.y + Math.sin(an) * sp * d + 0.5 * o.g * age * age, o.size * (0.5 + hash(seed + 5.3, i)) * (1 - 0.5 * u), (1 - u) ** 1.4 * (0.65 + 0.35 * Math.sin(age * 34 + i))); } };
  const speedLines = (x, y, R, col, a, fr) => { if (a <= 0.004) return; ctx.fillStyle = rgba(col, a); ctx.beginPath(); for (let i = 0; i < 44; i++) { const an = hash(i, fr) * TAU, r0 = R * (0.3 + 0.4 * hash(i + 9, fr)), w = 0.004 + 0.014 * hash(i + 5, fr); ctx.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0); ctx.lineTo(x + Math.cos(an - w) * R * 1.3, y + Math.sin(an - w) * R * 1.3); ctx.lineTo(x + Math.cos(an + w) * R * 1.3, y + Math.sin(an + w) * R * 1.3); ctx.closePath(); } ctx.fill(); };

  function camera(m, t) {
    let x = VW / 2, y = H / 2, z = 1;
    if (!m.multi && !m.reduced) { // 1連：昇格するたびに一段ずつ寄る
      const p = m.pods[0], { lv, since, from } = levelAt(p, t); let zl = lv <= 1 ? 0 : lerp(from - 1, lv - 1, seg(t, since, since + 0.3, E.out3));
      zl *= 1 - seg(t, p.tOpen + 0.05, p.tOpen + 0.5, E.io3); z *= 1 + 0.085 * zl; y = lerp(y, p.gy - p.h * 0.5, c01(0.28 * zl));
    }
    for (const p of m.pods) {
      if (p.focus) { const [a, b, c, d] = p.focus; if (t >= a && t <= d) { const k = t < b ? seg(t, a, b, E.io3) : 1 - seg(t, c, d, E.io3); x = lerp(x, VW / 2 + p.x, k); y = lerp(y, p.gy - p.h * 0.72, k); z = lerp(1, 1.72, k); } }
      if (m.reduced) continue;
      for (const b of p.beats) if (t >= b.t1) z *= 1 + 0.035 * Math.exp(-(t - b.t1) * 10);
      if (p.hold && t >= p.hold[0] && t < p.hold[1]) z *= 1 + 0.07 * seg(t, p.hold[0], p.hold[1], E.in2);
      if (!p.wave && p.tOpen != null && t >= p.tOpen && p.tier >= 3) z *= 1 + (p.tier >= 4 ? 0.15 : 0.06) * Math.exp(-(t - p.tOpen) * 6);
    }
    return { x, y, z };
  }
  const shakeAt = (m, t) => { let x = 0, y = 0; for (const s of m.shakes) { const a = t - s.t; if (a >= 0 && a < s.dur) { const k = s.amp * (1 - a / s.dur) ** 2; x += k * Math.sin(a * 97 + s.t * 13); y += k * Math.cos(a * 83 + s.t * 7); } } return { x, y }; };

  function podBack(m, p, t, A) { // 開封後の後光（ポッドの背面）
    if (p.tOpen == null || t < p.tOpen || p.tier < 3 || p.wave) return;
    const oa = t - p.tOpen, x = VW / 2 + p.x, y = p.gy - p.h * 0.62, k = p.h / 168, col = TIER_COL[p.tier];
    let a = [0, 0, 0, 0.3, 0.55, 0.55][p.tier] * seg(oa, 0, 0.15); if (m.multi) a *= 1 - seg(t, p.focus[2], p.focus[3]);
    add();
    if (p.tier === 5) PRISM.forEach((c, j) => rays(x, y, 560 * k + 200, c, a * 0.8, A * 0.22 + j * 0.37, 5, 0.09, j)); else rays(x, y, 560 * k + 200, col, a, A * 0.22, 14, 0.1);
    dot(col, x, y, (240 + 140 * Math.sin(A * 2.3)) * k * 0.9 + 120, a * 0.9); over();
  }
  function podDraw(m, p, t) {
    const x = VW / 2 + p.x, gy = p.gy, h = p.h, w = h * POD_ASPECT, k = h / 168, img = k > 0.7 ? imgs.pod : imgs.podS;
    const ra = seg(t, p.tCall, p.tCall + 0.2) * (1 - seg(t, p.tLand, p.tLand + 0.3));
    if (ra > 0) { // 投下位置の標識
      add(); ctx.save(); ctx.translate(x, gy - 3 * k); ctx.scale(1, 0.3); ctx.strokeStyle = rgba(NEUTRAL, 0.75 * ra); ctx.lineWidth = 1.6 * k + 0.4;
      const rr = w * (0.62 + 0.7 * (1 - seg(t, p.tCall, p.tLand, E.out3))); ctx.setLineDash([12 * k, 9 * k]); ctx.lineDashOffset = -t * 70; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(0, 0, rr * 0.55, 0, TAU); ctx.stroke(); ctx.restore();
      ctx.fillStyle = rgba(NEUTRAL, 0.3 * ra); ctx.fillRect(x - 0.7 * k, -PAD, 1.4 * k, gy + PAD); over();
    }
    if (t < p.tFall) return;
    const fu = seg(t, p.tFall, p.tLand), landed = t >= p.tLand, la = t - p.tLand, oy = landed ? 0 : -(1 - fu * fu) * (gy + h + 90);
    const opened = p.tOpen != null && t >= p.tOpen, oa = t - p.tOpen, { lv, since } = levelAt(p, t), col = LV_COL[lv];
    const [ch] = opened ? [0] : chargeAt(m, p, t), hold = !opened && p.hold && t >= p.hold[0] && t < p.hold[1] ? seg(t, p.hold[0], p.hold[1]) : 0;
    const pk = since > 0 && !opened ? Math.exp(-(t - since) * 9) : 0, mo = m.reduced ? 0 : 1;
    let sx = 1, sy = 1; if (!landed) { sy = 1.12; sx = 0.94; } else if (mo) { const sq = Math.exp(-la * 10) * Math.cos(la * 24); sy = 1 - 0.2 * sq; sx = 1 + 0.14 * sq; }
    const sc = 1 + mo * (0.035 * ch + 0.1 * pk - 0.03 * hold), jx = mo * (ch * 2.4 + hold * 1.8) * k * Math.sin(t * 113 + p.i), jy = mo * (ch * 1.2 + hold) * k * Math.cos(t * 127 + p.i * 2);
    const ba = opened ? 1 - seg(oa, p.wave ? 0.1 : 0.3, p.wave ? 0.45 : 0.8) : 1;
    if (!landed) { // 落下の尾（色は中立のまま。結果を漏らさない）
      add(); const ty = gy + oy - h, L = 320 * k * (0.5 + fu), g = ctx.createLinearGradient(0, ty - L, 0, ty + h * 0.5); g.addColorStop(0, rgba(NEUTRAL, 0)); g.addColorStop(0.75, rgba(NEUTRAL, 0.42)); g.addColorStop(1, rgba('#ffffff', 0.75)); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - w * 0.4, ty + h * 0.5); ctx.lineTo(x, ty - L); ctx.lineTo(x + w * 0.4, ty + h * 0.5); ctx.fill();
      dot('#ffd9a0', x, gy + oy - 4 * k, w * 0.62, 0.8); for (let i = 0; i < 7; i++) dot('#ffd9a0', x + (hash(i, p.i) - 0.5) * w * 0.6, ty - ((hash(i, p.i + 9) + t * 5) % 1) * L * 0.8, 3.2 * k, 0.8); over();
    }
    // 接地の影と足元の光
    const sa = landed ? 0.5 * ba : 0.5 * fu * fu;
    ctx.save(); ctx.translate(x, gy - 2 * k); ctx.scale(1, 0.22); ctx.fillStyle = `rgba(0,0,0,${sa.toFixed(3)})`; ctx.beginPath(); ctx.arc(0, 0, w * (0.62 - 0.2 * (1 - fu)), 0, TAU); ctx.fill(); ctx.restore();
    const glowAmt = landed ? (0.22 + 0.78 * ch + 0.7 * pk + 0.5 * hold) * (lv > 1 ? 1 : 0.55) * ba : 0;
    if (glowAmt > 0) { add(); dot(col, x, gy - h * 0.5, w * (0.95 + 0.5 * ch + 0.7 * pk), 0.55 * glowAmt); ctx.save(); ctx.translate(x, gy); ctx.scale(1, 0.26); dot(col, 0, 0, w * (1.1 + 0.6 * ch + 0.8 * pk), 0.6 * glowAmt); ctx.restore(); over(); }
    // 本体と蓋
    ctx.save(); ctx.translate(x + jx, gy + oy + jy); ctx.scale(sx * sc, sy * sc);
    const iw = img.naturalWidth, ih = img.naturalHeight, tk = seg(t, since, since + 0.18), prev = lv >= 2 ? levelAt(p, t).from : 1;
    const layers = [[img, 1]]; if (prev >= 2 && tk < 1) layers.push([tinted(img, LV_COL[prev]), TINT_A[prev] * (1 - tk)]); if (lv >= 2) layers.push([tinted(img, col), TINT_A[lv] * tk]);
    const part = (s0, s1, alpha) => { for (const [im, a] of layers) { if (a * alpha <= 0.004) continue; ctx.globalAlpha = a * alpha; ctx.drawImage(im, 0, ih * s0, iw, ih * (s1 - s0), -w / 2, -h * (1 - s0), w, h * (s1 - s0)); } ctx.globalAlpha = 1; };
    if (ba > 0) part(SEAM, 1, ba);
    const lidA = opened ? 1 - (p.wave ? seg(oa, 0.08, 0.38) : seg(oa, 0.2, 0.55)) : 1;
    if (lidA > 0) { ctx.save(); if (opened) { const dir = p.i % 2 ? 1 : -1, lift = p.wave ? 0.55 : 1; ctx.translate(dir * oa * 150 * k * lift, -(900 * oa - 900 * oa * oa) * k * lift); ctx.translate(0, -h * (1 - SEAM / 2)); ctx.rotate(dir * oa * 5.5); ctx.translate(0, h * (1 - SEAM / 2)); }
      part(0, SEAM, lidA); ctx.restore(); }
    if (landed && ba > 0) { // 灯と継ぎ目の漏れ光（段階色）
      add(); const fl = (0.55 + 0.45 * ch + 0.5 * pk) * ba * (0.85 + 0.15 * Math.sin(t * (20 + 60 * ch) + p.i));
      const lamp = ([l, tp, ww, hh]) => { const lx = -w / 2 + l / 100 * w, ly = -h + tp / 100 * h, lw = ww / 100 * w, lh = hh / 100 * h, pd = 3.5 * k * (1 + ch + pk); ctx.globalAlpha = Math.min(1, fl); ctx.drawImage(sprite(col), lx - pd, ly - pd, lw + 2 * pd, lh + 2 * pd); };
      LAMPS_BODY.forEach(lamp); if (!opened) LAMPS_LID.forEach(lamp); ctx.globalAlpha = 1;
      const leak = Math.max(ch, pk, hold, opened ? 1 : 0) * ba, ys = -h * (1 - SEAM), lh = 7 * k * (1 + 2.4 * leak);
      if (leak > 0.01) { ctx.globalAlpha = Math.min(1, 0.25 + 0.75 * leak); ctx.drawImage(sprite(hold > 0.5 ? '#ffffff' : col), -w * (0.3 + 0.2 * leak), ys - lh, w * (0.6 + 0.4 * leak), lh * 2); ctx.globalAlpha = 1; }
      over();
    }
    ctx.restore();
  }
  function podFx(m, p, t, A) {
    if (t < p.tLand) return;
    const x = VW / 2 + p.x, gy = p.gy, h = p.h, w = h * POD_ASPECT, k = h / 168, cy = gy - h * 0.5, la = t - p.tLand, mo = m.reduced ? 0.35 : 1;
    const opened = p.tOpen != null && t >= p.tOpen, { lv } = levelAt(p, t), col = LV_COL[lv];
    add();
    if (la < 0.8) { // 着地
      ring(x, gy, w * (0.5 + 1.7 * E.out3(la / 0.5)), '#cfe9ee', 0.7 * (1 - la / 0.5), 5 * k * (1 - la / 0.5) + 0.6, 0.28);
      burst(p.i * 7 + 1, Math.round((m.multi ? 8 : 20) * mo), la, { x, y: gy - 4 * k, col: '#ffd9a0', sp: [120 * k, 460 * k], ang: [-Math.PI / 2, 2.7], g: 900 * k, life: [0.25, 0.6], size: 5 * k, drag: 2.5 });
      over(); for (let i = 0; i < 6; i++) dot('#7b8c94', x + (hash(i, p.i + 20) - 0.5) * w * 2.2 * E.out3(la / 0.8), gy - 6 * k - la * 22 * k * hash(i, 31), w * (0.22 + 0.5 * la), 0.2 * (1 - la / 0.8)); add();
    }
    const [ch, ck] = opened ? [0, 0] : chargeAt(m, p, t);
    if (ch > 0 && ch < 1 || (ch === 1 && ck === 9)) { // 溜め：光の粒が吸い込まれ、輪が締まる
      const n = Math.round((ck === 9 ? 7 : 20) * mo), sd = ck * 17 + p.i * 3, c1 = ck === 9 ? (t * 1.6) % 1 : ch;
      for (let i = 0; i < n; i++) { const u = c01(c1 * 1.5 - hash(i, sd) * 0.5); if (u <= 0 || u >= 1) continue; const an = hash(i + 3, sd) * TAU, R = w * (1.7 - 1.45 * u * u); dot(col, x + Math.cos(an) * R, cy + Math.sin(an) * R * 0.78, (2.5 + 3.5 * hash(i + 7, sd)) * k * (1.3 - u), 0.95 * u); dot(col, x + Math.cos(an) * R * 1.07, cy + Math.sin(an) * R * 0.78 * 1.07, 2.4 * k, 0.4 * u); }
      if (ck !== 9) { ctx.strokeStyle = rgba(col, 0.55 * ch); ctx.lineWidth = 2 * k; const rr = w * (1.3 - 0.55 * ch); for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.ellipse(x, cy, rr, rr * 0.8, 0, t * 7 + j * Math.PI, t * 7 + j * Math.PI + 1.9); ctx.stroke(); } }
    }
    const promo = (ts, to, big) => { const a = t - ts; if (a < 0 || a > 0.8) return; const nc = LV_COL[to];
      ring(x, cy, w * (0.5 + 2.3 * big * E.out3(a / 0.45)), nc, 1 - a / 0.45, 6 * k * (1 - a / 0.45) + 1, 0.8);
      dot(nc, x, cy, w * (1.7 + 1.6 * a) * big, 0.85 * Math.exp(-a * 7));
      if (big >= 1 && mo === 1 && a < 0.55) { // 昇格の瞬間、段階の文字が大きく抜ける（「+」は「それ以上」の意味）
        const s = 0.7 + 1.5 * E.out3(a / 0.55); ctx.save(); ctx.translate(x, cy); ctx.scale(s, s); ctx.font = `italic 700 ${Math.round(118 * k)}px "GX Rajdhani", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = rgba(nc, 0.6 * (1 - a / 0.55)); ctx.fillText(to === 5 ? 'BUDDY' : TIER_NAME[to] + '+', 0, 0); ctx.restore(); }
      burst(to * 31 + p.i, Math.round((18 + 10 * (to - 1)) * big * mo), a, { x, y: cy, col: nc, alt: '#ffffff', sp: [140 * k, 600 * k], ang: [0, TAU], g: 320 * k, life: [0.3, 0.75], size: 5.5 * k, drag: 3 });
      pillar(x, gy - h * 0.7, 9 * k * (1 + to * 0.45) * Math.exp(-a * 8) * big, nc, Math.exp(-a * 7)); };
    for (const b of p.beats) promo(b.t1, b.to, 1);
    // 次に開けるポッドの目印（止まって待っている間は A で動かす）
    if (p.tStop != null) { const ca = seg(t, p.tStop - 0.25, p.tStop) * (1 - seg(t, p.tStop, p.tStop + 0.15)); if (ca > 0) {
      const pu = 0.5 + 0.5 * Math.sin(A * 5); ctx.save(); ctx.translate(x, gy - 2 * k); ctx.scale(1, 0.3); ctx.strokeStyle = rgba('#e6fbff', 0.85 * ca); ctx.lineWidth = 2.4 * k + 0.6;
      ctx.setLineDash([16 * k, 10 * k]); ctx.lineDashOffset = -A * 60; ctx.beginPath(); ctx.arc(0, 0, w * (0.78 + 0.06 * pu), 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      dot(NEUTRAL, x, cy, w * (1.15 + 0.15 * pu), 0.38 * ca); const ay = gy - h - 16 * k - 7 * k * pu; ctx.fillStyle = rgba('#e6fbff', 0.95 * ca);
      ctx.beginPath(); ctx.moveTo(x - 11 * k, ay - 11 * k); ctx.lineTo(x + 11 * k, ay - 11 * k); ctx.lineTo(x, ay + 2 * k); ctx.closePath(); ctx.fill(); } }
    // 昇格して止まっている間：段階色でゆっくり脈打つ（次のタップを待っている合図）
    if (!opened && lv >= 3 && waitingAt(p, t)) { const pu = 0.5 + 0.5 * Math.sin(A * 4.2); dot(col, x, cy, w * (1.3 + 0.25 * pu), 0.22 + 0.2 * pu); ring(x, cy, w * (0.95 + 0.5 * ((A * 0.9) % 1)), col, 0.5 * (1 - ((A * 0.9) % 1)), 2.5 * k, 0.8); }
    if (p.hold && t >= p.hold[0] && t < p.hold[1]) { // 開封直前の溜め：周囲の光を吸い込む
      const hu = seg(t, p.hold[0], p.hold[1]); ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineWidth = 1.2 * k;
      for (let i = 0; i < Math.round(30 * mo); i++) { const an = hash(i, p.i + 50) * TAU, u = (hu * 2.2 + hash(i + 2, 9)) % 1, r0 = w * 0.5 + (1 - u) ** 1.5 * 420 * k; ctx.globalAlpha = u * 0.8; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 0.85); ctx.lineTo(x + Math.cos(an) * (r0 + 46 * k), cy + Math.sin(an) * (r0 + 46 * k) * 0.85); ctx.stroke(); }
      ctx.globalAlpha = 1; const beat = Math.exp(-(((hu - 0.07) / 0.06) ** 2)) + 0.8 * Math.exp(-(((hu - 0.33) / 0.06) ** 2)); dot(col, x, cy, w * 1.5, 0.6 * beat); dot('#ffffff', x, cy, w * (0.3 + 0.5 * hu), 0.5 * hu * hu);
    }
    if (opened) { // 開封
      const oa = t - p.tOpen, T = p.tier, tc = TIER_COL[T], yb = gy - h * (1 - SEAM), wv = p.wave ? 0.7 : 1;
      const pw = [16, 18, 26, 46, 70, 74][T] * k * (oa < 0.07 ? (oa / 0.07) * 1.7 : 0.75 + 0.95 * Math.exp(-(oa - 0.07) * 5.5));
      const pa = T <= 2 ? Math.exp(-oa * 5) : T === 3 ? Math.exp(-oa * 2.6) : (0.4 + 0.6 * Math.exp(-oa * 3)) * (1 - seg(oa, 0.5, 0.95));
      pillar(x, yb, pw, tc, pa);
      if (oa < 0.6) ring(x, gy, w * (0.6 + [1, 1, 1.4, 2.1, 3.6, 3.6][T] * E.out3(oa / 0.6)), tc, 1 - oa / 0.6, (4 + T) * k * (1 - oa / 0.6) + 0.6, 0.28);
      if (T >= 4 && oa < 0.7) ring(x, cy, w * (0.4 + 5.5 * E.out3(oa / 0.7)), '#ffffff', 0.8 * (1 - oa / 0.7), 7 * k * (1 - oa / 0.7) + 0.6, 1);
      burst(100 + p.i, Math.round([8, 10, 16, 36, 96, 110][T] * wv * mo), oa, { x, y: yb, col: tc, alt: '#ffffff', sp: [200 * k, [420, 460, 580, 780, 1150, 1150][T] * k], ang: [-Math.PI / 2, [0.9, 0.9, 1.1, 1.5, 2.1, 2.3][T]], g: 1100 * k, life: p.wave ? [0.25, 0.5] : [0.4, [0.7, 0.7, 0.9, 1.3, 1.9, 1.9][T]], size: [4, 4, 5, 6.5, 7.5, 7.5][T] * k, drag: 1.6 });
      if (T >= 4) burst(300 + p.i, Math.round(46 * mo), oa, { x, y: cy, col: T === 5 ? PRISM[2] : '#fff1c2', alt: T === 5 ? PRISM[1] : '#ffffff', sp: [300 * k, 1500 * k], ang: [0, TAU], g: 200 * k, life: [0.35, 1.0], size: 6 * k, drag: 2.6, pw: 0.6 });
      dot('#ffffff', x, yb, w * (0.7 + T * 0.15) * (1 + oa * 2), [0.5, 0.5, 0.7, 0.75, 0.62, 0.62][T] * Math.exp(-oa * 8));
    }
    over();
  }

  function draw(m, t, A) {
    const cam = camera(m, t), sh = shakeAt(m, t), red = m.reduced;
    ctx.setTransform(1, 0, 0, 1, 0, 0); over(); ctx.globalAlpha = 1; ctx.fillStyle = '#02060a'; ctx.fillRect(0, 0, cv.width, cv.height);
    const world = () => ctx.setTransform(S * cam.z, 0, 0, S * cam.z, S * (VW / 2 - cam.x * cam.z + sh.x), S * (H / 2 - cam.y * cam.z + sh.y));
    const screen = () => ctx.setTransform(S, 0, 0, S, S * sh.x, S * sh.y);
    world(); ctx.drawImage(bg, -PAD, -PAD, VW + 2 * PAD, H + 2 * PAD);
    const B = m.tLaunch; if (t < B + 0.7) { // 射出の合図：投下地点の標的。タップすると衝撃の輪が広がる
      const a = seg(t, 0, B * 0.8) * (1 - seg(t, B + 0.05, B + 0.45)), cx = VW / 2, gy0 = m.multi ? 268 : 306, pu = 0.5 + 0.5 * Math.sin(A * 4.5); add();
      for (let i = 0; i < 3; i++) { const u = (A * 0.55 + i / 3) % 1; ring(cx, gy0, 70 + 230 * u, NEUTRAL, a * 0.55 * (1 - u), 2, 0.3); }
      ctx.save(); ctx.translate(cx, gy0); ctx.scale(1, 0.3); ctx.strokeStyle = rgba('#e6fbff', 0.8 * a); ctx.lineWidth = 2.2; ctx.setLineDash([22, 12]); ctx.lineDashOffset = -A * 50; ctx.beginPath(); ctx.arc(0, 0, 120 + 8 * pu, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      dot(NEUTRAL, cx, gy0, 150 + 30 * pu, 0.35 * a); ctx.fillStyle = rgba(NEUTRAL, 0.35 * a); ctx.fillRect(cx - 1, -PAD, 2, gy0 + PAD);
      const la = t - B; if (la >= 0 && la < 0.7) { ring(cx, gy0, 80 + 620 * E.out3(la / 0.7), '#ffffff', 0.9 * (1 - la / 0.7), 8 * (1 - la / 0.7) + 1, 0.3); dot('#e6fbff', cx, gy0 - 40, 260, 0.6 * Math.exp(-la * 6)); pillar(cx, gy0, 30 * Math.exp(-la * 5), NEUTRAL, Math.exp(-la * 4)); }
      over(); }
    // 主役のポッド（1連はその1個、10連は注目中の1個）
    const lead = m.multi ? m.pods.find((p) => p.focus && t >= p.focus[0] && t <= p.focus[3]) : m.pods[0];
    let dim = 0, tintCol = NEUTRAL, tint = 0, beams = 0, fkLead = 1;
    if (lead) { const { lv } = levelAt(lead, t), op = lead.tOpen != null && t >= lead.tOpen; tintCol = op ? TIER_COL[lead.tier] : LV_COL[lv]; tint = op ? (lead.tier >= 3 ? 0.26 : 0.1) : lv >= 2 ? 0.08 + 0.05 * lv : 0; beams = op ? lead.tier : lv;
      if (lead.focus) { const f = lead.focus, fk = t < f[1] ? seg(t, f[0], f[1]) : 1 - seg(t, f[2], f[3]); dim = 0.55 * fk; tint *= fk; fkLead = fk; }
      if (lead.hold && t >= lead.hold[0] && t < lead.hold[1]) dim = Math.max(dim, 0.72 * seg(t, lead.hold[0], lead.hold[0] + 0.15)); }
    if (tint > 0) { add(); const g = ctx.createLinearGradient(0, -PAD, 0, H); g.addColorStop(0, rgba(tintCol, tint)); g.addColorStop(0.5, rgba(tintCol, tint * 0.25)); g.addColorStop(1, rgba(tintCol, tint * 0.5)); ctx.fillStyle = g; ctx.fillRect(-PAD, -PAD, VW + 2 * PAD, H + 2 * PAD); over(); }
    if (beams >= 3 && !red) { // SR以上：地平線から段階色の探照灯が立つ
      add(); const n = (beams - 2) * 2, HZ = 118, len = 460;
      for (let i = 0; i < n; i++) { const o = i - (n - 1) / 2, bx = VW / 2 + lead.x + o * 150, an = -Math.PI / 2 + Math.sin(A * 0.7 + i * 1.9) * 0.3 + o * 0.13, g = ctx.createLinearGradient(bx, HZ, bx + Math.cos(an) * len, HZ + Math.sin(an) * len);
        g.addColorStop(0, rgba(tintCol, 0.26 * fkLead)); g.addColorStop(1, rgba(tintCol, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx - 2, HZ); ctx.lineTo(bx + Math.cos(an - 0.055) * len, HZ + Math.sin(an - 0.055) * len); ctx.lineTo(bx + Math.cos(an + 0.055) * len, HZ + Math.sin(an + 0.055) * len); ctx.lineTo(bx + 2, HZ); ctx.fill(); }
      over();
    }
    const order = m.pods.filter((p) => p !== lead);
    for (const p of order) podDraw(m, p, t);
    for (const p of order) podFx(m, p, t, A); // 動き減でも呼ぶ（次のポッドの目印を出すため。粒子は podFx 内で減らす）
    if (dim > 0) { ctx.fillStyle = `rgba(1,4,7,${dim.toFixed(3)})`; ctx.fillRect(-PAD - 400, -PAD - 400, VW + 2 * PAD + 800, H + 2 * PAD + 800); }
    if (lead) { podBack(m, lead, t, A); podDraw(m, lead, t); podFx(m, lead, t, A); }
    // 画面全体の効果
    screen();
    let flash = 0, lines = 0, lx = VW / 2, ly = H / 2, impact = 0, glitch = 0, conf = 0, confCol = TIER_COL[4];
    for (const p of m.pods) {
      const px = (VW / 2 + p.x - cam.x) * cam.z + VW / 2, py = (p.gy - p.h * 0.6 - cam.y) * cam.z + H / 2;
      for (const b of p.beats) { const a = t - b.t1; if (a >= 0 && b.to >= 3) flash += 0.14 * Math.exp(-a * 10); if (b.to === 5 && a > -0.06 && a < 0.24) glitch = Math.max(glitch, a < 0 ? 0.5 : 1 - a / 0.24); }
      if (p.tOpen != null && t >= p.tOpen && !p.wave) { const oa = t - p.tOpen; if (p.tier >= 4) { if (oa < 0.07) impact = 1; else flash += 0.36 * Math.exp(-(oa - 0.07) * 5.5); if (oa < 0.55) { lines = Math.max(lines, 1 - oa / 0.55); lx = px; ly = py; } conf = Math.max(conf, seg(oa, 0.1, 0.5)); confCol = TIER_COL[p.tier]; } else if (p.tier === 3) flash += 0.26 * Math.exp(-oa * 7); }
      if (p.hold && t >= p.hold[0] && t < p.hold[1]) { lines = Math.max(lines, 0.35 * seg(t, p.hold[0], p.hold[1])); lx = px; ly = py; }
    }
    if (m.multi && conf > 0) conf *= 1 - seg(t, m.tList, m.tList + 0.3) * 0.6;
    add();
    if (!red && lines > 0) speedLines(lx, ly, VW * 0.62, '#ffffff', 0.5 * lines, Math.floor(A * 30));
    if (impact && !red) { over(); ctx.fillStyle = 'rgba(0,0,0,.86)'; ctx.fillRect(-20, -20, VW + 40, H + 40); add(); speedLines(lx, ly, VW * 0.7, '#ffffff', 0.95, 7); dot('#ffffff', lx, ly, 150, 1); }
    over();
    // カットインの帯（文字と絵は DOM 側）
    for (const c of m.cuts) { if (t < c.c0 || t > c.tOut) continue; const k = seg(t, c.c0, c.c0 + 0.22, E.expo) * (1 - seg(t, c.tDone, c.tOut, E.in2)), tc = TIER_COL[c.p.tier], ax = VW * 0.7, hh = 218 * k, y0 = H / 2 - hh / 2;
      ctx.fillStyle = `rgba(2,6,10,${(0.8 * k).toFixed(3)})`; ctx.fillRect(-20, -20, VW + 40, H + 40);
      ctx.save(); ctx.beginPath(); ctx.rect(-20, y0, VW + 40, hh); ctx.clip();
      const g = ctx.createLinearGradient(0, 0, VW, 0); g.addColorStop(0, '#081116'); g.addColorStop(0.45, '#0b161b'); g.addColorStop(1, '#101a1c'); ctx.fillStyle = g; ctx.fillRect(-20, y0, VW + 40, hh);
      add(); dot(tc, ax, H / 2, 330, 0.5 * k);
      if (c.p.tier === 5) PRISM.forEach((pc, j) => rays(ax, H / 2, VW * 0.8, pc, 0.3 * k, A * 0.3 + j * 0.4, 5, 0.1, j)); else rays(ax, H / 2, VW * 0.8, tc, 0.36 * k, A * 0.3, 16, 0.09);
      ctx.fillStyle = rgba(tc, 0.3); for (let i = 0; i < 16; i++) { const len = 60 + 220 * hash(i, 2), xx = VW + 100 - ((hash(i, 3) + A * (0.5 + 0.9 * hash(i, 4))) % 1.3) * (VW + 300); ctx.fillRect(xx, y0 + hash(i, 1) * hh, len, 1.1); }
      if (c.starPos && !red) c.starPos.forEach(([sx, sy], i) => { const a = t - (c.tStars + i * c.step); if (a >= 0 && a < 0.6) { dot('#ffffff', sx, sy, 24 * (1 + a), 0.9 * Math.exp(-a * 9)); burst(700 + i, 10, a, { x: sx, y: sy, col: tc, alt: '#ffffff', sp: [60, 280], ang: [0, TAU], g: 220, life: [0.25, 0.55], size: 3.6, drag: 3 }); } });
      const sa = t - c.tSlam; if (sa >= 0) { dot('#ffffff', ax, H / 2, 420, 0.75 * Math.exp(-sa * 6)); ctx.save(); ctx.translate(ax, H / 2); ctx.rotate(-0.12); ctx.scale(26, 0.4); dot('#ffffff', 0, 0, 34, Math.exp(-sa * 5)); ctx.restore(); ring(ax, H / 2, 60 + 520 * E.out3(c01(sa / 0.5)), tc, 1 - c01(sa / 0.5), 5, 1); burst(500 + c.p.i, red ? 12 : 60, sa, { x: ax, y: H / 2, col: tc, alt: '#ffffff', sp: [200, 1100], ang: [0, TAU], g: 120, life: [0.4, 1.1], size: 6, drag: 2.4 }); }
      over(); ctx.restore();
      add(); ctx.fillStyle = rgba(tc, 0.95 * k); ctx.fillRect(-20, y0 - 1.5, VW + 40, 2.2); ctx.fillRect(-20, y0 + hh - 0.7, VW + 40, 2.2); ctx.save(); ctx.translate(VW / 2, y0); ctx.scale(VW / 60, 0.25); dot(tc, 0, 0, 40, 0.7 * k); ctx.restore(); ctx.save(); ctx.translate(VW / 2, y0 + hh); ctx.scale(VW / 60, 0.25); dot(tc, 0, 0, 40, 0.7 * k); ctx.restore(); over(); }
    // 開封後に舞い続ける光の粒（SSR・バディ）。カットインの帯の上にも降らせる
    if (conf > 0) { add(); for (let i = 0; i < (red ? 20 : 70); i++) { const sp = 0.1 + 0.16 * hash(i, 71), yy = ((hash(i, 72) + A * sp) % 1.15 - 0.08) * H, xx = (hash(i, 73) + 0.03 * Math.sin(A * (0.6 + hash(i, 74)) + i)) * VW; dot(i % 4 === 0 ? '#ffffff' : confCol === TIER_COL[5] ? PRISM[i % 4] : confCol, xx, yy, 2 + 3.5 * hash(i, 75), conf * (0.35 + 0.65 * Math.abs(Math.sin(A * (2 + 3 * hash(i, 76)) + i)))); } over(); }
    // 受領画面の後光
    const fin = m.multi ? seg(t, m.tList, m.tList + 0.3) : 0; if (fin > 0) { ctx.fillStyle = `rgba(2,6,10,${(0.66 * fin).toFixed(3)})`; ctx.fillRect(-20, -20, VW + 40, H + 40); }
    if (!m.multi) { const p = m.pods[0], k = seg(t, p.tCard, p.tCard + 0.4); if (k > 0 && p.tier >= 4) { add(); const tc = TIER_COL[p.tier]; if (p.tier === 5) PRISM.forEach((pc, j) => rays(VW / 2, 180, VW * 0.7, pc, 0.2 * k, A * 0.2 + j * 0.4, 5, 0.1, j)); else rays(VW / 2, 180, VW * 0.7, tc, 0.2 * k, A * 0.2, 16, 0.09); dot(tc, VW / 2, 180, 300, 0.4 * k); over(); } }
    // 光は一瞬だけ。点滅させず、上限を決める
    if (flash > 0) { add(); ctx.fillStyle = rgba('#ffeec4', Math.min(red ? 0.15 : 0.45, flash)); ctx.fillRect(-20, -20, VW + 40, H + 40); over(); }
    if (glitch > 0 && !red) { // バディ：通信の割り込み
      ctx.setTransform(1, 0, 0, 1, 0, 0); const fr = Math.floor(A * 30);
      for (let i = 0; i < 9; i++) { const y = Math.floor(hash(i, fr) * cv.height), hh = Math.floor((0.02 + 0.07 * hash(i + 3, fr)) * cv.height), dx = (hash(i + 5, fr) - 0.5) * 90 * S * glitch; ctx.drawImage(cv, 0, y, cv.width, hh, dx, y, cv.width, hh); }
      add(); for (let i = 0; i < 5; i++) { ctx.fillStyle = rgba(PRISM[i % 4], 0.35 * glitch); ctx.fillRect(0, hash(i + 20, fr) * cv.height, cv.width, 2 + 10 * hash(i + 30, fr) * S); } over();
    }
    return { cam, sh, VW, S };
  }
  return { resize, draw, get VW() { return VW; } };
}

/* ── 本体 ── */
const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(i); i.src = src; });
const starsHTML = (n, tier) => Array.from({ length: n }, () => `<i>${tier === 5 ? '◆' : '★'}</i>`).join('');
export function createDropReveal(host, opts = {}) {
  const o = { label: '配布券（仮）', assetBase: new URL('./assets/', import.meta.url).href, reduced: undefined, fast: false, sound: true, haptics: true, finalActions: [{ id: 'close', label: '閉じる', primary: true }], onAction: () => {}, onClose: () => {}, onEvent: () => {}, ...opts };
  const root = document.createElement('div'); root.className = 'gx-root'; root.hidden = true;
  root.innerHTML = `<canvas class="gx-cv"></canvas>
    <div class="gx-stage"><div class="gx-world"></div><div class="gx-omen"><span></span></div><div class="gx-cap"></div>
      <div class="gx-card"><div class="gx-card-art"><img alt=""><img class="gx-sil" alt=""></div><div class="gx-card-info"><b class="gx-rar"></b><span class="gx-name"></span><small class="gx-sub"></small><div class="gx-stars"></div></div><i class="gx-new">NEW</i></div>
      <div class="gx-cut"><div class="gx-ghost"></div><div class="gx-cut-art"><img alt=""><img class="gx-sil" alt=""><i class="gx-shine"></i></div><div class="gx-cut-text"><b class="gx-rar"></b><div class="gx-cut-info"><span class="gx-name"></span><small class="gx-sub"></small><div class="gx-stars"></div></div></div><i class="gx-new">NEW</i></div>
      <div class="gx-list"></div><div class="gx-launch" aria-hidden="true"><b>射出！</b><small>画面をタップして投下</small></div></div>
    <header class="gx-hud"><div class="gx-title"><small>SUPPLY DROP</small><b></b><span class="gx-status"></span></div><div class="gx-btns"><button type="button" data-act="sound" aria-pressed="true">音</button><button type="button" data-act="reduced" aria-pressed="false">動き減</button><button type="button" data-act="fast" aria-pressed="false">2×</button><button type="button" class="gx-skip" data-act="skip">スキップ ▶▶</button></div></header>
    <div class="gx-tap">TAP</div><footer class="gx-actions"></footer>`;
  host.appendChild(root);
  const $ = (s, e = root) => e.querySelector(s);
  const el = { cv: $('.gx-cv'), stage: $('.gx-stage'), world: $('.gx-world'), omen: $('.gx-omen'), omenT: $('.gx-omen span'), cap: $('.gx-cap'), card: $('.gx-card'), cut: $('.gx-cut'), list: $('.gx-list'), status: $('.gx-status'), label: $('.gx-title b'), tap: $('.gx-tap'), actions: $('.gx-actions'), launch: $('.gx-launch') };
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = o.reduced ?? !!(mq && mq.matches), fast = !!o.fast, results = null, model = null, minis = [], tiles = [], ren = null, imgs = null;
  let T = 0, idle = 0, stopIdx = 0, waiting = null, cueIdx = 0, raf = 0, lastNow = 0, lastTap = 0, curCut = null, live = false, queued = false, predecoded = [], onDraw = null;
  const player = createPlayer(o.sfxStyle); // 音の傾向：'heavy'（重厚・既定）/ 'deep'（深い電子音）/ 'balance'（標準）
  player.setVolume(o.volume ?? 1);
  if (o.sound && o.warm !== false) player.warm();
  const ready = Promise.all([loadImg(o.assetBase + 'pod-512.webp'), loadImg(o.assetBase + 'pod-256.webp')]).then(([pod, podS]) => { imgs = { pod, podS }; ren = createRenderer(el.cv, imgs); });
  const set = (e, k, v) => { if (e.style[k] !== v) e.style[k] = v; };
  const tf = (e, v) => set(e, 'transform', v), op = (e, v) => set(e, 'opacity', v.toFixed(3));
  const fillInfo = (box, r, tier) => { $('.gx-rar', box).textContent = rarText(tier); $('.gx-name', box).textContent = nameOf(r); $('.gx-name', box).classList.toggle('gx-long', nameOf(r).length > 14); $('.gx-sub', box).textContent = subOf(r) + (tier === 5 ? (r.new ? '　新しいバディが合流' : '　バディが合流') : ''); $('.gx-stars', box).innerHTML = starsHTML(starCount(tier), tier); box.querySelectorAll('img').forEach((im) => { im.src = artOf(r, o.assetBase); }); box.style.setProperty('--art', `url("${artOf(r, o.assetBase)}")`); box.dataset.tier = TIER_KEY[tier]; box.dataset.type = r.type; $('.gx-new', box).hidden = !r.new; };

  function mount() {
    model = build(results, reduced); root.dataset.mode = model.multi ? 'multi' : 'single'; el.label.textContent = `${o.label} ×${model.n}`;
    el.world.innerHTML = model.multi ? model.pods.map((p) => `<div class="gx-mini" data-tier="${TIER_KEY[p.tier]}"><img alt="" src="${esc(artOf(p.r, o.assetBase))}"><b>${esc(p.tier === 0 ? '×' + p.r.amount : rarText(p.tier))}</b></div>`).join('') : '';
    minis = [...el.world.querySelectorAll('.gx-mini')];
    el.list.innerHTML = model.multi ? model.pods.map((p) => `<div class="gx-tile" data-tier="${TIER_KEY[p.tier]}" data-type="${p.r.type}"><img alt="" src="${esc(artOf(p.r, o.assetBase))}"><b>${esc(rarText(p.tier) || '素材')}</b><span${nameOf(p.r).length > 16 ? ' class="gx-long"' : ''}>${esc(nameOf(p.r))}</span>${p.r.new ? '<i>NEW</i>' : ''}</div>`).join('') : '';
    tiles = [...el.list.children];
    if (!model.multi) fillInfo(el.card, results[0], model.tiers[0]);
    // カード・カットインの絵は、出す前に画像の展開を済ませておく（初めて見せる瞬間に描画が止まらないように）
    predecoded = [...new Set(model.pods.map((p) => artOf(p.r, o.assetBase)))].map((src) => { const im = new Image(); im.src = src; if (im.decode) im.decode().catch(() => {}); return im; });
    el.actions.innerHTML = o.finalActions.map((a) => `<button type="button" data-id="${esc(a.id)}"${a.primary ? ' class="gx-primary"' : ''}>${esc(a.label)}</button>`).join('');
    curCut = null;
  }
  function layout() { if (!ren || !ren.resize()) return; const u = el.cv.clientHeight / H; set(el.stage, 'width', ren.VW + 'px'); root.style.setProperty('--u', u); }
  function frame(t, A, showTap = false) {
    if (!ren || !model) return;
    const m = model, { cam, sh, VW, S } = ren.draw(m, t, A), u = el.cv.clientHeight / H;
    // 試作用の描画フック（確定演出の案を上に重ねて見るためのもの。設定しなければ何もしない）
    if (onDraw) { const g = el.cv.getContext('2d'); g.save(); onDraw(g, { cam, sh, VW, S, t, A, m, cv: el.cv }); g.restore(); }
    tf(el.stage, `translate(${(sh.x * u).toFixed(2)}px,${(sh.y * u).toFixed(2)}px) scale(${u})`);
    tf(el.world, `translate(${(VW / 2 - cam.x * cam.z).toFixed(2)}px,${(H / 2 - cam.y * cam.z).toFixed(2)}px) scale(${cam.z.toFixed(4)})`);
    const lead = m.multi ? m.pods.find((p) => p.focus && t >= p.focus[0] && t <= p.focus[3]) : m.pods[0];
    // 状況表示（結果を先に漏らさない）
    let st; if (t <= m.tLaunch + 1e-6) st = '投下要請'; else if (!m.multi) { const p = m.pods[0]; st = t < p.tLand ? '降下中' : t < p.tOpen ? (levelAt(p, t).lv >= 2 ? '反応を検知' : '解析中') : t < p.tCard ? '開封' : t < m.tEnd ? '確定' : '受領完了'; }
    else st = t < m.pods[9].tLand ? '降下中' : t < m.tList ? (lead && t < lead.tOpen ? '反応を検知' : `開封 ${m.pods.filter((p) => t >= p.tOpen).length}/10`) : t < m.tEnd ? '受領一覧' : '受領完了';
    if (el.status.textContent !== st) el.status.textContent = st;
    // 予兆の表示（下限だけ）
    let ov = 0; if (lead && t < lead.tOpen) { const { lv, since } = levelAt(lead, t); if (lv >= 2 && (!lead.focus || t >= lead.focus[0] + 0.15)) { const txt = lv === 5 ? 'バディ反応' : `${TIER_NAME[lv]}以上の反応`; if (el.omenT.textContent !== txt) el.omenT.textContent = txt; el.omen.style.setProperty('--c', LV_COL[lv]); ov = 1; tf(el.omen, `translateX(-50%) scale(${(1 + 0.7 * Math.exp(-(t - Math.max(since, lead.focus ? lead.focus[0] + 0.15 : 0)) * 11)).toFixed(3)})`); } }
    op(el.omen, ov);
    // 射出の合図（タップで投下）
    const B = m.tLaunch, lk = seg(t, B * 0.3, B, E.out3) * (1 - seg(t, B, B + 0.18)); op(el.launch, lk); set(el.launch, 'visibility', lk > 0 ? 'visible' : 'hidden');
    if (lk > 0) tf(el.launch, `translate(-50%,-50%) scale(${(t < B ? 0.85 + 0.15 * lk + (reduced ? 0 : 0.035 * Math.sin(A * 4.5)) : 1 + 0.6 * seg(t, B, B + 0.18, E.out3)).toFixed(3)})`);
    root.classList.toggle('gx-launching', t <= B + 1e-6);
    if (!m.multi) { // 1連の受領カード
      const p = m.pods[0], k = seg(t, p.tCard, p.tCard + 0.45, reduced ? E.out3 : E.back); op(el.card, seg(t, p.tCard, p.tCard + 0.12));
      tf(el.card, `translate(-50%,-50%) translateY(${((1 - k) * 120 + (t >= m.tEnd ? Math.sin(A * 1.5) * 2 : 0)).toFixed(2)}px) scale(${(0.5 + 0.5 * k).toFixed(3)})`);
      op($('.gx-sil', el.card), 1 - seg(t, p.tCard + 0.28, p.tCard + 0.5)); const rk = seg(t, p.tCard + 0.3, p.tCard + 0.46, E.out3); tf($('.gx-rar', el.card), `scale(${(2.4 - 1.4 * rk).toFixed(3)})`); op($('.gx-rar', el.card), rk);
      [...$('.gx-stars', el.card).children].forEach((s, i) => { const s0 = p.tier >= 4 ? p.tCard + 0.2 + i * 0.04 : p.tCard + 0.42 + i * 0.09, sk = seg(t, s0, s0 + 0.14, E.back); tf(s, `scale(${sk.toFixed(3)})`); });
      const nw = $('.gx-new', el.card); if (!nw.hidden) tf(nw, `rotate(6deg) scale(${seg(t, p.tCard + 0.75, p.tCard + 0.9, E.back).toFixed(3)})`);
    } else {
      // カットインの間は札を隠し、注目中は主役以外を暗くする
      const cc = m.cuts.find((x) => t >= x.c0 && t <= x.tOut), ck = cc ? seg(t, cc.c0, cc.c0 + 0.15) * (1 - seg(t, cc.tDone + 0.1, cc.tOut)) : 0;
      const fk = lead ? (t < lead.focus[1] ? seg(t, lead.focus[0], lead.focus[1]) : 1 - seg(t, lead.focus[2], lead.focus[3])) : 0;
      const lf = (1 - seg(t, m.tList, m.tList + 0.25)) * (1 - ck);
      m.pods.forEach((p, i) => { const t0 = p.tOpen == null ? 1e9 : p.cut ? p.cut.tOut - 0.2 : p.tOpen + (p.wave ? 0.04 : 0.12), e = minis[i], k = seg(t, t0, t0 + (p.wave ? 0.26 : 0.33), reduced ? E.out3 : E.back);
        op(e, (k > 0 ? Math.min(1, k * 3) : 0) * lf * (p === lead ? 1 : 1 - 0.85 * Math.min(1, fk * 2))); tf(e, `translate(${(VW / 2 + p.x).toFixed(1)}px,${(p.gy - p.h * 0.5 - 14 * k).toFixed(1)}px) translate(-50%,-50%) scale(${(0.3 + 0.7 * k).toFixed(3)})`);
      });
      const cp = m.pods.find((p) => p.cap && t >= p.cap[0] - 0.01 && t <= p.cap[1] + 0.2);
      if (cp) { const html = `<b>${rarText(cp.tier)}</b>${esc(nameOf(cp.r))}${cp.r.new ? '<i>NEW</i>' : ''}`; if (el.cap._h !== html) { el.cap.innerHTML = html; el.cap._h = html; el.cap.dataset.tier = TIER_KEY[cp.tier]; } const k = seg(t, cp.cap[0], cp.cap[0] + 0.2, E.out3) * (1 - seg(t, cp.cap[1], cp.cap[1] + 0.2)); op(el.cap, k); tf(el.cap, `translateX(-50%) translateY(${((1 - k) * 14).toFixed(1)}px)`); } else op(el.cap, 0);
      op(el.list, seg(t, m.tList, m.tList + 0.2)); set(el.list, 'visibility', t >= m.tList ? 'visible' : 'hidden');
      tiles.forEach((e, i) => { const k = seg(t, m.tList + 0.1 + i * 0.06, m.tList + 0.34 + i * 0.06, reduced ? E.out3 : E.back); op(e, Math.min(1, k * 2)); tf(e, `translateY(${((1 - k) * 26).toFixed(1)}px) scale(${(0.8 + 0.2 * k).toFixed(3)})`); });
    }
    // カットイン
    const c = m.cuts.find((x) => t >= x.c0 && t <= x.tOut);
    if (c !== curCut) { curCut = c; if (c) { c.starPos = null; fillInfo(el.cut, c.p.r, c.p.tier); $('.gx-ghost', el.cut).textContent = c.p.tier === 5 ? 'BUDDY' : 'SSR'; } }
    if (c) { const k = seg(t, c.c0, c.c0 + 0.22, E.expo) * (1 - seg(t, c.tDone, c.tOut, E.in2)); set(el.cut, 'visibility', 'visible'); op(el.cut, Math.min(1, k * 1.5)); set(el.cut, 'clipPath', `inset(${((1 - k) * 50).toFixed(2)}% 0)`);
      const ak = seg(t, c.c0 + 0.08, c.c0 + 0.5, reduced ? E.out3 : E.back), art = $('.gx-cut-art', el.cut); tf(art, `translate(-50%,-50%) translate(${((1 - ak) * 420).toFixed(1)}px,${(Math.sin(A * 1.6) * 3).toFixed(2)}px) scale(${(1 + 0.18 * Math.exp(-Math.max(0, t - c.tSlam) * 8) * (t >= c.tSlam ? 1 : 0)).toFixed(3)})`); op(art, seg(t, c.c0 + 0.08, c.c0 + 0.2));
      op($('.gx-sil', art), 1 - seg(t, c.tSlam - 0.02, c.tSlam + 0.18));
      const rk = seg(t, c.tSlam - 0.05, c.tSlam + 0.12, E.out3), rar = $('.gx-rar', el.cut); tf(rar, `scale(${(3 - 2 * rk).toFixed(3)})`); op(rar, rk);
      const ik = seg(t, c.tSlam + 0.08, c.tSlam + 0.32, E.out3), info = $('.gx-cut-info', el.cut); tf(info, `translateX(${((1 - ik) * -40).toFixed(1)}px)`); op(info, ik);
      [...$('.gx-stars', el.cut).children].forEach((s, i) => { const sk = seg(t, c.tStars + i * 0.09, c.tStars + 0.14 + i * 0.09, E.back); tf(s, `scale(${sk.toFixed(3)})`); });
      const nw = $('.gx-new', el.cut); if (!nw.hidden) tf(nw, `rotate(6deg) scale(${seg(t, c.tNew, c.tNew + 0.16, E.back).toFixed(3)})`);
      // 絵を走る光（確定の直後と、止まっている間は周期的に）
      const sp = t < c.tSlam + 0.22 ? 0 : (((A - c.tSlam - 0.22) % 2.6) / 0.6); set($('.gx-shine', art), 'backgroundPositionX', `${((1 - c01(sp)) * 100).toFixed(1)}%`);
      // 星の位置を測って Canvas 側へ渡す（星が出るたびに火花を散らす）
      if (!c.starPos && t >= c.tSlam + 0.33) { const sr = el.stage.getBoundingClientRect(); c.starPos = [...$('.gx-stars', el.cut).children].map((s) => { const r = s.getBoundingClientRect(); return [(r.left + r.width / 2 - sr.left) / u, (r.top + r.height / 2 - sr.top) / u]; }); }
      tf($('.gx-ghost', el.cut), `translateX(${(-((A * 14) % 60)).toFixed(1)}px)`);
    } else set(el.cut, 'visibility', 'hidden');
    root.classList.toggle('gx-waiting', showTap); root.classList.toggle('gx-final', t >= m.tEnd);
    root.querySelector('[data-act="skip"]').disabled = t >= m.tEnd;
  }
  function fire(a, b) { // (a, b] の合図を鳴らす
    const cs = model.cues; while (cueIdx < cs.length && cs[cueIdx].t <= b) { const c = cs[cueIdx++]; if (c.t < a - 1e-6 && a > 0) continue;
      if (o.sound) player.play(fast ? { ...c, id: fastId(c.id) } : c);
      if (o.haptics && c.buzz && !reduced && navigator.vibrate) { try { navigator.vibrate(c.buzz); } catch {} } }
  }
  function tick(now) {
    raf = requestAnimationFrame(tick); const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
    if (waiting) idle += dt; else { let nt = T + dt * (fast ? 2 : 1); const s = model.stops[stopIdx];
      if (s && nt >= s.t) { nt = s.t;
        // 動いている間に押されたタップは、次のポッド・昇格の停止点で使う（止まらずにそのまま進む）
        if (queued && QUEUE_KINDS.has(s.kind)) { queued = false; stopIdx++; o.onEvent({ type: 'pass', kind: s.kind, t: s.t }); }
        else { waiting = { since: now, kind: s.kind }; o.onEvent({ type: s.kind === 'final' ? 'final' : 'stop', kind: s.kind, t: s.t }); } }
      fire(T, nt); T = nt; }
    frame(T, T + idle, !!waiting && waiting.kind !== 'final' && now - waiting.since >= STOP_HOLD_MS[waiting.kind]);
  }
  const api = {
    ready,
    async play(arr, po = {}) { results = validate(arr); await ready; root.hidden = false; live = true; mount(); layout(); T = po.atEnd ? model.tEnd : 0; idle = 0; stopIdx = po.atEnd ? model.stops.length - 1 : 0; waiting = null; queued = false; cueIdx = po.atEnd ? model.cues.length : 0;
      if (o.sound && !po.silent) { player.unlock(); player.prime(); } cancelAnimationFrame(raf); lastNow = performance.now(); if (!po.manual) raf = requestAnimationFrame(tick); else frame(T, T); o.onEvent({ type: 'play', n: model.n }); },
    replay() { if (results) return api.play(results); },
    tap() { const now = performance.now(); if (!live || !model || now - lastTap < TAP_GAP_MS) return; lastTap = now;
      if (!waiting) { const s = model.stops[stopIdx]; if (s && QUEUE_KINDS.has(s.kind) && s.t - T <= QUEUE_SEC) queued = true; return; }
      if (waiting.kind === 'final' || now - waiting.since < STOP_HOLD_MS[waiting.kind]) return;
      const kind = waiting.kind; waiting = null; queued = false; stopIdx++; if (o.sound && kind === 'cut') player.play({ id: 'ui' }); },
    skip() { if (!live || !model || T >= model.tEnd) return; T = model.tEnd; stopIdx = model.stops.length - 1; cueIdx = model.cues.length; queued = false; waiting = { since: performance.now(), kind: 'final' }; if (o.sound) player.play({ id: 'done' }); o.onEvent({ type: 'final', t: T, skipped: true }); },
    close() { if (!live) return; live = false; cancelAnimationFrame(raf); root.hidden = true; o.onClose(); },
    destroy() { api.close(); player.dispose(); window.removeEventListener('resize', layout); window.removeEventListener('keydown', onKey); root.remove(); },
    setFast(v) { fast = !!v; root.querySelector('[data-act="fast"]').setAttribute('aria-pressed', String(fast)); },
    setReduced(v) { reduced = !!v; root.querySelector('[data-act="reduced"]').setAttribute('aria-pressed', String(reduced)); if (model) { // 停止点の並びは動き減でも同じなので、何番目の停止点まで進んだかを保ったまま時間だけ置き換える
        const i = stopIdx, s0 = i > 0 ? model.stops[i - 1].t : 0, s1 = model.stops[i].t, fr = s1 > s0 ? (T - s0) / (s1 - s0) : 1; mount();
        const a = i > 0 ? model.stops[i - 1].t : 0, b = model.stops[i].t; T = waiting ? b : a + (b - a) * fr; cueIdx = model.cues.findIndex((c) => c.t > T); if (cueIdx < 0) cueIdx = model.cues.length; } },
    setSound(v) { o.sound = !!v; player.setMuted(!o.sound); if (o.sound) { player.unlock(); player.prime(); } root.querySelector('[data-act="sound"]').setAttribute('aria-pressed', String(o.sound)); },
    // 検証・録画用：時刻 t の1コマを描く（idle は停止点で止まっている間の経過）
    seek(t, idleSec = 0, showTap = false) { T = t; idle = idleSec; frame(t, t + idleSec, showTap); },
    setOnDraw(fn) { onDraw = fn || null; },
    root,
    playCue(c) { if (o.sound) { player.unlock(); player.play(c); } },
    model: () => model, state: () => ({ t: T, waiting: waiting && waiting.kind, stopIdx, reduced, fast }), layout,
  };
  root.addEventListener('pointerdown', (e) => { if (o.externalControls || e.target.closest('button')) return; api.tap(); });
  root.querySelector('.gx-btns').addEventListener('click', (e) => { const a = e.target.closest('button')?.dataset.act; if (a === 'skip') api.skip(); else if (a === 'fast') api.setFast(!fast); else if (a === 'reduced') api.setReduced(!reduced); else if (a === 'sound') api.setSound(!o.sound); });
  el.actions.addEventListener('click', (e) => { const id = e.target.closest('button')?.dataset.id; if (!id) return; if (id === 'again') api.replay(); else if (id === 'close') api.close(); o.onAction(id); });
  const onKey = (e) => { if (!live || o.externalControls) return; if (e.key === 'Escape') api.skip(); else if (e.key === ' ' || e.key === 'Enter') { if (!e.target.closest || !e.target.closest('button')) api.tap(); } };
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', layout);
  api.setReduced(reduced); api.setFast(fast);
  return api;
}

/* ── 確認用の仮の結果（確率や排出内容を示すものではない） ── */
const W = (rarity, name, extra) => ({ type: 'weapon', rarity, name, ...extra });
const Sh = (amount) => ({ type: 'shard', amount });
const B = (name, art, extra) => ({ type: 'buddy', name, art, ...extra });
export const PRESETS1 = {
  '武装片': [Sh(30)], 'N武器': [W('N', 'ハンドガン（仮）')], 'R武器': [W('R', 'アサルトライフル（仮）')], 'SR武器': [W('SR', '散弾銃（仮）', { new: true })],
  'SSR武器': [W('SSR', '狙撃銃 ヘイルストーム（仮）', { new: true })], 'バディ': [B('オリハ（仮）', 'b-oriha', { new: true })], 'バディ（所持済み）': [B('タタラ（仮）', 'b-tatara', { new: false })],
};
export const PRESETS10 = {
  '通常のみ': [Sh(20), W('N', 'ハンドガン（仮）'), Sh(15), W('R', 'サブマシンガン（仮）'), Sh(20), Sh(10), W('N', '散弾銃（仮）'), Sh(25), W('R', 'アサルトライフル（仮）'), Sh(15)],
  'SR2件': [Sh(20), W('R', 'アサルトライフル（仮）'), W('SR', '散弾銃（仮）', { new: true }), Sh(15), W('N', 'ハンドガン（仮）'), Sh(10), Sh(20), W('SR', 'グレネードランチャー（仮）'), Sh(25), W('N', 'サブマシンガン（仮）')],
  'SSR＋SR': [Sh(20), W('SR', '散弾銃（仮）'), Sh(15), W('R', 'アサルトライフル（仮）'), Sh(10), W('SSR', '狙撃銃 ヘイルストーム（仮）', { new: true }), Sh(20), W('N', 'ハンドガン（仮）'), Sh(15), W('R', 'サブマシンガン（仮）')],
  'バディ＋SSR＋SR': [Sh(20), W('R', 'アサルトライフル（仮）'), B('ヨスガ（仮）', 'b-yosuga', { new: true }), Sh(15), W('SR', '散弾銃（仮）'), Sh(10), W('N', 'ハンドガン（仮）'), W('SSR', 'ロケットランチャー ヴォルカ（仮）', { new: true }), Sh(25), Sh(15)],
  '長い名前の確認': [W('SSR', '超長距離精密狙撃銃 ヘイルストーム・ロングバレル改二（仮）', { new: true }), W('SR', 'フルオート散弾銃 ブリーチャーMk-IV 拡張弾倉仕様（仮）'), Sh(999), W('R', 'アサルトライフル AR-9 カスタム・ストック（仮）'), W('N', 'ハンドガン（仮）'), Sh(15), B('メニスカス・ロングネーム確認用（仮）', 'b-tobari', { new: true }), Sh(20), W('R', 'サブマシンガン（仮）'), Sh(15)],
  '全部武装片': Array.from({ length: 10 }, (_, i) => Sh(10 + i * 5)),
};
