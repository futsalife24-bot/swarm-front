// 補給ポッド演出の効果音。合成波形とCC0の鍵とボルトの解除実録を使う。
import { crateOpen } from './crate-open-pcm.js';
// ブラウザ（再生）と Node（動画用の書き出し）の両方から同じ計算を使う。
// 音作りの方針（2026-11-11 改訂）：耳に刺さる高音を避ける。
//   - 金属的な鈴（FM）は使わず、やわらかい打鍵音（倍音を少なく、高い倍音ほど早く消す）にする
//   - 音域を全体に下げ、厚みは金管風の和音・弦の膨らみ・重低音で出す
//   - 仕上げに急な高域カットをかけ、6kHz以上をほぼ残さない。残響も暗めにする
export const SR = 44100;
// 溜めの長さ（秒）。昇格するたびに短くなり、音程は上がる。gacha.js の時間軸と共有する
export const CHARGE = [0.46, 0.4, 0.35, 0.31, 0.28];
const TAU = Math.PI * 2;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
let _s = 1;
const rnd = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 2147483648 - 1; };
const lpA = (fc) => 1 - Math.exp(-TAU * Math.min(fc, SR * 0.45) / SR);
const saw = (ph, dt) => { let v = 2 * ph - 1; if (ph < dt) { const t = ph / dt; v -= t + t - t * t - 1; } else if (ph > 1 - dt) { const t = (ph - 1) / dt; v -= t * t + t + t + 1; } return v; };
const buf = (dur) => { const n = Math.ceil(dur * SR); return [new Float32Array(n), new Float32Array(n)]; };
const pg = (pan) => { const a = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4; return [Math.cos(a), Math.sin(a)]; };
const span = (b, t0, dur) => { const i0 = Math.max(0, Math.round(t0 * SR)); return [i0, Math.max(0, Math.min(Math.floor(dur * SR), b[0].length - i0))]; };

/* ── 部品 ── */
function sine(b, t0, dur, f0, f1, amp, o = {}) {
  const { att = 0.002, dec = 0, pan = 0, curve = 1, shape } = o;
  const [i0, n] = span(b, t0, dur), [gl, gr] = pg(pan); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = i / n; ph += TAU * f0 * (f1 / f0) ** (u ** curve) / SR;
    const s = Math.sin(ph) * amp * Math.min(1, t / att) * (dec ? Math.exp(-t * dec) : 1) * Math.min(1, (dur - t) * 250) * (shape ? shape(u) : 1);
    b[0][i0 + i] += s * gl; b[1][i0 + i] += s * gr;
  }
}
// 帯域を絞ったノイズ。上限 hi と下限 lo を時間で動かせる
function noise(b, t0, dur, amp, o = {}) {
  const { hi0 = 3000, hi1 = hi0, lo0 = 0, lo1 = lo0, att = 0.002, dec = 0, pan = 0, shape } = o;
  const [i0, n] = span(b, t0, dur), [gl, gr] = pg(pan); let y1 = 0, y2 = 0, z = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = i / n, a = lpA(hi0 * (hi1 / hi0) ** u), x = rnd();
    y1 += a * (x - y1); y2 += a * (y1 - y2); let s = y2;
    if (lo0 > 0) { z += lpA(lo0 * (lo1 / lo0) ** u) * (s - z); s -= z; }
    s *= Math.min(1, t / att) * (dec ? Math.exp(-t * dec) : 1) * Math.min(1, (dur - t) * 250) * (shape ? shape(u) : 1) * amp;
    b[0][i0 + i] += s * gl; b[1][i0 + i] += s * gr;
  }
}
// やわらかい打鍵音（チェレスタやビブラフォンに近い）。[倍音の比, 強さ, 減衰の速さ]。6.5kHzを超える倍音は鳴らさない
const MALLET = [[1, 1, 1], [2, 0.36, 1.8], [3, 0.12, 3], [4.2, 0.05, 4.4], [5.4, 0.02, 6]];
const TINE = [[1, 1, 1], [2, 0.14, 2.2]];
function mallet(b, t0, midi, amp, pan = 0, o = {}) {
  const { dec = 3, len = 1.6, att = 0.004, parts = MALLET, thud = 0.2 } = o;
  const f = mtof(midi), [i0, n] = span(b, t0, len), [gl, gr] = pg(pan), ps = parts.filter(([r]) => f * r < 6500);
  // 倍音ごとに「回転」で正弦波を作り、減衰は掛け算で進める（Math.sin・Math.exp を毎回呼ばずに済む）
  const P = ps.map(([r, a, d]) => ({ c: Math.cos(TAU * f * r / SR), s: Math.sin(TAU * f * r / SR), x: 0, y: a, k: Math.exp(-dec * d / SR) }));
  for (let i = 0; i < n; i++) {
    const t = i / SR; let s = 0;
    for (const p of P) { const x = p.x * p.c + p.y * p.s, y = p.y * p.c - p.x * p.s; p.x = x * p.k; p.y = y * p.k; s += p.x; }
    s *= amp * Math.min(1, t / att) * Math.min(1, (len - t) * 12); b[0][i0 + i] += s * gl; b[1][i0 + i] += s * gr;
  }
  if (thud) noise(b, t0, 0.04, amp * thud, { hi0: Math.min(3600, f * 3), lo0: 150, dec: 80, pan }); // 打った瞬間の輪郭（こもりすぎない程度）
}
// 少しずつ音程をずらした鋸波の重ね（金管・弦の和音）。g0→g1 は音程の移動（半音）、cut0→cut1 は明るさの移動
function saws(b, t0, dur, midis, amp, o = {}) {
  const { cut0 = 1200, cut1 = cut0, ct = dur, att = 0.01, rel = 0.3, g0 = 0, g1 = 0, gc = 1.3, trem0 = 0, trem1 = 0, tremD = 0, swell = 0, vib = 0 } = o;
  const [i0, n] = span(b, t0, dur + rel);
  midis.forEach((m, k) => [-9, 0, 8].forEach((cents, v) => {
    const f = mtof(m + cents / 100), [gl, gr] = pg((v - 1) * 0.75 + (k % 2 ? 0.12 : -0.12)); let ph = ((k * 3 + v) * 0.37) % 1, y1 = 0, y2 = 0, tp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, u = Math.min(1, t / dur), ff = f * 2 ** ((g0 + (g1 - g0) * u ** gc + vib * Math.sin(TAU * 5.2 * t + k) * Math.min(1, t * 3)) / 12), dt = ff / SR;
      ph = (ph + dt) % 1; const a = lpA(cut0 * (cut1 / cut0) ** Math.min(1, t / ct));
      y1 += a * (saw(ph, dt) - y1); y2 += a * (y1 - y2);
      let env = Math.min(1, t / att) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / rel)); if (swell) env *= u ** swell;
      if (tremD) { tp += TAU * (trem0 + (trem1 - trem0) * u) / SR; env *= 1 - tremD * (0.5 + 0.5 * Math.sin(tp)); }
      const s = y2 * env * amp; b[0][i0 + i] += s * gl; b[1][i0 + i] += s * gr;
    }
  }));
}
function pluck(b, t0, midi, amp, pan = 0, len = 0.4, bright = 0.5) {
  const f = mtof(midi), dt = f / SR, [i0, n] = span(b, t0, len), [gl, gr] = pg(pan); let ph = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph = (ph + dt) % 1; const a = lpA(300 + 2600 * bright * Math.exp(-t * 16));
    y1 += a * (saw(ph, dt) * 0.7 + (ph < 0.5 ? 0.3 : -0.3) - y1); y2 += a * (y1 - y2);
    const s = y2 * amp * Math.min(1, t * 500) * Math.exp(-t * 9) * Math.min(1, (len - t) * 60); b[0][i0 + i] += s * gl; b[1][i0 + i] += s * gr;
  }
}
// 低い打撃音（音程が落ちる正弦波＋短いこもったノイズ）
function thump(b, t0, amp, f0 = 130, f1 = 42, dec = 9, click = 0.25, len = 1.2) {
  const [i0, n] = span(b, t0, len); let ph = 0, y = 0; const a = lpA(1800);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (f1 + (f0 - f1) * Math.exp(-t * 30)) / SR; y += a * (rnd() - y);
    const s = amp * (Math.sin(ph) * Math.exp(-t * dec) * Math.min(1, t * 900) + click * 3 * y * Math.exp(-t * 220)) * Math.min(1, (len - t) * 40);
    b[0][i0 + i] += s * 0.707; b[1][i0 + i] += s * 0.707;
  }
}
// 長く尾を引く重低音（映画の「ドーン」）
function boom(b, t0, amp, len = 2.4) {
  const [i0, n] = span(b, t0, len); let ph = 0, y1 = 0, y2 = 0; const a = lpA(160);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (31 + 34 * Math.exp(-t * 3.5)) / SR; const x = rnd(); y1 += a * (x - y1); y2 += a * (y1 - y2);
    const s = amp * (Math.sin(ph) * 0.85 + y2 * 5) * Math.exp(-t * (2.6 / len) * 1.6) * Math.min(1, t * 300) * Math.min(1, (len - t) * 6);
    b[0][i0 + i] += s * 0.707; b[1][i0 + i] += s * 0.707;
  }
}
function lowpass(b, fc, passes = 2) { const a = lpA(fc); for (const ch of b) for (let p = 0; p < passes; p++) { let y1 = 0, y2 = 0; for (let i = 0; i < ch.length; i++) { y1 += a * (ch[i] - y1); y2 += a * (y1 - y2); ch[i] = y2; } } }
function reverb(b, wet, fb = 0.84, damp = 0.2) {
  const N = b[0].length;
  [0, 1].forEach((c) => {
    const x = b[c], acc = new Float32Array(N);
    for (const base of [1557, 1617, 1491, 1422, 1277, 1356]) { const D = base + c * 23, d = new Float32Array(D); let p = 0, lp = 0;
      for (let i = 0; i < N; i++) { const y = d[p]; lp += damp * (y - lp); d[p] = x[i] + lp * fb; p = (p + 1) % D; acc[i] += y; } }
    let sig = acc;
    for (const base of [225, 556]) { const D = base + c * 11, d = new Float32Array(D), o = new Float32Array(N); let p = 0;
      for (let i = 0; i < N; i++) { const q = d[p], v = sig[i] + 0.5 * q; d[p] = v; o[i] = q - 0.5 * v; p = (p + 1) % D; } sig = o; }
    for (let i = 0; i < N; i++) x[i] += wet * 0.16 * sig[i];
  });
}
// 仕上げ：高域を切ってから、やわらかく頭を抑えて正規化する。fc は再生速度を上げて鳴らす音ほど低くする
function fin(b, peak = 0.9, drive = 1.05, fc = 6200) {
  lowpass(b, fc, 2);
  const N = b[0].length; let m = 0;
  for (const ch of b) for (let i = 0; i < N; i++) { ch[i] = Math.tanh(ch[i] * drive); m = Math.max(m, Math.abs(ch[i])); }
  const g = m > 0 ? peak / m : 1, f = Math.min(N, Math.round(0.006 * SR));
  for (const ch of b) { for (let i = 0; i < N; i++) ch[i] *= g; for (let i = 0; i < f; i++) ch[N - 1 - i] *= i / f; }
  return b;
}
// ポッドの蓋が外れる音（金属の軽い打音。高い倍音は入れない）
const clack = (b, t0, amp) => { noise(b, t0, 0.06, amp, { hi0: 2400, lo0: 400, dec: 55 }); sine(b, t0, 0.08, 220, 140, amp * 0.9, { dec: 40 }); sine(b, t0, 0.12, 523, 523, amp * 0.12, { dec: 34 }); sine(b, t0, 0.1, 784, 784, amp * 0.07, { dec: 40 }); };

/* ── 音の定義（すべてニ長調。昇格はレ→ファ♯→ラ→レと上がる） ── */
const PROMO = [62, 66, 69, 74];
function fanfare(buddy) {
  const b = buf(4.6);
  boom(b, 0, 0.6, 3.0); thump(b, 0, 0.6, 120, 36, 5, 0.4, 1.4);
  noise(b, 0, 0.4, 0.45, { hi0: 1600, dec: 9 });
  noise(b, 0, 2.6, 0.12, { hi0: 5200, hi1: 2400, lo0: 1600, lo1: 800, dec: 1.7 }); // 暗めのシンバル
  // 金管：低い音域で和音を立ち上げ、明るさは2.6kHzで止める
  saws(b, 0, 2.3, buddy ? [38, 45, 50, 57, 61, 64, 66] : [38, 45, 50, 54, 57, 62, 66], 0.1, { cut0: 500, cut1: 3400, ct: 0.28, att: 0.014, rel: 1.6, vib: 0.08 });
  // 弦：少し遅れて膨らむ
  saws(b, 0.1, 2.5, buddy ? [74, 78, 81, 85] : [74, 78, 81, 86], 0.03, { cut0: 900, cut1: 2600, att: 0.35, rel: 1.8, vib: 0.12 });
  const arp = buddy ? [69, 73, 74, 76, 78, 81, 85, 86, 88, 90] : [69, 74, 78, 81, 86, 90], step = buddy ? 0.055 : 0.07;
  arp.forEach((m, i) => mallet(b, 0.4 + i * step, m, 0.3 - i * 0.01, i % 2 ? 0.4 : -0.4, { dec: 2.2, len: 2.2 }));
  for (let i = 0; i < (buddy ? 12 : 8); i++) mallet(b, 1.0 + (i / 10) * 2.0 + 0.05 * rnd(), [81, 86, 88, 90][Math.floor((rnd() * 0.5 + 0.5) * 3.99)], 0.05, rnd() * 0.7, { dec: 1.4, len: 1.6, parts: TINE, thud: 0 });
  reverb(b, 0.6, 0.86); return fin(b, 0.97, 1.1, 6500);
}
function charge(k, d) {
  const b = buf(d + 0.012), base = [50, 54, 57, 62, 66][k];
  thump(b, 0, 0.36, 110, 52, 16, 0.2, 0.22); // 溜めの頭に鼓動。溜めが短くなるほど鼓動が速くなる
  saws(b, 0, d, [base - 12], 0.07, { cut0: 200, cut1: 900, g0: 0, g1: 7, att: 0.03, rel: 0.008, swell: 1.3 });
  saws(b, 0, d, [base, base + 7, base + 12], 0.12, { cut0: 320, cut1: 3400, g0: 0, g1: 7, att: 0.03, rel: 0.008, trem0: 7, trem1: 15, tremD: 0.3, swell: 1.3 });
  sine(b, 0, d, mtof(base - 24), mtof(base - 17), 0.14, { shape: (u) => u });
  noise(b, 0, d, 0.22, { hi0: 600, hi1: 4200, lo0: 400, lo1: 1800, shape: (u) => u * u });
  return fin(b, 0.5 + 0.05 * k, 1.0, 6000);
}
function hold(s) { // 開封直前の溜め（s は時間の倍率。2倍速では 0.5）
  const b = buf(0.62 * s);
  thump(b, 0.03 * s, 0.9, 74, 40, 13, 0.1, 0.3); thump(b, 0.19 * s, 0.65, 66, 38, 14, 0.1, 0.3);
  noise(b, 0.12 * s, 0.47 * s, 0.45, { hi0: 400, hi1: 3000, lo0: 200, lo1: 1200, shape: (u) => u ** 3 });
  sine(b, 0.12 * s, 0.47 * s, 110, 520, 0.14, { shape: (u) => u ** 3, curve: 2 });
  for (let i = 0, tt = 0.05; tt < 0.585; i++) { noise(b, tt * s, 0.03, 0.1 + 0.4 * (tt / 0.6) ** 2, { hi0: 2200, lo0: 600, dec: 70, pan: i % 2 ? 0.25 : -0.25 }); tt += 0.06 - 0.036 * (tt / 0.6); }
  return fin(b, 0.66, 1.0, 4500);
}
const DEF = {
  call: () => { const b = buf(1.3); sine(b, 0, 1.0, mtof(38), mtof(38), 0.35, { att: 0.08, dec: 3 });
    saws(b, 0, 0.45, [50, 62, 69, 74], 0.05, { cut0: 400, cut1: 2400, ct: 0.3, att: 0.08, rel: 0.5 });
    mallet(b, 0.06, 74, 0.25, -0.2, { dec: 3 }); mallet(b, 0.16, 81, 0.22, 0.2, { dec: 3 }); reverb(b, 0.35); return fin(b, 0.45, 1.0, 6000); },
  fall: () => { const b = buf(0.56); noise(b, 0, 0.55, 1, { hi0: 2800, hi1: 500, lo0: 600, lo1: 90, shape: (u) => u ** 2.2 });
    sine(b, 0, 0.55, 420, 70, 0.18, { shape: (u) => u ** 1.5 }); return fin(b, 0.7, 1.0, 4200); },
  land: () => { const b = buf(1.6); thump(b, 0, 1.2, 150, 36, 6, 0.4, 1.2); boom(b, 0, 0.45, 1.4); noise(b, 0, 0.3, 0.8, { hi0: 900, dec: 13 });
    [311, 467, 622, 933, 1245].forEach((f, i) => sine(b, 0.004, 0.3, f, f * 0.996, 0.13, { dec: 16 + i * 4, pan: i % 2 ? 0.4 : -0.4 }));
    noise(b, 0.03, 0.7, 0.2, { hi0: 3400, lo0: 800, dec: 7 }); reverb(b, 0.4); return fin(b, 0.95, 1.1, 6000); },
  land_s: () => { const b = buf(0.7); thump(b, 0, 1, 130, 48, 11, 0.4, 0.6); noise(b, 0, 0.15, 0.6, { hi0: 1100, dec: 22 });
    [467, 622, 933].forEach((f) => sine(b, 0.003, 0.16, f, f, 0.12, { dec: 28 })); noise(b, 0.01, 0.2, 0.15, { hi0: 3200, lo0: 900, dec: 14 }); reverb(b, 0.25); return fin(b, 0.62, 1.0, 5200); },
  hold: () => hold(1), hold_f: () => hold(0.5),
  open0: () => { const b = buf(0.6); clack(b, 0, 0.6); pluck(b, 0.02, 69, 0.5, 0, 0.35, 0.45); reverb(b, 0.2); return fin(b, 0.42, 1.0, 5200); },
  open1: () => { const b = buf(0.8); clack(b, 0, 0.6); pluck(b, 0.02, 74, 0.45, 0, 0.4, 0.5); mallet(b, 0.03, 81, 0.22, 0, { dec: 4, len: 0.7 }); reverb(b, 0.2); return fin(b, 0.46, 1.0, 5600); },
  open2: () => { const b = buf(1.3); clack(b, 0, 0.6); thump(b, 0, 0.4, 120, 55, 14, 0.2, 0.4); pluck(b, 0.02, 74, 0.42, -0.2, 0.5, 0.55); pluck(b, 0.02, 81, 0.36, 0.2, 0.5, 0.55);
    mallet(b, 0.05, 86, 0.32, 0, { dec: 3, len: 1.2 }); mallet(b, 0.12, 90, 0.18, 0.3, { dec: 3.5, len: 1 }); reverb(b, 0.3); return fin(b, 0.6, 1.0, 6000); },
  open3: () => { const b = buf(2.6); clack(b, 0, 0.6); thump(b, 0, 1, 130, 40, 7, 0.3, 0.9); boom(b, 0, 0.4, 1.2);
    noise(b, 0, 1.2, 0.13, { hi0: 4400, hi1: 2000, lo0: 1500, dec: 4 });
    saws(b, 0, 0.9, [38, 50, 57, 62, 66, 69], 0.085, { cut0: 700, cut1: 3200, ct: 0.18, rel: 0.7, vib: 0.06 });
    [74, 78, 81, 86].forEach((m, i) => mallet(b, 0.02 + i * 0.07, m, 0.3, i % 2 ? 0.35 : -0.35, { dec: 2.6, len: 2 })); reverb(b, 0.45); return fin(b, 0.82, 1.05, 6200); },
  open4: () => fanfare(false),
  open5: () => fanfare(true),
  slam: () => { const b = buf(1.0); thump(b, 0, 1.1, 170, 44, 9, 0.5, 0.7); boom(b, 0, 0.4, 1.0); noise(b, 0, 0.2, 0.6, { hi0: 2200, dec: 17 });
    [196, 294].forEach((f) => sine(b, 0, 0.3, f, f, 0.1, { dec: 14 })); saws(b, 0, 0.2, [38, 50, 57, 62], 0.18, { cut0: 3200, cut1: 500, rel: 0.25 }); reverb(b, 0.3); return fin(b, 0.85, 1.1, 6000); },
  // 星は最大で1.7倍の速さ（音程が上がる）で鳴らすため、元の音を暗めにしておく
  star: () => { const b = buf(1.0); mallet(b, 0, 78, 0.6, 0, { dec: 3.2, len: 1 }); reverb(b, 0.3); return fin(b, 0.45, 1.0, 4200); },
  new: () => { const b = buf(1.1); mallet(b, 0, 81, 0.45, -0.2, { dec: 3, len: 1 }); mallet(b, 0.07, 86, 0.45, 0.2, { dec: 2.8, len: 1 }); reverb(b, 0.3); return fin(b, 0.5, 1.0, 6000); },
  // 10連の開封音と一覧の音は、音階をつけて最大3.4倍の速さで鳴らす。元は低く・暗くしておく
  pop: () => { const b = buf(0.4); pluck(b, 0, 55, 0.6, 0, 0.3, 0.5); mallet(b, 0, 67, 0.2, 0, { dec: 6, len: 0.4, thud: 0.3 }); return fin(b, 0.5, 1.0, 3000); },
  pop_r: () => { const b = buf(0.6); pluck(b, 0, 60, 0.55, 0, 0.3, 0.55); mallet(b, 0, 72, 0.3, 0, { dec: 5, len: 0.5, thud: 0.3 }); reverb(b, 0.2); return fin(b, 0.55, 1.0, 3200); },
  lock: () => { const b = buf(0.9); thump(b, 0, 0.7, 95, 50, 15, 0.3, 0.3); mallet(b, 0, 74, 0.45, 0, { dec: 3.5, len: 0.8 }); mallet(b, 0.01, 81, 0.25, 0, { dec: 4, len: 0.7 }); reverb(b, 0.3); return fin(b, 0.62, 1.0, 5600); },
  whoosh: () => { const b = buf(0.36); noise(b, 0, 0.34, 1, { hi0: 500, hi1: 2600, lo0: 200, lo1: 900, shape: (u) => Math.sin(Math.PI * u) ** 1.5 }); return fin(b, 0.4, 1.0, 3500); },
  tile: () => { const b = buf(0.28); mallet(b, 0, 62, 0.5, 0, { dec: 9, len: 0.26, thud: 0.3 }); return fin(b, 0.3, 1.0, 3000); },
  done: () => { const b = buf(2.0); [74, 78, 81, 86].forEach((m, i) => mallet(b, i * 0.045, m, 0.38, i % 2 ? 0.3 : -0.3, { dec: 2.4, len: 1.8 }));
    saws(b, 0, 0.5, [50, 62, 66, 69, 74], 0.035, { cut0: 2200, cut1: 900, att: 0.05, rel: 0.8 }); reverb(b, 0.4); return fin(b, 0.55, 1.0, 6000); },
  glass: () => { const b = buf(0.16); noise(b, 0, 0.11, 0.7, { hi0: 6500, hi1: 2800, lo0: 1300, dec: 48, att: 0.001 }); sine(b, 0.004, 0.11, 2800, 1900, 0.16, { dec: 35, att: 0.001 }); return fin(b, 0.3, 1.0, 6000); },
  ui: () => { const b = buf(0.14); mallet(b, 0, 79, 0.5, 0, { dec: 14, len: 0.13, thud: 0.3 }); return fin(b, 0.25, 1.0, 4500); },
  bed: () => { const b = buf(5.0); const sh = (u) => Math.min(1, u * 12) * Math.min(1, (1 - u) * 4);
    saws(b, 0, 4.4, [26, 38], 0.16, { cut0: 170, cut1: 330, att: 0.3, rel: 0.6 }); noise(b, 0, 5, 0.5, { hi0: 160, shape: sh }); return fin(b, 0.2, 1, 2000); },
};
// 溜め。2倍速では、音程を上げて速く鳴らすと安っぽく聞こえるので、半分の長さの音を別に作る
CHARGE.forEach((d, k) => { DEF['charge' + k] = () => charge(k, d); DEF['charge' + k + '_f'] = () => charge(k, d / 2); });
PROMO.forEach((root, j) => { const lv = j + 2; DEF['promote' + lv] = () => { const b = buf(1.8);
  let t0 = 0;
  if (lv === 5) { for (let i = 0; i < 6; i++) noise(b, i * 0.024, 0.016, 0.35, { hi0: 1800, lo0: 300, pan: i % 2 ? 0.4 : -0.4 }); thump(b, 0, 0.6, 90, 40, 10, 0.1, 0.3); t0 = 0.15; } // 割り込みの乱れ（こもった短い粒）
  thump(b, t0, 0.7, 140, 48, 10, 0.3, 0.6); boom(b, t0, 0.15 + 0.05 * j, 1.2);
  saws(b, t0, 0.32, [root - 24, root - 17, root - 12, root - 5, root], 0.1, { cut0: 3400, cut1: 700, rel: 0.4 }); // 金管の短い一撃
  if (lv >= 4) saws(b, t0, 0.5, [root - 36, root - 24], 0.12, { cut0: 900, cut1: 300, rel: 0.4 });
  mallet(b, t0 + 0.01, root + 12, 0.5, 0, { dec: 2.4, len: 1.6 }); mallet(b, t0 + 0.01, root + 7, 0.3, 0.3, { dec: 2.8, len: 1.4 }); mallet(b, t0 + 0.03, root + 19, 0.16, -0.3, { dec: 3, len: 1.3 });
  [0, 4, 7].forEach((st, i) => mallet(b, t0 + 0.12 + i * 0.05, root + 12 + st, 0.1, i % 2 ? 0.5 : -0.5, { dec: 4, len: 0.8, thud: 0 }));
  reverb(b, 0.42); return fin(b, 0.66 + 0.07 * j, 1.05, 6200); }; });

/* ── 音の傾向（3種類）。balance が標準。heavy・deep は主な音だけを差し替え、他は標準を使う ── */
// 808系の重低音：音程が落ちる正弦波を少し歪ませ、スマホでも聞こえる倍音を足す
function sub808(b, t0, amp, f0, f1, len, drive = 2.2, pdec = 18) {
  const [i0, n] = span(b, t0, len), k = Math.tanh(drive); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (f1 + (f0 - f1) * Math.exp(-t * pdec)) / SR;
    const s = amp * Math.tanh(drive * Math.sin(ph)) / k * Math.exp(-t * 3.2 / len) * Math.min(1, t * 600) * Math.min(1, (len - t) * 10);
    b[0][i0 + i] += s * 0.707; b[1][i0 + i] += s * 0.707; }
}
// ティンパニの連打（だんだん速く、強く）
function roll(b, t0, dur, midi, amp, acc = 2.5) { for (let t = 0; t < dur; ) { const u = t / dur; thump(b, t0 + t, amp * (0.35 + 0.65 * u * u), mtof(midi) * 1.6, mtof(midi), 9, 0.25, 0.35); t += 0.085 / (1 + acc * u); } }
const GONG = [[1, 1, 1], [1.48, 0.5, 1.3], [2.0, 0.35, 1.7], [2.63, 0.2, 2.3], [3.2, 0.12, 3]]; // 銅鑼に近い、ずれた倍音

// A 重厚：ティンパニ・銅鑼・低い金管
const HEAVY = {
  land: () => { const b = buf(2.2); thump(b, 0, 1.3, 140, 32, 5, 0.4, 1.4); boom(b, 0, 0.9, 2.0); noise(b, 0, 0.35, 0.7, { hi0: 700, dec: 11 });
    [233, 350, 467].forEach((f, i) => sine(b, 0.004, 0.4, f, f * 0.995, 0.12, { dec: 12 + i * 4, pan: i % 2 ? 0.3 : -0.3 })); noise(b, 0.03, 0.8, 0.14, { hi0: 2200, lo0: 600, dec: 6 }); reverb(b, 0.45, 0.86); return fin(b, 0.95, 1.15, 4400); },
  open3: () => { const b = buf(2.8); clack(b, 0, 0.5); thump(b, 0, 1.1, 120, 36, 6, 0.3, 1); boom(b, 0, 0.6, 1.4);
    saws(b, 0, 0.9, [26, 38, 45, 50, 54], 0.1, { cut0: 500, cut1: 2000, ct: 0.2, rel: 0.8, vib: 0.05 });
    [62, 66, 69, 74].forEach((m, i) => mallet(b, 0.03 + i * 0.08, m, 0.28, i % 2 ? 0.35 : -0.35, { dec: 2.4, len: 2 })); reverb(b, 0.5, 0.86); return fin(b, 0.84, 1.08, 4600); },
  open4: () => heavyFan(false), open5: () => heavyFan(true),
  slam: () => { const b = buf(1.6); thump(b, 0, 1.2, 150, 38, 7, 0.4, 0.9); boom(b, 0, 0.8, 1.6); saws(b, 0, 0.3, [26, 38, 45, 50], 0.2, { cut0: 2200, cut1: 350, rel: 0.35 });
    mallet(b, 0, 38, 0.45, 0, { parts: GONG, dec: 1.2, len: 1.5, thud: 0 }); reverb(b, 0.4); return fin(b, 0.88, 1.15, 4200); },
  star: () => { const b = buf(1.0); mallet(b, 0, 66, 0.6, 0, { dec: 3, len: 1 }); reverb(b, 0.3); return fin(b, 0.45, 1.0, 3400); },
  new: () => { const b = buf(1.1); mallet(b, 0, 69, 0.45, -0.2, { dec: 3, len: 1 }); mallet(b, 0.08, 74, 0.45, 0.2, { dec: 2.8, len: 1 }); reverb(b, 0.35); return fin(b, 0.5, 1.0, 4600); },
  done: () => { const b = buf(2.2); [62, 66, 69, 74].forEach((m, i) => mallet(b, i * 0.05, m, 0.36, i % 2 ? 0.3 : -0.3, { dec: 2.2, len: 2 }));
    saws(b, 0, 0.6, [38, 50, 57, 62], 0.045, { cut0: 1600, cut1: 600, att: 0.04, rel: 0.9 }); reverb(b, 0.45); return fin(b, 0.55, 1.0, 4400); },
  hold: () => heavyHold(1), hold_f: () => heavyHold(0.5),
};
function heavyCharge(k, d) {
  const b = buf(d + 0.012), base = [38, 42, 45, 50, 54][k];
  roll(b, 0, d, base, 0.5);
  saws(b, 0, d, [base, base + 7, base + 12], 0.12, { cut0: 250, cut1: 1800, g0: 0, g1: 5, att: 0.03, rel: 0.008, swell: 1.3, vib: 0.05 });
  sine(b, 0, d, mtof(base - 12), mtof(base - 7), 0.2, { shape: (u) => u });
  noise(b, 0, d, 0.15, { hi0: 400, hi1: 1800, lo0: 200, lo1: 800, shape: (u) => u * u });
  return fin(b, 0.55 + 0.05 * k, 1.05, 4200);
}
function heavyPromote(root, j) {
  const lv = j + 2, b = buf(2.2); let t0 = 0;
  if (lv === 5) { for (let i = 0; i < 5; i++) thump(b, i * 0.026, 0.4, 90, 45, 18, 0.2, 0.1); t0 = 0.15; } // 割り込み：低い鼓動の乱打
  boom(b, t0, 0.45 + 0.1 * j, 1.8); thump(b, t0, 0.9, 120, 40, 7, 0.3, 0.8);
  saws(b, t0, 0.4, [root - 36, root - 24, root - 17, root - 12], 0.12, { cut0: 2200, cut1: 380, rel: 0.5 });
  mallet(b, t0, root - 24, 0.5, 0, { parts: GONG, dec: 1.1, len: 1.8, thud: 0 });
  mallet(b, t0 + 0.01, root, 0.4, 0, { dec: 2.4, len: 1.6 }); mallet(b, t0 + 0.02, root + 7, 0.22, 0.3, { dec: 2.8, len: 1.4 });
  reverb(b, 0.5, 0.86); return fin(b, 0.7 + 0.07 * j, 1.1, 4400);
}
function heavyFan(buddy) {
  const b = buf(5.0);
  boom(b, 0, 1.3, 3.8); thump(b, 0, 1.0, 110, 34, 4, 0.4, 1.6);
  mallet(b, 0, 38, 0.55, 0, { parts: GONG, dec: 0.7, len: 4.2, att: 0.01, thud: 0 });
  noise(b, 0, 2.4, 0.1, { hi0: 4000, hi1: 1800, lo0: 1200, lo1: 600, dec: 1.6 });
  saws(b, 0, 2.4, buddy ? [26, 38, 45, 50, 57, 61, 64] : [26, 38, 45, 50, 54, 57], 0.11, { cut0: 400, cut1: 2200, ct: 0.4, att: 0.02, rel: 1.8, vib: 0.06 });
  saws(b, 0.15, 2.6, buddy ? [50, 57, 61, 66] : [50, 57, 62, 66], 0.04, { cut0: 700, cut1: 1300, att: 0.4, rel: 1.8, vib: 0.1 });
  const arp = buddy ? [62, 64, 66, 69, 73, 74, 76, 78, 81] : [62, 66, 69, 74, 78, 81], step = buddy ? 0.065 : 0.08;
  arp.forEach((m, i) => mallet(b, 0.45 + i * step, m, 0.26, i % 2 ? 0.4 : -0.4, { dec: 2, len: 2.2 }));
  reverb(b, 0.65, 0.88); return fin(b, 0.97, 1.15, 4800);
}
function heavyHold(s) {
  const b = buf(0.62 * s);
  thump(b, 0.03 * s, 1.0, 60, 34, 11, 0.1, 0.32); thump(b, 0.19 * s, 0.75, 56, 32, 12, 0.1, 0.32);
  sine(b, 0.1 * s, 0.5 * s, 40, 90, 0.3, { shape: (u) => u ** 2 });
  noise(b, 0.12 * s, 0.47 * s, 0.35, { hi0: 300, hi1: 1600, lo0: 150, lo1: 600, shape: (u) => u ** 3 });
  for (let i = 0, tt = 0.05; tt < 0.585; i++) { thump(b, tt * s, 0.12 + 0.35 * (tt / 0.6) ** 2, 90, 60, 30, 0.3, 0.05); tt += 0.06 - 0.036 * (tt / 0.6); }
  return fin(b, 0.68, 1.0, 3800);
}
CHARGE.forEach((d, k) => { HEAVY['charge' + k] = () => heavyCharge(k, d); HEAVY['charge' + k + '_f'] = () => heavyCharge(k, d / 2); });
PROMO.forEach((root, j) => { HEAVY['promote' + (j + 2)] = () => heavyPromote(root, j); });

// B 深い電子音：808系の重低音・シンセの和音と上昇音
const DEEP = {
  land: () => { const b = buf(1.4); sub808(b, 0, 0.95, 160, 40, 1.2, 2.4, 22); noise(b, 0, 0.05, 0.5, { hi0: 3000, lo0: 800, dec: 60 }); noise(b, 0, 0.4, 0.25, { hi0: 900, dec: 9 }); reverb(b, 0.25); return fin(b, 0.95, 1.0, 5000); },
  land_s: () => { const b = buf(0.6); sub808(b, 0, 0.8, 150, 48, 0.5, 2.2, 26); noise(b, 0, 0.04, 0.4, { hi0: 2600, lo0: 700, dec: 70 }); return fin(b, 0.62, 1.0, 4600); },
  open3: () => { const b = buf(2.4); clack(b, 0, 0.45); sub808(b, 0, 0.8, 140, 40, 1.4, 2.6);
    saws(b, 0, 0.9, [50, 57, 62, 66, 69], 0.08, { cut0: 300, cut1: 2600, ct: 0.25, rel: 0.8 });
    [74, 78, 81, 86].forEach((m, i) => pluck(b, 0.05 + i * 0.06, m, 0.3, i % 2 ? 0.4 : -0.4, 0.5, 0.7)); reverb(b, 0.4); return fin(b, 0.84, 1.05, 6000); },
  open4: () => deepDrop(false), open5: () => deepDrop(true),
  slam: () => { const b = buf(1.2); sub808(b, 0, 1, 180, 42, 0.9, 3); saws(b, 0, 0.25, [38, 50, 57], 0.16, { cut0: 2600, cut1: 300, rel: 0.25 }); noise(b, 0, 0.03, 0.5, { hi0: 3000, lo0: 800, dec: 80 }); reverb(b, 0.3); return fin(b, 0.88, 1.05, 5500); },
  star: () => { const b = buf(0.8); pluck(b, 0, 78, 0.55, 0, 0.6, 0.7); sine(b, 0, 0.5, mtof(66), mtof(66), 0.25, { dec: 7 }); reverb(b, 0.3); return fin(b, 0.45, 1.0, 4200); },
  new: () => { const b = buf(0.9); pluck(b, 0, 81, 0.45, -0.2, 0.6, 0.7); pluck(b, 0.07, 86, 0.45, 0.2, 0.6, 0.7); reverb(b, 0.35); return fin(b, 0.5, 1.0, 5600); },
  pop: () => { const b = buf(0.3); sine(b, 0, 0.25, mtof(55) * 1.5, mtof(55), 0.6, { dec: 16 }); pluck(b, 0, 55, 0.3, 0, 0.25, 0.4); return fin(b, 0.5, 1.0, 3000); },
  pop_r: () => { const b = buf(0.4); sine(b, 0, 0.3, mtof(60) * 1.5, mtof(60), 0.6, { dec: 13 }); pluck(b, 0, 60, 0.35, 0, 0.3, 0.55); reverb(b, 0.2); return fin(b, 0.55, 1.0, 3200); },
  tile: () => { const b = buf(0.2); sine(b, 0, 0.18, mtof(62) * 1.4, mtof(62), 0.6, { dec: 22 }); return fin(b, 0.3, 1.0, 3000); },
  done: () => { const b = buf(2.0); [74, 78, 81, 86].forEach((m, i) => pluck(b, i * 0.05, m, 0.36, i % 2 ? 0.3 : -0.3, 0.8, 0.6));
    saws(b, 0, 0.7, [50, 62, 66, 69], 0.04, { cut0: 400, cut1: 1600, att: 0.05, rel: 0.9 }); sub808(b, 0, 0.4, 90, 37, 1.0, 1.8); reverb(b, 0.45); return fin(b, 0.55, 1.0, 5600); },
  hold: () => deepHold(1), hold_f: () => deepHold(0.5),
};
function deepCharge(k, d) {
  const b = buf(d + 0.012), base = [50, 54, 57, 62, 66][k];
  sine(b, 0, d, mtof(base - 24), mtof(base - 12), 0.35, { shape: (u) => u });
  saws(b, 0, d, [base - 12, base, base + 7], 0.12, { cut0: 200, cut1: 3000, g0: 0, g1: 12, att: 0.02, rel: 0.008, trem0: 4, trem1: 16, tremD: 0.55, swell: 1.2 });
  noise(b, 0, d, 0.22, { hi0: 300, hi1: 4000, lo0: 200, lo1: 2000, shape: (u) => u ** 3 });
  return fin(b, 0.55 + 0.04 * k, 1.1, 5600);
}
function deepPromote(root, j) {
  const lv = j + 2, b = buf(1.8); let t0 = 0;
  if (lv === 5) { for (let i = 0; i < 6; i++) saws(b, i * 0.025, 0.014, [root - 12, root], 0.12, { cut0: 1800, rel: 0.004 }); t0 = 0.15; } // 割り込み：和音を細かく刻む
  sub808(b, t0, 0.8, 220, 55, 0.9, 2.5);
  saws(b, t0, 0.3, [root - 12, root - 5, root, root + 4], 0.1, { cut0: 3200, cut1: 400, rel: 0.3 });
  pluck(b, t0, root + 12, 0.35, 0, 0.7, 0.8);
  [0, 4, 7].forEach((st, i) => pluck(b, t0 + 0.08 + i * 0.06, root + 12 + st, 0.14, i % 2 ? 0.5 : -0.5, 0.5, 0.7));
  reverb(b, 0.35); return fin(b, 0.7 + 0.07 * j, 1.1, 6000);
}
function deepDrop(buddy) {
  const b = buf(4.6);
  sub808(b, 0, 1.0, 120, 32, 3.2, 3, 10);
  noise(b, 0, 1.6, 0.2, { hi0: 6000, hi1: 300, lo0: 1500, lo1: 100, dec: 1.2 }); // 下がっていく風
  saws(b, 0, 2.4, buddy ? [50, 57, 61, 64, 69, 73] : [50, 57, 62, 66, 69, 74], 0.07, { cut0: 350, cut1: 3600, ct: 0.6, att: 0.01, rel: 1.6 });
  saws(b, 0, 2.4, [26, 38], 0.1, { cut0: 200, cut1: 600, rel: 1.2 });
  const arp = buddy ? [74, 76, 78, 81, 85, 86, 88, 90] : [74, 78, 81, 86, 90], step = buddy ? 0.055 : 0.065;
  arp.forEach((m, i) => pluck(b, 0.35 + i * step, m, 0.28 - 0.01 * i, i % 2 ? 0.45 : -0.45, 0.8, 0.8));
  reverb(b, 0.55); return fin(b, 0.97, 1.15, 6400);
}
function deepHold(s) {
  const b = buf(0.62 * s);
  sine(b, 0, 0.6 * s, 40, 110, 0.4, { shape: (u) => u });
  saws(b, 0, 0.58 * s, [38, 50], 0.12, { cut0: 200, cut1: 2000, trem0: 8, trem1: 30, tremD: 0.7, swell: 1.5 });
  for (let i = 0, tt = 0.05; tt < 0.585; i++) { noise(b, tt * s, 0.025, 0.1 + 0.35 * (tt / 0.6) ** 2, { hi0: 2600, lo0: 800, dec: 80, pan: i % 2 ? 0.3 : -0.3 }); tt += 0.06 - 0.036 * (tt / 0.6); }
  return fin(b, 0.68, 1.05, 5000);
}
CHARGE.forEach((d, k) => { DEEP['charge' + k] = () => deepCharge(k, d); DEEP['charge' + k + '_f'] = () => deepCharge(k, d / 2); });
PROMO.forEach((root, j) => { DEEP['promote' + (j + 2)] = () => deepPromote(root, j); });


/* ── 2026-11-11 本人指摘「電子オルガンみたいな音の質を変えたい。低さは悪くない」への作り直し ──
   原因：整数比の倍音を足した打鍵音（mallet）と、こもらせた鋸波の和音（saws）が、持続する整った倍音＝オルガンの音色になっていた。
   重厚（heavy）も、待機中のうなり・溜め・昇格・ファンファーレの芯はこの2つのままだった。
   方針：低さは保ち、音の「材質」を変える。
     - 鋸波の和音と打鍵音を使わない。音程感は、太鼓の膜・金属板・低い鐘の「ずれた倍音」（モード合成）と、ノイズを共鳴させた和音で出す
     - 打撃は叩いた瞬間に少し音程が落ち、毎回少しずつ揺らぐ。皮や金属をこする瞬間のノイズを入れる
     - 残響は拡散を増やして、くし形の鳴き（金属的な響き）を抑える */

// 共鳴フィルター（状態変数型）にノイズを通す。中心 f0→f1、鋭さ q。音程のある「息」「うなり」「風」になる
function reso(b, t0, dur, f0, f1, q, amp, o = {}) {
  const { att = 0.005, dec = 0, pan = 0, shape, drive = 0 } = o;
  const [i0, n] = span(b, t0, dur), [gl, gr] = pg(pan), q1 = 1 / q, kd = drive ? Math.tanh(drive) : 1; let lo = 0, bd = 0, e = 1; const ke = Math.exp(-dec / SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = i / n, fc = Math.min(f0 * (f1 / f0) ** u, SR / 7), F = 2 * Math.sin(Math.PI * fc / SR);
    lo += F * bd; const hi = rnd() - lo - q1 * bd; bd += F * hi;
    let s = bd / Math.sqrt(q * fc * 2 / SR) * 1.6; if (drive) s = Math.tanh(s * drive) / kd;
    s *= amp * Math.min(1, t / att) * e * Math.min(1, (dur - t) * 200) * (shape ? shape(u) : 1); e *= ke;
    b[0][i0 + i] += s * gl; b[1][i0 + i] += s * gr;
  }
}
// モード合成：[倍音の比, 強さ, 減衰の速さ(1/秒)]。各倍音を左右に少しずらして2本鳴らし、うなりと広がりを出す。
// glide は叩いた直後の音程の上ずり（太鼓の皮）。hi を超える倍音は鳴らさない
function modal(b, t0, f, amp, modes, o = {}) {
  const { len = 1.5, pan = 0, spread = 0.003, glide = 0, gT = 0.035, hi = 4200, ex = 0.25, exHi = 3000, dmul = 1, width = 0.3, att = 0.0012 } = o;
  const [i0, n] = span(b, t0, len), gk = glide ? Math.exp(-1 / (gT * SR)) : 0;
  for (const [r, a, d] of modes) {
    const fr = f * r; if (fr > hi) continue;
    for (const side of [-1, 1]) {
      const w = TAU * fr * (1 + side * spread * (0.6 + 0.4 * rnd())) / SR, [gl, gr] = pg(pan + side * width * Math.min(1, r / 2)), ka = Math.exp(-d * dmul / SR), A = a * 0.5 * (1 + 0.12 * rnd()) * amp;
      let ph = Math.PI * (rnd() + 1), e = 1, g = glide;
      for (let i = 0; i < n; i++) { ph += w * (1 + g); g *= gk; const t = i / SR, s = Math.sin(ph) * A * e * Math.min(1, t / att) * Math.min(1, (len - t) * 20); e *= ka; b[0][i0 + i] += s * gl; b[1][i0 + i] += s * gr; }
    }
  }
  if (ex) noise(b, t0, 0.014, amp * ex, { hi0: Math.min(exHi, f * 8), lo0: Math.min(300, f), dec: 240, pan });
}
const MEMBRANE = [[1, 1, 7], [1.59, 0.55, 11], [2.14, 0.4, 15], [2.3, 0.3, 17], [2.65, 0.22, 21], [2.92, 0.16, 25], [3.16, 0.12, 30], [3.5, 0.08, 34]]; // 太鼓の皮
const PLATE = [[1, 1, 2.2], [1.47, 0.8, 2.8], [1.94, 0.62, 3.4], [2.43, 0.5, 4], [2.89, 0.4, 4.8], [3.42, 0.3, 5.6], [4.02, 0.24, 6.6], [4.71, 0.18, 7.6], [5.33, 0.14, 8.8], [6.1, 0.1, 10]]; // 厚い金属板（船体・ポッドの外殻）
const BELL = [[0.5, 0.7, 0.9], [1, 1, 1.3], [1.19, 0.6, 1.6], [1.5, 0.45, 2], [2.0, 0.5, 2.4], [2.51, 0.3, 3], [2.66, 0.25, 3.4], [3.01, 0.15, 4]]; // 低い鐘（短三度を含む、ずれた倍音）
const WOOD = [[1, 1, 40], [2.57, 0.45, 70], [4.4, 0.2, 110]]; // 木の札・留め金の小さな打音
// 和太鼓に近い打撃：皮のモード＋胴の低音＋皮を打つ音
function taiko(b, t0, f, amp, o = {}) {
  const { len = 1.2, pan = 0, slap = 0.5 } = o;
  modal(b, t0, f, amp, MEMBRANE, { len, pan, glide: 0.4, gT: 0.03, spread: 0.004, ex: 0, width: 0.15 });
  thump(b, t0, amp * 0.6, f * 2.2, f * 0.8, 9, 0.08, Math.min(len, 0.8));
  reso(b, t0, 0.1, 1300, 650, 1.3, amp * slap, { dec: 42, pan });
}
// 重い金属の衝撃（外殻が鳴る）
const clang = (b, t0, f, amp, o = {}) => modal(b, t0, f, amp, PLATE, { len: 1.6, spread: 0.006, ex: 0.5, exHi: 3200, width: 0.5, ...o });
// 破片・小石：小さな金属片の打音を散らす
function debris(b, t0, dur, n, amp) { for (let i = 0; i < n; i++) { const tt = t0 + dur * Math.abs(rnd()) ** 1.6; modal(b, tt, 420 + 1300 * Math.abs(rnd()), amp * (0.35 + 0.65 * Math.abs(rnd())), PLATE.slice(0, 4), { len: 0.12, dmul: 14, ex: 0.7, pan: rnd() * 0.7, hi: 3600 }); } }
// 留め金が外れる（蓋の開封）
function latch(b, t0, amp, f = 420) { modal(b, t0, f, amp * 0.6, PLATE, { len: 0.28, dmul: 8, ex: 0.7, hi: 3600 }); modal(b, t0 + 0.004, f * 0.38, amp * 0.6, WOOD, { len: 0.2, ex: 0.3 }); reso(b, t0 + 0.01, 0.25, 2200, 900, 1, amp * 0.25, { dec: 16 }); }
// だんだん速くなる刻み（ラチェット・心拍）。each(t, u) を呼ぶ
function accel(t0, dur, gap0, gap1, each) { for (let t = 0; t < dur - 0.01;) { const u = t / dur; each(t0 + t, u); t += gap0 + (gap1 - gap0) * u; } }
// 拡散を増やした残響（全域通過4段 → くし形8本 → 全域通過2段）。くし形だけの残響より金属的な鳴きが出にくい
function hall(b, wet, size = 1, damp = 0.4, fb = 0.84) {
  const N = b[0].length;
  [0, 1].forEach((c) => {
    let x = Float32Array.from(b[c]);
    for (const base of [142, 107, 379, 277]) { const D = base + c * 7, d = new Float32Array(D); let p = 0; for (let i = 0; i < N; i++) { const q = d[p], v = x[i] + 0.6 * q; d[p] = v; x[i] = q - 0.6 * v; p = (p + 1) % D; } }
    const acc = new Float32Array(N);
    for (const base of [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]) { const D = Math.round(base * size) + c * 23, d = new Float32Array(D); let p = 0, lp = 0;
      for (let i = 0; i < N; i++) { const y = d[p]; lp = y * (1 - damp) + lp * damp; d[p] = x[i] * 0.3 + lp * fb; p = (p + 1) % D; acc[i] += y; } }
    for (const base of [556, 441]) { const D = base + c * 11, d = new Float32Array(D); let p = 0; for (let i = 0; i < N; i++) { const q = d[p], v = acc[i] + 0.5 * q; d[p] = v; acc[i] = q - 0.5 * v; p = (p + 1) % D; } }
    for (let i = 0; i < N; i++) b[c][i] += wet * 0.22 * acc[i];
  });
}
// ノイズを共鳴させた和音（息の混じった合唱・弦に近い。整った倍音の持続音にならない）
function choir(b, t0, dur, midis, amp, o = {}) {
  const { q = 26, att = 0.2, shape, rise = 0 } = o;
  midis.forEach((m, k) => { const f = mtof(m); for (const dv of [-1, 1]) reso(b, t0, dur, f * (1 + dv * 0.004) * 2 ** (-rise / 12), f * (1 + dv * 0.004), q, amp / Math.sqrt(midis.length), { att, pan: (k % 2 ? 0.35 : -0.35) + dv * 0.2, shape }); });
}
// うなり（ノイズを低い音程で共鳴させて歪ませる。映画の「ブォーン」）
const growl = (b, t0, dur, f, amp, o = {}) => { reso(b, t0, dur, f, o.f1 || f, o.q || 10, amp, { drive: o.drive || 3.5, att: o.att || 0.02, dec: o.dec || 0, shape: o.shape }); reso(b, t0, dur, f * 2, (o.f1 || f) * 2, (o.q || 10) * 1.5, amp * 0.35, { drive: 2, att: o.att || 0.02, dec: (o.dec || 0) * 1.3, shape: o.shape }); };

// D 金属と太鼓
const METAL = {
  bed: () => { const b = buf(5.0); const sh = (u) => Math.min(1, u * 12) * Math.min(1, (1 - u) * 4);
    noise(b, 0, 5, 0.7, { hi0: 110, shape: sh }); reso(b, 0, 5, 55, 62, 6, 0.3, { shape: sh }); reso(b, 0, 5, 300, 460, 2, 0.08, { shape: (u) => sh(u) * (0.6 + 0.4 * Math.sin(u * 9)) }); return fin(b, 0.2, 1, 1500); },
  call: () => { const b = buf(1.5); taiko(b, 0, 58, 0.7, { len: 1.1, slap: 0.3 }); clang(b, 0.01, 175, 0.3, { len: 1.1 }); reso(b, 0.03, 0.55, 800, 2000, 1.2, 0.18, { dec: 6 }); hall(b, 0.35); return fin(b, 0.5, 1.05, 4500); },
  slam: () => { const b = buf(1.9); taiko(b, 0, 52, 1.0, { len: 1.4 }); clang(b, 0, 62, 0.6, { len: 1.7 }); boom(b, 0, 0.7, 1.6); reso(b, 0, 1.0, 1000, 500, 0.9, 0.22, { dec: 4 }); hall(b, 0.45, 1.1); return fin(b, 0.9, 1.15, 4200); },
  fall: () => { const b = buf(0.56); reso(b, 0, 0.55, 1500, 240, 5, 0.6, { shape: (u) => u ** 2 }); noise(b, 0, 0.55, 0.5, { hi0: 380, shape: (u) => u ** 2.5 }); return fin(b, 0.7, 1.0, 4000); },
  land: () => { const b = buf(2.3); thump(b, 0, 1.2, 140, 30, 5, 0.3, 1.4); taiko(b, 0, 46, 0.8, { len: 1.3, slap: 0.3 }); clang(b, 0.003, 78, 0.55, { len: 1.9 }); boom(b, 0, 0.8, 2.0); debris(b, 0.02, 0.45, 9, 0.12); hall(b, 0.45, 1.1); return fin(b, 0.95, 1.15, 4300); },
  land_s: () => { const b = buf(0.8); thump(b, 0, 1, 130, 46, 11, 0.3, 0.6); clang(b, 0.002, 150, 0.35, { len: 0.6, dmul: 2 }); debris(b, 0.01, 0.2, 3, 0.1); hall(b, 0.2); return fin(b, 0.62, 1.05, 4400); },
  open0: () => { const b = buf(0.7); latch(b, 0, 0.7); hall(b, 0.2); return fin(b, 0.42, 1.0, 4200); },
  open1: () => { const b = buf(0.8); latch(b, 0, 0.7); taiko(b, 0, 110, 0.35, { len: 0.5, slap: 0.2 }); hall(b, 0.2); return fin(b, 0.46, 1.0, 4400); },
  open2: () => { const b = buf(1.4); latch(b, 0, 0.6); taiko(b, 0, 95, 0.5, { len: 0.7 }); modal(b, 0.02, mtof(57), 0.3, BELL, { len: 1.2, dmul: 1.6 }); hall(b, 0.3); return fin(b, 0.6, 1.0, 4600); },
  open3: () => { const b = buf(2.8); latch(b, 0, 0.5); taiko(b, 0, 70, 0.9, { len: 1.1 }); clang(b, 0.004, 110, 0.4, { len: 1.6 }); boom(b, 0, 0.4, 1.2);
    choir(b, 0.03, 1.4, [50, 57, 62, 66], 0.5, { att: 0.12, shape: (u) => (1 - u) ** 1.5 }); modal(b, 0.02, mtof(62), 0.35, BELL, { len: 2.0, dmul: 1.1 }); hall(b, 0.5, 1.2); return fin(b, 0.84, 1.08, 4600); },
  open4: () => metalFan(false), open5: () => metalFan(true),
  star: () => { const b = buf(0.9); modal(b, 0, mtof(57), 0.6, BELL, { len: 0.9, dmul: 1.8 }); modal(b, 0, mtof(45), 0.25, WOOD, { len: 0.15, ex: 0.3 }); hall(b, 0.3); return fin(b, 0.45, 1.0, 3600); },
  new: () => { const b = buf(1.1); modal(b, 0, mtof(62), 0.45, BELL, { len: 0.9, dmul: 1.7, pan: -0.2 }); modal(b, 0.08, mtof(69), 0.45, BELL, { len: 0.9, dmul: 1.7, pan: 0.2 }); hall(b, 0.3); return fin(b, 0.5, 1.0, 4200); },
  pop: () => { const b = buf(0.4); modal(b, 0, 260, 0.5, PLATE, { len: 0.22, dmul: 9, ex: 0.6, hi: 3000 }); modal(b, 0.003, 130, 0.5, WOOD, { len: 0.2, ex: 0.2 }); reso(b, 0.01, 0.2, 1600, 700, 1, 0.15, { dec: 18 }); return fin(b, 0.5, 1.0, 3000); },
  pop_r: () => { const b = buf(0.7); modal(b, 0, 260, 0.45, PLATE, { len: 0.22, dmul: 9, ex: 0.6, hi: 3000 }); modal(b, 0.003, 130, 0.45, WOOD, { len: 0.2, ex: 0.2 }); modal(b, 0.01, 196, 0.3, BELL, { len: 0.6, dmul: 2.6 }); hall(b, 0.2); return fin(b, 0.55, 1.0, 3200); },
  lock: () => { const b = buf(0.6); latch(b, 0, 0.6, 330); taiko(b, 0, 90, 0.4, { len: 0.4 }); return fin(b, 0.6, 1.0, 4000); },
  whoosh: () => { const b = buf(0.36); reso(b, 0, 0.34, 300, 1400, 1.2, 1, { shape: (u) => Math.sin(Math.PI * u) ** 1.5 }); noise(b, 0, 0.34, 0.4, { hi0: 300, shape: (u) => Math.sin(Math.PI * u) }); return fin(b, 0.4, 1.0, 3500); },
  tile: () => { const b = buf(0.2); modal(b, 0, 220, 0.6, WOOD, { len: 0.18, ex: 0.3 }); return fin(b, 0.3, 1.0, 3000); },
  ui: () => { const b = buf(0.12); modal(b, 0, 330, 0.6, WOOD, { len: 0.1, ex: 0.4 }); return fin(b, 0.25, 1.0, 3600); },
  done: () => { const b = buf(2.2); taiko(b, 0, 80, 0.5, { len: 0.9 }); modal(b, 0.01, mtof(50), 0.4, BELL, { len: 2.0, dmul: 1.0 }); choir(b, 0.02, 1.2, [50, 57, 62], 0.35, { att: 0.08, shape: (u) => (1 - u) ** 1.6 }); hall(b, 0.45, 1.2); return fin(b, 0.55, 1.0, 4200); },
  hold: () => metalHold(1), hold_f: () => metalHold(0.5),
};
function metalCharge(k, d) {
  const b = buf(d + 0.012), base = [38, 42, 45, 50, 54][k], f = mtof(base);
  accel(0, d, 0.09, 0.035, (t, u) => taiko(b, t, f, 0.25 + 0.5 * u * u, { len: 0.25, slap: 0.15 + 0.3 * u })); // 太鼓の連打
  accel(0.02, d, 0.05, 0.02, (t, u) => modal(b, t, 900 + 300 * u, 0.04 + 0.12 * u, WOOD, { len: 0.04, ex: 0.4, pan: u * 0.3 - 0.15 })); // 機械の刻み
  reso(b, 0, d, f, f * 1.5, 8, 0.45, { shape: (u) => u ** 1.5 }); // 共鳴が五度上がっていく
  sine(b, 0, d, f / 2, f * 0.75, 0.18, { shape: (u) => u });
  noise(b, 0, d, 0.15, { hi0: 300, hi1: 1500, lo0: 150, lo1: 600, shape: (u) => u * u });
  return fin(b, 0.55 + 0.05 * k, 1.05, 4200);
}
function metalPromote(root, j) {
  const lv = j + 2, b = buf(2.4); let t0 = 0;
  if (lv === 5) { for (let i = 0; i < 5; i++) modal(b, i * 0.026, 600 + 120 * i, 0.2, PLATE.slice(0, 5), { len: 0.05, dmul: 20, ex: 0.6, pan: i % 2 ? 0.4 : -0.4 }); t0 = 0.15; } // 割り込み：金属の細かい乱打
  taiko(b, t0, mtof(root - 30), 1.0, { len: 1.2 }); clang(b, t0 + 0.004, mtof(root - 24), 0.45, { len: 1.8 }); boom(b, t0, 0.35 + 0.1 * j, 1.6);
  modal(b, t0 + 0.006, mtof(root - 12), 0.55, BELL, { len: 2.0, dmul: 0.9 }); // 段階ごとに音程が上がる低い鐘（レ→ファ♯→ラ→レ）
  choir(b, t0 + 0.02, 0.9, [root - 24, root - 17, root - 12], 0.35, { att: 0.03, shape: (u) => (1 - u) ** 2 });
  hall(b, 0.5, 1.2); return fin(b, 0.7 + 0.07 * j, 1.1, 4400);
}
function metalFan(buddy) {
  const b = buf(5.4);
  taiko(b, 0, 48, 1.1, { len: 1.6 }); clang(b, 0.004, 55, 0.7, { len: 2.8, dmul: 0.6 }); boom(b, 0, 1.2, 3.6); thump(b, 0, 0.8, 110, 30, 4, 0.2, 1.6);
  reso(b, 0, 2.8, 3000, 1600, 0.8, 0.1, { dec: 1.3 }); // 暗い余韻（シンバルの代わり）
  [[0.42, 66, 0.5], [0.56, 66, 0.55], [0.8, 52, 0.85]].forEach(([t, f, a], i) => taiko(b, t, f, a, { len: 1.0, pan: i === 2 ? 0 : i ? 0.3 : -0.3 })); // ドドン、ドン
  modal(b, 0.005, mtof(50), 0.55, BELL, { len: 3.6, dmul: 0.6 }); modal(b, 0.8, mtof(57), 0.4, BELL, { len: 3.0, dmul: 0.7 });
  choir(b, 0.05, 3.0, buddy ? [38, 45, 50, 57, 61, 64, 66] : [38, 45, 50, 54, 57, 62], 0.75, { att: 0.35, shape: (u) => Math.min(1, (1 - u) * 2.2) });
  for (let i = 0; i < (buddy ? 14 : 9); i++) modal(b, 0.6 + 2.2 * Math.abs(rnd()), mtof([69, 74, 78, 81][Math.floor(Math.abs(rnd()) * 3.99)]), 0.06, BELL, { len: 1.0, dmul: 2, pan: rnd() * 0.7 }); // 舞う光の粒（低めの小さな鐘）
  hall(b, 0.6, 1.3); return fin(b, 0.97, 1.15, 4600);
}
function metalHold(s) {
  const b = buf(0.62 * s);
  taiko(b, 0.03 * s, 50, 0.9, { len: 0.35, slap: 0.2 }); taiko(b, 0.19 * s, 46, 0.7, { len: 0.35, slap: 0.15 }); // 鼓動
  reso(b, 0.1 * s, 0.5 * s, 120, 700, 3, 0.5, { shape: (u) => u ** 3 }); noise(b, 0.12 * s, 0.47 * s, 0.3, { hi0: 300, hi1: 1400, shape: (u) => u ** 3 });
  accel(0.05 * s, 0.55 * s, 0.06 * s, 0.022 * s, (t, u) => modal(b, t, 700 + 400 * u, 0.06 + 0.3 * u * u, PLATE.slice(0, 4), { len: 0.05, dmul: 18, ex: 0.5, hi: 3000 }));
  return fin(b, 0.68, 1.0, 3800);
}
CHARGE.forEach((d, k) => { METAL['charge' + k] = () => metalCharge(k, d); METAL['charge' + k + '_f'] = () => metalCharge(k, d / 2); });
PROMO.forEach((root, j) => { METAL['promote' + (j + 2)] = () => metalPromote(root, j); });

// E 映画の衝撃音：D の小さな音を使い、溜め・昇格・開封・待機を「うなり」「上昇音」「重い衝撃」で鳴らす
const CINEMA = {
  ...METAL,
  slam: () => { const b = buf(1.8); thump(b, 0, 1.2, 160, 32, 6, 0.4, 1.2); boom(b, 0, 0.9, 1.7); clang(b, 0, 60, 0.35, { len: 1.4 }); growl(b, 0, 0.9, 55, 0.5, { dec: 4, f1: 49 }); reso(b, 0, 0.6, 1200, 400, 0.8, 0.25, { dec: 6 }); hall(b, 0.4, 1.1); return fin(b, 0.9, 1.15, 4200); },
  open3: () => { const b = buf(2.6); latch(b, 0, 0.5); thump(b, 0, 1.1, 150, 34, 6, 0.3, 1.0); boom(b, 0, 0.6, 1.4); growl(b, 0, 1.0, mtof(38), 0.4, { dec: 3 });
    choir(b, 0.02, 1.4, [50, 57, 62, 66], 0.5, { att: 0.08, shape: (u) => (1 - u) ** 1.5 }); hall(b, 0.5, 1.2); return fin(b, 0.84, 1.08, 4600); },
  open4: () => cineFan(false), open5: () => cineFan(true),
  hold: () => cineHold(1), hold_f: () => cineHold(0.5),
};
function cineCharge(k, d) {
  const b = buf(d + 0.012), base = [38, 42, 45, 50, 54][k], f = mtof(base);
  thump(b, 0, 0.5, 90, 40, 14, 0.05, 0.25); // 頭に一拍
  growl(b, 0, d, f / 2, 0.35, { f1: f / 2 * 1.5, att: 0.03, shape: (u) => u ** 1.3 }); // 低いうなりが五度上がる
  reso(b, 0, d, 200 + 60 * k, 1400 + 200 * k, 3, 0.5, { shape: (u) => u ** 2.2 }); // 上昇音
  noise(b, 0, d, 0.3, { hi0: 300, hi1: 2200, lo0: 150, lo1: 900, shape: (u) => u ** 3 }); // 逆再生のシンバルのような膨らみ
  sine(b, 0, d, f / 2, f, 0.15, { shape: (u) => u });
  return fin(b, 0.55 + 0.05 * k, 1.05, 4200);
}
function cinePromote(root, j) {
  const lv = j + 2, b = buf(2.2); let t0 = 0;
  if (lv === 5) { for (let i = 0; i < 6; i++) reso(b, i * 0.024, 0.016, 900, 900, 3, 0.4, { pan: i % 2 ? 0.4 : -0.4 }); t0 = 0.15; } // 割り込み：通信の乱れ
  thump(b, t0, 1.1, 170, 36, 7, 0.3, 0.9); boom(b, t0, 0.5 + 0.1 * j, 1.8); clang(b, t0 + 0.004, mtof(root - 24), 0.3, { len: 1.3 });
  growl(b, t0, 1.1, mtof(root - 36), 0.55, { dec: 2.4, att: 0.008, drive: 4 }); growl(b, t0, 1.1, mtof(root - 29), 0.3, { dec: 2.8, att: 0.008, drive: 3 }); // 「ブォーン」：段階ごとに音程が上がる
  reso(b, t0, 0.7, 2400, 600, 1, 0.2, { dec: 5 }); // 衝撃のあとに落ちる風
  hall(b, 0.45, 1.2); return fin(b, 0.7 + 0.07 * j, 1.1, 4400);
}
function cineFan(buddy) {
  const b = buf(5.2);
  thump(b, 0, 1.2, 150, 28, 4, 0.4, 1.8); boom(b, 0, 1.4, 4.0); taiko(b, 0, 46, 0.8, { len: 1.5 }); clang(b, 0.004, 52, 0.5, { len: 2.4, dmul: 0.7 });
  growl(b, 0, 3.0, mtof(26), 0.6, { dec: 0.9, att: 0.01, drive: 4 }); growl(b, 0, 3.0, mtof(33), 0.35, { dec: 1.0, att: 0.01, drive: 3 });
  reso(b, 0, 2.4, 2600, 300, 0.9, 0.25, { dec: 1.2 }); // 下がっていく風
  [[0.5, 60, 0.6], [0.66, 60, 0.65], [0.9, 48, 0.9]].forEach(([t, f, a], i) => taiko(b, t, f, a, { len: 1.0, pan: i === 2 ? 0 : i ? 0.3 : -0.3 }));
  choir(b, 0.1, 3.2, buddy ? [38, 45, 50, 57, 61, 64, 69] : [38, 45, 50, 54, 57, 62], 0.85, { att: 0.5, rise: 2, shape: (u) => Math.min(1, (1 - u) * 2.2) }); // 少し下から持ち上がる和音
  reso(b, 0.3, 2.6, 900, 1800, 6, 0.12, { att: 0.4, shape: (u) => Math.sin(Math.PI * u) }); // 高すぎない、きらめきの代わりの風
  hall(b, 0.6, 1.35); return fin(b, 0.97, 1.15, 4600);
}
function cineHold(s) {
  const b = buf(0.62 * s);
  thump(b, 0.03 * s, 1.0, 64, 32, 11, 0.05, 0.32); thump(b, 0.19 * s, 0.8, 58, 30, 12, 0.05, 0.32);
  growl(b, 0.05 * s, 0.57 * s, 41, 0.4, { f1: 82, att: 0.05, shape: (u) => u ** 2 });
  reso(b, 0.08 * s, 0.54 * s, 150, 1600, 2.5, 0.55, { shape: (u) => u ** 3 }); // 吸い込む上昇音
  return fin(b, 0.68, 1.0, 3800);
}
CHARGE.forEach((d, k) => { CINEMA['charge' + k] = () => cineCharge(k, d); CINEMA['charge' + k + '_f'] = () => cineCharge(k, d / 2); });
PROMO.forEach((root, j) => { CINEMA['promote' + (j + 2)] = () => cinePromote(root, j); });

// 採用版（2026-11-11 本人指定「開封はAでそれ以外はEで」）：ポッドが開く瞬間の音だけ重厚（A）、それ以外は映画の衝撃音（E）。
// 10連の通常箱（pop・pop_r）は本人の追加指示により鍵が外れる実録へ差替え。
const OPEN_IDS = ['open0', 'open1', 'open2', 'open3', 'open4', 'open5', 'pop', 'pop_r'];
const ADOPT = { ...CINEMA, ...Object.fromEntries(OPEN_IDS.map((id) => [id, HEAVY[id] || DEF[id]])),
  pop: () => fin(crateOpen(0), 0.49, 1.0, 6000),
  pop_r: () => fin(crateOpen(1), 0.5, 1.0, 6000),
};
const STYLES = { balance: {}, heavy: HEAVY, deep: DEEP, metal: METAL, cinema: CINEMA, adopt: ADOPT };
export const STYLE_NAMES = { balance: '標準（打鍵音＋金管）', heavy: '重厚（ティンパニ・銅鑼・低い金管）', deep: '深い電子音（808系の重低音・シンセ）', metal: '金属と太鼓（膜・金属板・低い鐘）', cinema: '映画の衝撃音（うなり・上昇音・重い衝撃）', adopt: '採用版（開封は重厚、それ以外は映画の衝撃音）' };
// 既定は採用版（2026-11-11）。以前の既定は重厚
export const DEFAULT_STYLE = 'adopt';
let style = DEFAULT_STYLE;
export function setStyle(s) { if (!STYLES[s]) throw new Error('音の傾向は ' + Object.keys(STYLES).join(' / ')); style = s; }

export const IDS = Object.keys(DEF);
const cache = new Map();
export function render(id, st = style) { const key = st + ':' + id; if (!cache.has(key)) { _s = 7 + [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 0) % 100000; cache.set(key, (STYLES[st][id] || DEF[id])()); } return cache.get(key); }
// 2倍速のときに鳴らす音：溜めと開封前の溜めは短い版に替える。他はそのまま
export const fastId = (id) => (DEF[id + '_f'] ? id + '_f' : id);

// 動画用：合図の一覧を1本の波形に混ぜる。cue = { t, id, vol, pan, rate }
export function mix(cues, dur) {
  const N = Math.ceil(dur * SR), L = new Float32Array(N), R = new Float32Array(N);
  for (const c of cues) {
    const [l, r] = render(c.id), [gl, gr] = pg(c.pan || 0), v = (c.vol ?? 1) * 1.414, rate = c.rate || 1, i0 = Math.round(c.t * SR), n = Math.floor(l.length / rate);
    for (let i = 0; i < n && i0 + i < N; i++) { const x = i * rate, j = x | 0, f = x - j, a = l[j] + ((l[j + 1] || 0) - l[j]) * f, bb = r[j] + ((r[j + 1] || 0) - r[j]) * f; if (i0 + i >= 0) { L[i0 + i] += a * v * gl; R[i0 + i] += bb * v * gr; } }
  }
  let hl = 0, hr = 0; const hp = lpA(26); // 聞こえない超低域を落としてから、やわらかく頭を抑える
  for (let i = 0; i < N; i++) { hl += hp * (L[i] - hl); hr += hp * (R[i] - hr); L[i] = Math.tanh((L[i] - hl) * 0.9); R[i] = Math.tanh((R[i] - hr) * 0.9); }
  return [L, R];
}

// ブラウザ用：最初の操作で音を有効にし、合図ごとに鳴らす
export function createPlayer(st = DEFAULT_STYLE) {
  if (!STYLES[st]) st = DEFAULT_STYLE;
  let ctx = null, out = null, muted = false, worker = null, volume = 1; const bufs = new Map(), raw = new Map();
  const get = (id) => { if (!bufs.has(id)) { const [l, r] = raw.get(id) || render(id, st), ab = ctx.createBuffer(2, l.length, SR); ab.copyToChannel(l, 0); ab.copyToChannel(r, 1); bufs.set(id, ab); } return bufs.get(id); };
  return {
    // 波形の計算は重い音で約1秒かかる。演出の途中で画面が止まらないよう、入口を開いた時点で別スレッドに計算させておく。
    // 別スレッドが使えない、または間に合わなかった音だけ、鳴らす時にその場で計算する
    warm() { if (worker || typeof Worker === 'undefined') return; try { worker = new Worker(new URL('./sfx-worker.js', import.meta.url), { type: 'module' }); worker.onmessage = (e) => { if (e.data.done) worker.terminate(); else raw.set(e.data.id, [e.data.l, e.data.r]); }; worker.onerror = () => {}; worker.postMessage(st); } catch { worker = null; } },
    get warmed() { return raw.size; },
    unlock() { if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; ctx = new AC(); const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2; out = ctx.createGain(); out.gain.value = 0.9 * volume; out.connect(comp); comp.connect(ctx.destination); } if (ctx.state === 'suspended') ctx.resume(); return true; },
    async prime(ids = IDS) { if (!ctx) return; for (const id of ids) { if (raw.has(id)) get(id); await new Promise((r) => setTimeout(r, 0)); } },
    play(c) { if (!ctx || muted || !DEF[c.id]) return; const s = ctx.createBufferSource(); s.buffer = get(c.id); s.playbackRate.value = c.rate || 1; const g = ctx.createGain(); g.gain.value = c.vol ?? 1; let node = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = c.pan || 0; g.connect(p); node = p; } s.connect(g); node.connect(out); s.start(); },
    setMuted(v) { muted = !!v; }, get muted() { return muted; }, get ready() { return !!ctx; },
    setVolume(v) { volume = Math.max(0, Math.min(1, Number(v) || 0)); if (out) out.gain.value = 0.9 * volume; },
    dispose() { worker?.terminate(); worker = null; out?.disconnect(); if (ctx) void ctx.close().catch(() => {}); ctx = out = null; bufs.clear(); raw.clear(); },
  };
}
