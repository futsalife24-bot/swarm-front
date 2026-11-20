/*
 * SUPPLY REVEAL — 配布券（仮）1連・10連の表示専用モジュール
 *
 * - 入力：確定済みの結果配列（1件または10件）。抽選・確率・券・天井・保存の判断はしない。結果も書き換えない。
 * - 方式：時刻 t だけで1コマが決まる frameState(m, t) と、DOMへの反映 apply() の2段構成。
 *   早送り・スキップ・中断・検証シークは t の操作だけで行う（Yebisuガイドの seek(t) の原則を独自に実装）。
 * - 予兆は「下限」だけを示し、入力結果の最高段階を超えない（audit() で全コマを検査）。
 * - 停止点（SSR・バディのカットイン完成と最後）では最低0.5秒止め、1コマで素通りさせない。
 * - 再生ループは世代番号で常に1本。
 *
 * 旧試作 task-pleat-lightweight/prototypes/gacha-reveal（2026-11-08）の時間軸・検査・操作を継承し、
 * 中立ポッド素材（supply-pod-neutral-v1）を使った投下・開封、HUD、カード、カットイン、一覧を作り直した。
 */

export const TIER_NAME = ['武装片', 'N', 'R', 'SR', 'SSR', 'バディ'];
const TIER_KEY = ['shard', 'n', 'r', 'sr', 'ssr', 'buddy'];
const TIER_VAR = ['var(--sr-t0)', 'var(--sr-t1)', 'var(--sr-t2)', 'var(--sr-t3)', 'var(--sr-t4)', 'var(--sr-t5)'];
const LAMP_NEUTRAL = 'var(--sr-lamp)';
const BADGE = { 3: 'SR以上の反応', 4: 'SSR以上の反応', 5: 'バディ反応' };
export const MIN_HOLD_MS = 500; // 停止点では最低これだけ見せてから次のタップを受け付ける
export const TAP_GAP_MS = 120; // 連打の間引き

/* ── イージング（モーションリファレンス各例の指定名に対応） ── */
const E = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - (1 - x) ** 3,
  outQuart: (x) => 1 - (1 - x) ** 4,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  outBack: (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2,
  outExpo: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  spring: (x) => 1 - Math.exp(-7 * x) * Math.cos(14 * x),
  outBounce: (x) => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  },
};
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (t, a, b, e) => {
  const p = clamp01((t - a) / (b - a || 1e-9));
  return e ? e(p) : p;
};

/* ── 入力 ── */
export function tierOf(r) {
  if (r.type === 'buddy') return 5;
  if (r.type === 'shard') return 0;
  return { N: 1, R: 2, SR: 3, SSR: 4 }[r.rarity];
}
export function validate(arr) {
  if (!Array.isArray(arr)) throw new Error('配列ではありません');
  if (arr.length !== 1 && arr.length !== 10) throw new Error('件数は1件または10件です');
  arr.forEach((r, i) => {
    const at = `${i + 1}件目：`;
    if (!r || typeof r !== 'object') throw new Error(at + '形式が不正です');
    if (!['weapon', 'shard', 'buddy'].includes(r.type)) throw new Error(at + 'type は weapon / shard / buddy');
    if (r.type === 'weapon' && r.rarity === 'LR') throw new Error(at + 'LRは対象外です');
    if (r.type === 'weapon' && !['N', 'R', 'SR', 'SSR'].includes(r.rarity)) throw new Error(at + 'rarity は N / R / SR / SSR');
    if (r.type !== 'shard' && !(typeof r.name === 'string' && r.name.trim())) throw new Error(at + 'name が必要です');
    if (r.type === 'shard' && !(Number.isInteger(r.amount) && r.amount > 0)) throw new Error(at + 'amount は正の整数');
  });
  return Object.freeze(arr.map((r) => Object.freeze({ ...r })));
}
// 武装片は段階表示（チップ）と名前が重複するため、名前側に数量を出し、種別は「素材」とする
const nameOf = (r) => (r.type === 'shard' ? `武装片 ×${r.amount}` : r.name);
const subOf = (r) => (r.type === 'shard' ? '素材' : r.type === 'buddy' ? 'バディ' : '武器');
const starCount = (tier) => (tier === 5 ? 5 : tier);

/* ── 確認用プリセット（仮の確定済み結果。確率や排出内容を示すものではない） ── */
const W = (rarity, name, extra) => ({ type: 'weapon', rarity, name, ...extra });
const S = (amount) => ({ type: 'shard', amount });
const B = (name, extra) => ({ type: 'buddy', name, ...extra });
export const PRESETS1 = {
  '武装片': [S(30)],
  'N武器': [W('N', 'ハンドガン（仮）')],
  'R武器': [W('R', 'アサルトライフル（仮）')],
  'SR武器': [W('SR', '散弾銃（仮）', { new: true })],
  'SSR武器': [W('SSR', '狙撃銃 ヘイルストーム・ロングバレル（仮）', { new: true })],
  'バディ': [B('ヒサシ（仮）', { new: true })],
  'バディ（所持済み）': [B('ハコビ（仮）', { new: false })],
};
export const PRESETS10 = {
  '通常のみ': [S(20), W('N', 'ハンドガン（仮）'), S(15), W('R', 'サブマシンガン（仮）'), S(20), S(10), W('N', '散弾銃（仮）'), S(25), W('R', 'アサルトライフル（仮）'), S(15)],
  'SR2件': [S(20), W('R', 'アサルトライフル（仮）'), W('SR', '散弾銃（仮）', { new: true }), S(15), W('N', 'ハンドガン（仮）'), S(10), S(20), W('SR', 'グレネードランチャー（仮）'), S(25), W('N', 'サブマシンガン（仮）')],
  'SSR＋SR': [S(20), W('SR', '散弾銃（仮）'), S(15), W('R', 'アサルトライフル（仮）'), S(10), W('SSR', '狙撃銃 ヘイルストーム（仮）', { new: true }), S(20), W('N', 'ハンドガン（仮）'), S(15), W('R', 'サブマシンガン（仮）')],
  'バディ＋SSR＋SR': [S(20), W('R', 'アサルトライフル（仮）'), B('ハコビ（仮）', { new: true }), S(15), W('SR', '散弾銃（仮）'), S(10), W('N', 'ハンドガン（仮）'), W('SSR', '狙撃銃 ヘイルストーム（仮）', { new: true }), S(25), S(15)],
  '長い名前の確認': [W('SSR', '超長距離精密狙撃銃 ヘイルストーム・ロングバレル改二（仮）', { new: true }), W('SR', 'フルオート散弾銃 ブリーチャーMk-IV 拡張弾倉仕様（仮）'), S(999), W('R', 'アサルトライフル AR-9 カスタム・ストック（仮）'), W('N', 'ハンドガン（仮）'), S(15), B('メニスカス・ロングネーム確認用（仮）', { new: true }), S(20), W('R', 'サブマシンガン（仮）'), S(15)],
  '全部武装片': Array.from({ length: 10 }, (_, i) => S(10 + i * 5)),
};

/* ── タイムライン構築：結果配列 → 区間と停止点 ── */
export function build(results, reduced) {
  const n = results.length, multi = n > 1, cols = multi ? 5 : 1;
  const tiers = results.map(tierOf), maxT = Math.max(...tiers);
  const m = { results, n, multi, cols, tiers, maxT, reduced, stops: [], marks: [], pods: [], dur: 0 };
  let t = 0;
  m.entry = [0, reduced ? 0.15 : 0.28];
  t = m.entry[1];
  results.forEach((r, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    m.pods.push({ i, r, tier: tiers[i], d: row + col });
  });
  // 降下：グリッド斜めウェーブ（行＋列で遅延）＋ 落下して弾む
  const DROP = reduced ? 0.2 : 0.42, STAG = reduced ? 0.03 : 0.07;
  m.pods.forEach((p) => { const s = t + p.d * STAG; p.drop = [s, s + DROP]; });
  t = Math.max(...m.pods.map((p) => p.drop[1]));
  if (!reduced) { m.hit = [t, t + 0.06]; t += 0.06; } // ヒットストップ約4コマ
  m.marks.push(t);
  const omenD = reduced ? (maxT >= 3 ? 0.5 : 0) : maxT >= 3 ? 0.6 : 0.3;
  m.omen = [t, t + omenD]; t += omenD;
  if (maxT >= 4 && !reduced) { m.esc = [t, t + 0.5]; t += 0.5; } // 紫 → 金への昇格
  if (maxT >= 5 && !reduced) { m.intr = [t, t + 0.6]; t += 0.6; } // 通信割り込み
  m.omenEnd = t;

  const setCard = (p, s, mode) => {
    // 開封 → カードが持ち上がる → 裏返し（90°で表裏切替）→ 表を見せてからラベル
    if (mode === 'fast') {
      p.open = [s, s + 0.15]; p.flip = [s + 0.08, s + 0.36]; p.label = [s + 0.3, s + 0.5]; p.stars = s + 0.32;
    } else if (mode === 'mid') { // 10連のSR：持ち上げを省き、裏返しを短く
      p.open = [s, s + 0.2]; p.flip = [s + 0.15, s + 0.5]; p.label = [s + 0.45, s + 0.65]; p.stars = s + 0.5;
    } else {
      p.open = [s, s + 0.25]; p.lift = [s + 0.2, s + 0.45]; p.flip = [s + 0.4, s + 0.9]; p.label = [s + 0.85, s + 1.1]; p.stars = s + 0.95;
    }
    p.newAt = p.stars + starCount(p.tier) * 0.07 + 0.15;
    return p.newAt + 0.25;
  };

  if (multi) {
    const lows = m.pods.filter((p) => p.tier < 3);
    m.wave = t;
    if (lows.length) {
      m.marks.push(t);
      let end = t;
      const WS = reduced ? 0.02 : 0.06;
      lows.forEach((p) => { end = Math.max(end, setCard(p, t + p.d * WS, 'fast')); });
      t = end;
    }
  }
  const highs = m.pods.filter((p) => (multi ? p.tier >= 3 : true)).sort((a, b) => a.tier - b.tier || a.i - b.i);
  for (const p of highs) {
    m.marks.push(t);
    p.focus = [t, t + 0.15];
    const s = multi ? t + 0.1 : t;
    if (p.tier < 4) {
      const end = setCard(p, s, reduced ? 'fast' : multi ? 'mid' : 'full');
      p.rays = p.tier === 3 ? s : null;
      p.end = end + (multi ? 0.1 : 0);
      t = p.end;
    } else {
      p.open = [s, s + 0.25]; p.rays = s;
      p.beam = reduced ? null : [s + 0.2, s + 0.65];
      const cut0 = reduced ? s + 0.25 : s + 0.55;
      const c = { band: p.tier === 5 ? [cut0, cut0 + 0.45] : null };
      const sl = p.tier === 5 ? cut0 + 0.3 : cut0;
      c.slash = [sl, sl + (reduced ? 0.2 : 0.35)];
      c.title = [sl + (reduced ? 0 : 0.25), sl + (reduced ? 0.2 : 0.65)];
      c.stars = sl + (reduced ? 0.2 : 0.55);
      c.newAt = c.stars + starCount(p.tier) * 0.07 + 0.15;
      c.ready = c.newAt + 0.3;
      p.cut = c;
      m.stops.push(c.ready);
      if (multi) {
        c.out = [c.ready, c.ready + 0.21]; // 退場は登場より短く
        p.flip = [c.ready, c.ready + 0.2]; p.label = [c.ready + 0.1, c.ready + 0.3]; p.stars = c.ready + 0.15;
        p.newAt = p.stars + starCount(p.tier) * 0.07 + 0.1;
        p.end = c.ready + 0.4;
        t = p.end;
      } else {
        p.end = c.ready; t = c.ready;
      }
    }
  }
  if (multi) {
    m.marks.push(t);
    m.list = [t, t + (reduced ? 0.15 : 0.28)];
    m.items = m.pods.map((p, i) => [t + 0.2 + i * 0.04, t + 0.5 + i * 0.04]);
    t += 0.2 + (m.n - 1) * 0.04 + 0.3;
  }
  m.dur = t;
  if (!m.stops.includes(t)) m.stops.push(t);
  m.stops.sort((a, b) => a - b);
  m.marks = [...new Set(m.marks)].filter((x) => x < m.dur).sort((a, b) => a - b);
  return m;
}

/* 予兆の段階：入力結果の最高段階を絶対に超えない。紫（SR以上）→ 金（SSR以上）→ バディ反応へ昇格するだけ。 */
export function omenLevel(m, t) {
  if (t < m.omen[0] || (m.list && t >= m.list[0])) return 0;
  if (m.reduced) return m.maxT >= 3 ? m.maxT : 0;
  let L = m.maxT >= 3 ? 3 : 0;
  if (m.esc && t >= m.esc[0] + 0.25) L = 4;
  if (m.intr && t >= m.intr[0]) L = 5;
  return Math.min(L, m.maxT);
}

/* 状況表示：何が起きているかだけを示し、結果を先に漏らさない */
function phaseOf(m, t, fs) {
  if (fs.final) return '受領完了';
  if (fs.list) return '受領一覧';
  if (fs.cut) return '確定';
  const opened = m.pods.some((p) => p.open && t >= p.open[0]);
  if (opened) return '開封';
  if (t >= m.omen[0]) return fs.level >= 3 ? '反応を検知' : '解析中';
  return '降下中';
}

/* ── 1コマの状態（純粋関数）── */
export function frameState(m, t, VH = 390) {
  const R = m.reduced;
  const fs = { t, level: omenLevel(m, t), shake: 0, flash: 0, ring: null, stat: 0, pods: [], cut: null, list: null, final: t >= m.dur - 1e-6 };
  fs.entry = seg(t, m.entry[0], m.entry[1], E.inOutCubic);
  if (!R && m.hit) {
    const x = t - m.hit[0];
    if (x >= 0 && x < 0.4) fs.shake += 5 * Math.exp(-8 * x) * Math.sin(x * 40);
    if (x >= 0) fs.flash = Math.max(fs.flash, 0.16 * (1 - seg(t, m.hit[0], m.hit[0] + 0.15)));
  }
  if (!R && m.esc) {
    const c = m.esc[0] + 0.25;
    if (t >= c) {
      fs.flash = Math.max(fs.flash, 0.28 * (1 - seg(t, c, c + 0.2)));
      const q = seg(t, c, c + 0.35, E.outCubic);
      if (q < 1) fs.ring = { scale: 0.3 + q * 3, op: 1 - q };
    }
  }
  if (!R && m.intr) fs.stat = seg(t, m.intr[0], m.intr[0] + 0.1) * (1 - seg(t, m.intr[1] - 0.15, m.intr[1])) * 0.9;
  const current = m.multi ? m.pods.find((p) => p.focus && t >= p.focus[0] && t < p.end) : null;
  const omenOn = t >= m.omen[0] && t < m.omenEnd;
  for (const p of m.pods) {
    const s = {};
    const dp = seg(t, p.drop[0], p.drop[1], R ? E.outCubic : E.outBounce);
    const fall = seg(t, p.drop[0], p.drop[0] + (p.drop[1] - p.drop[0]) * 0.36); // 最初の接地まで
    s.y = R ? 0 : -(1 - dp) * VH * 0.75;
    s.op = R ? seg(t, p.drop[0], p.drop[1]) : seg(t, p.drop[0], p.drop[0] + 0.06);
    s.trail = R ? 0 : (t >= p.drop[0] ? (1 - fall) * 0.9 : 0); // 降下中の噴射跡
    s.dust = R ? 0 : seg(t, p.drop[0] + (p.drop[1] - p.drop[0]) * 0.36, p.drop[0] + (p.drop[1] - p.drop[0]) * 0.36 + 0.45, E.outCubic);
    s.ground = R ? s.op : 0.25 + 0.75 * dp; // 接地の影：高い位置では薄く小さい
    const opened = p.open && t >= p.open[0];
    s.rot = 0;
    if (!R && omenOn && !opened) {
      const env = seg(t, m.omen[0], m.omen[0] + 0.2) * (1 - seg(t, m.omenEnd - 0.1, m.omenEnd));
      const amp = [1.2, 1.2, 1.2, 2.4, 3.6, 3.6][fs.level];
      s.rot = Math.sin(t * 46 + p.i * 1.7) * amp * env;
    }
    // ランプ：1連は段階色。10連は個々を中立のまま、ウェーブ後に残ったSR以上だけ「SR以上」の下限を示す
    s.lamp = LAMP_NEUTRAL;
    s.lampTier = -1;
    s.hint = 0;
    s.leak = 0; // 継ぎ目からの漏れ光（予兆の色、下限）
    if (!m.multi) {
      if (fs.level >= 3) { s.lamp = TIER_VAR[fs.level]; s.lampTier = fs.level; }
      if (omenOn && !opened) s.leak = (fs.level >= 3 ? 0.55 : 0.18) * (0.75 + 0.25 * Math.sin(t * 9));
    } else if (p.tier >= 3 && t >= m.wave && !opened) {
      s.lamp = TIER_VAR[3]; s.lampTier = 3;
      s.hint = 0.55 + 0.45 * Math.sin(t * 6);
      s.leak = 0.4 * s.hint;
    }
    s.open = p.open ? seg(t, p.open[0], p.open[1], R ? E.linear : E.outBack) : 0;
    s.burst = p.open && !R ? seg(t, p.open[0], p.open[0] + 0.12) * (1 - seg(t, p.open[0] + 0.12, p.open[0] + 0.5)) : 0;
    s.shell = p.open ? 1 - seg(t, p.open[1], p.open[1] + 0.3) : 1;
    s.card = p.open ? seg(t, p.open[0], p.open[0] + 0.1) : 0;
    s.rise = p.open ? seg(t, p.open[0], p.open[0] + 0.3, E.outCubic) : 0; // ポッドの中から持ち上がる
    s.lift = p.lift && !R ? seg(t, p.lift[0], p.lift[1], E.outCubic) : 0;
    const f = p.flip ? seg(t, p.flip[0], p.flip[1], E.inOutCubic) : 0;
    s.front = f >= 0.5;
    s.sx = R ? 1 : Math.max(0.02, Math.abs(Math.cos(Math.PI * f)));
    s.label = p.label ? seg(t, p.label[0], p.label[1], E.outCubic) : 0;
    s.stars = p.stars != null ? Array.from({ length: starCount(p.tier) }, (_, k) => seg(t, p.stars + k * 0.07, p.stars + k * 0.07 + 0.25, E.outBack)) : [];
    s.newp = p.r.new && p.newAt != null ? seg(t, p.newAt, p.newAt + 0.2, E.inQuad) : 0;
    s.focus = current === p ? seg(t, p.focus[0], p.focus[1], E.outCubic) : 0;
    s.dim = current && current !== p ? 0.42 : 1;
    s.beam = p.beam ? seg(t, p.beam[0], p.beam[1], E.outExpo) * (1 - seg(t, p.cut.ready - 0.1, p.cut.ready + 0.2)) : 0;
    s.rays = !R && p.rays != null ? seg(t, p.rays, p.rays + 0.35, E.outCubic) * (m.multi ? 1 - seg(t, p.end - 0.25, p.end) : 1) : 0;
    s.raysRot = t * 22;
    s.sheen = s.front && p.tier >= 3 && p.label ? seg(t, p.label[0], p.label[0] + 0.55, E.inOutCubic) : 0; // 表面を走る光
    if (!R && p.open && p.tier >= 3 && t >= p.open[0]) {
      fs.flash = Math.max(fs.flash, [0, 0, 0, 0.2, 0.34, 0.42][p.tier] * (1 - seg(t, p.open[0], p.open[0] + 0.25)));
      if (p.tier >= 4) { const x = t - p.open[0]; if (x < 0.4) fs.shake += 3.5 * Math.exp(-8 * x) * Math.sin(x * 40); }
    }
    if (p.cut && t >= (p.cut.band ? p.cut.band[0] : p.cut.slash[0]) && !(p.cut.out && t >= p.cut.out[1])) {
      const c = p.cut, cs = {};
      cs.i = p.i; cs.tier = p.tier;
      cs.op = c.out ? 1 - seg(t, c.out[0], c.out[1], E.inCubic) : 1;
      cs.outX = c.out ? seg(t, c.out[0], c.out[1], E.inCubic) : 0;
      cs.band = c.band ? (R ? 1 : E.spring(seg(t, c.band[0], c.band[1]))) : null;
      cs.bandOp = c.band ? seg(t, c.band[0], c.band[0] + 0.05) : 0;
      cs.slash = seg(t, c.slash[0], c.slash[1], R ? E.linear : E.inOutCubic);
      cs.title = seg(t, c.title[0], c.title[1], R ? E.linear : E.outExpo);
      cs.mark = seg(t, c.slash[0], c.slash[1] + 0.3, R ? E.linear : E.outCubic); // 背景の大きなレア度表記
      cs.speed = t - c.slash[0]; // 流れる線の位置（秒）
      cs.stars = Array.from({ length: starCount(p.tier) }, (_, k) => seg(t, c.stars + k * 0.07, c.stars + k * 0.07 + 0.25, E.outBack));
      cs.newp = p.r.new ? seg(t, c.newAt, c.newAt + 0.2, E.inQuad) : 0;
      fs.cut = cs;
    }
    fs.pods.push(s);
  }
  if (m.list && t >= m.list[0]) {
    fs.list = { op: seg(t, m.list[0], m.list[1], E.outCubic), items: m.items.map(([a, b]) => seg(t, a, b, E.outCubic)) };
  }
  if (R) { fs.shake = 0; fs.flash = 0; }
  fs.flash = Math.min(fs.flash, 0.45); // 白の一瞬の光は0.45を上限にする
  // 予兆の表示は、1連では開封した時点で役目を終えるので消す（10連は一覧まで残す）
  const anyOpen = m.pods.some((p) => p.open && t >= p.open[0]);
  fs.badge = fs.level >= 3 && (m.multi || !anyOpen) ? 1 : 0;
  fs.phase = phaseOf(m, t, fs);
  return fs;
}

/* ── 検査：全プリセット×通常/動き減を1/60秒刻みで検査 ── */
export function audit(extra = {}) {
  const report = [];
  const sets = [...Object.entries(PRESETS1), ...Object.entries(PRESETS10), ...Object.entries(extra)];
  for (const [name, raw] of sets) for (const reduced of [false, true]) {
    const res = validate(raw), m = build(res, reduced), errs = [];
    for (let t = 0; t <= m.dur + 1e-9; t += 1 / 60) {
      const fs = frameState(m, t, 390);
      if (fs.level > m.maxT) errs.push(`t=${t.toFixed(2)} 予兆${fs.level}>結果${m.maxT}`);
      fs.pods.forEach((s, i) => {
        const p = m.pods[i];
        if (s.front && !(p.open && t >= p.open[0])) errs.push(`t=${t.toFixed(2)} ${i}が開封前に表`);
        if (s.hint > 0 && p.tier < 3) errs.push(`t=${t.toFixed(2)} ${i}にSR以上表示`);
        if (s.lampTier > p.tier) errs.push(`t=${t.toFixed(2)} ${i}のランプが結果を超える`);
      });
      if (fs.cut && m.tiers[fs.cut.i] < 4) errs.push(`t=${t.toFixed(2)} SSR未満にカットイン`);
      if (fs.cut && fs.cut.newp > 0 && !m.results[fs.cut.i].new) errs.push(`t=${t.toFixed(2)} new:falseにNEW`);
      fs.pods.forEach((s, i) => { if (s.newp > 0 && !m.results[i].new) errs.push(`t=${t.toFixed(2)} ${i} new:falseにNEW`); });
    }
    m.pods.filter((p) => p.cut).forEach((p) => {
      const c = frameState(m, p.cut.ready, 390).cut;
      if (!m.stops.includes(p.cut.ready)) errs.push(`${p.i}の停止点が未登録`);
      if (!c || c.i !== p.i || c.slash < 1 || c.title < 1 || c.op < 1) errs.push(`${p.i}の停止点でカットイン未完成`);
    });
    const end = frameState(m, m.dur, 390);
    if (m.multi && !(end.pods.every((s) => s.front) && end.list && end.list.items.every((x) => x === 1))) errs.push('最終で全件が表になっていない');
    if (!m.multi && !(end.cut || end.pods[0].front)) errs.push('1連の最終で結果が見えない');
    report.push({ name, reduced, dur: +m.dur.toFixed(2), stops: m.stops.length, ok: errs.length === 0, errs: errs.slice(0, 3) });
  }
  return report;
}

/* ── 中断・再開（端末内の試作専用キー。保存の正本ではない） ── */
export function readPending(storage, key) {
  try { const v = storage?.getItem(key); return v ? validate(JSON.parse(v)) : null; } catch { return null; }
}
const writePending = (storage, key, results) => { try { storage?.setItem(key, JSON.stringify(results)); } catch { /* 保存できなくても再生は続ける */ } };
const clearPendingIn = (storage, key) => { try { storage?.removeItem(key); } catch { /* noop */ } };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const starsHTML = (n) => Array.from({ length: n }, () => `<i>${n === 5 ? '◆' : '★'}</i>`).join('');
const LAMPS_BODY = [
  // シアン灯の位置（素材 supply-pod-neutral-v1 を外接矩形で切り出した座標の%）。left, top, width, height
  [39.2, 35.2, 4.5, 0.9], [14.0, 40.4, 0.7, 9.6], [69.7, 41.0, 0.8, 9.6], [39.3, 75.8, 4.5, 0.9],
];
// ポッドの箱の下端から継ぎ目までの高さ（箱の高さに対する比）：素材は箱の下2%から高さ93.2%、継ぎ目は素材の上から29.3%
const SEAM_BOTTOM = 0.02 + (1078 / 1157) * (1 - 0.293);
const LAMPS_LID =[[36.0, 15.1, 11.6, 1.1], [84.3, 11.8, 4.1, 3.1]];
const lampHTML = (list) => list.map(([l, tp, w, h]) => `<i class="sr-lamp" style="left:${l}%;top:${tp}%;width:${w}%;height:${h}%"></i>`).join('');

/* ── 表示モジュール ── */
export function createSupplyReveal(host, options = {}) {
  const o = {
    assetBase: new URL('./assets/', import.meta.url).href,
    label: '配布券（仮）',
    reduced: undefined,
    fast: false,
    storage: (() => { try { return sessionStorage; } catch { return null; } })(),
    pendingKey: 'supply-reveal-pending',
    finalActions: [{ id: 'close', label: '閉じる', primary: true }],
    onAction: () => {},
    onClose: () => {},
    onEvent: () => {},
    ...options,
  };
  if (o.reduced == null) {
    try { o.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { o.reduced = false; }
  }
  const root = document.createElement('div');
  root.className = 'sr-root';
  root.hidden = true;
  root.style.setProperty('--sr-pod-img', `url("${o.assetBase}pod-512.webp")`);
  root.style.setProperty('--sr-pod-img-s', `url("${o.assetBase}pod-256.webp")`);
  root.innerHTML = `
  <div class="sr-stage" aria-live="polite">
    <div class="sr-world">
      <div class="sr-bg" aria-hidden="true"><div class="sr-wall"></div><div class="sr-floor"></div><div class="sr-fog"></div></div>
      <div class="sr-signal" aria-hidden="true"></div>
      <div class="sr-pods"></div>
      <div class="sr-ring" aria-hidden="true"></div>
      <div class="sr-static" aria-hidden="true"><span>通信割り込み</span></div>
    </div>
    <div class="sr-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="sr-badge" aria-hidden="true"></div>
    <div class="sr-flash" aria-hidden="true"></div>
    <section class="sr-cut" aria-hidden="true">
      <div class="sr-cut-dim"></div>
      <div class="sr-cut-band"><span>BUDDY SIGNAL ／ バディ合流</span></div>
      <div class="sr-cut-panel">
        <div class="sr-cut-speed" aria-hidden="true"></div>
        <div class="sr-cut-mark" aria-hidden="true"></div>
        <div class="sr-cut-rarity"></div>
        <div class="sr-cut-title"><span class="sr-cut-a"></span><span class="sr-cut-b" aria-hidden="true"></span></div>
        <div class="sr-cut-sub"></div>
        <div class="sr-cut-stars"></div>
        <div class="sr-cut-new">NEW</div>
      </div>
      <div class="sr-cut-line"></div>
    </section>
    <section class="sr-list" aria-label="受領一覧">
      <header class="sr-list-head"><h2>受領一覧 <span class="sr-list-count"></span></h2><div class="sr-list-sum"></div></header>
      <div class="sr-list-grid" role="list"></div>
    </section>
    <div class="sr-final"></div>
    <div class="sr-hud">
      <div class="sr-hud-id"><small>SUPPLY DROP</small><span class="sr-hud-label"></span><em class="sr-phase"></em></div>
      <button type="button" class="sr-btn" data-sr="reduce" aria-pressed="false">動き減</button>
      <button type="button" class="sr-btn" data-sr="fast" aria-pressed="false">2×</button>
      <button type="button" class="sr-btn" data-sr="skip">スキップ</button>
    </div>
    <div class="sr-hint" aria-hidden="true">タップで次へ</div>
    <div class="sr-wipe" aria-hidden="true"></div>
  </div>`;
  host.append(root);
  const q = (s) => root.querySelector(s);
  const el = {
    stage: q('.sr-stage'), world: q('.sr-world'), signal: q('.sr-signal'), badge: q('.sr-badge'), pods: q('.sr-pods'),
    ring: q('.sr-ring'), stat: q('.sr-static'), flash: q('.sr-flash'), cut: q('.sr-cut'), band: q('.sr-cut-band'),
    panel: q('.sr-cut-panel'), speed: q('.sr-cut-speed'), mark: q('.sr-cut-mark'), cutRarity: q('.sr-cut-rarity'),
    cutA: q('.sr-cut-a'), cutB: q('.sr-cut-b'), cutSub: q('.sr-cut-sub'), cutStars: q('.sr-cut-stars'), cutNew: q('.sr-cut-new'),
    cutLine: q('.sr-cut-line'), list: q('.sr-list'), listGrid: q('.sr-list-grid'), listCount: q('.sr-list-count'),
    listSum: q('.sr-list-sum'), final: q('.sr-final'), hudLabel: q('.sr-hud-label'), phase: q('.sr-phase'), hint: q('.sr-hint'),
    wipe: q('.sr-wipe'), skip: q('[data-sr="skip"]'), fastBtn: q('[data-sr="fast"]'), reduceBtn: q('[data-sr="reduce"]'),
  };
  const st = { m: null, results: null, t: 0, playing: false, hold: null, passed: new Set(), last: null, lastTap: 0, podEls: [], tileEls: [], cutFor: -1, starting: false, gen: 0, frames: 0, ticksByGen: {}, scrub: false, VH: 390, panelH: 200, destroyed: false };
  // 同じ値を毎コマ書き込まない（スタイル再計算を減らす）
  const cache = new WeakMap();
  const set = (node, prop, val) => {
    let c = cache.get(node); if (!c) cache.set(node, (c = {}));
    if (c[prop] === val) return;
    c[prop] = val;
    if (prop.startsWith('--')) node.style.setProperty(prop, val); else node.style[prop] = val;
  };
  const f3 = (x) => x.toFixed(3);

  function renderFinal() {
    el.final.innerHTML = o.finalActions.map((a) => `<button type="button" class="sr-btn${a.primary ? ' is-primary' : ''}" data-sr-action="${esc(a.id)}">${esc(a.label)}</button>`).join('');
  }
  renderFinal();

  function mountPods(m) {
    el.pods.innerHTML = m.pods.map((p) => `
      <div class="sr-pod" data-tier="${TIER_KEY[p.tier]}" style="--c:${TIER_VAR[p.tier]}">
        <div class="sr-ground"><i class="sr-shadow"></i><i class="sr-aura"></i><i class="sr-dust"></i></div>
        <div class="sr-trail"></div>
        <div class="sr-rays"></div><div class="sr-beam"></div>
        <div class="sr-cardwrap"><div class="sr-card">
          <div class="sr-face sr-back"><span class="sr-back-mark"></span><small>SUPPLY</small></div>
          <div class="sr-face sr-front">
            <span class="sr-chip">${TIER_NAME[p.tier]}</span>
            <span class="sr-name">${esc(nameOf(p.r))}</span>
            <span class="sr-sub">${esc(subOf(p.r))}</span>
            <span class="sr-stars">${starsHTML(starCount(p.tier))}</span>
            <i class="sr-sheen"><b></b></i>
            ${p.r.new ? '<span class="sr-new">NEW</span>' : ''}
          </div>
        </div></div>
        <div class="sr-art">
          <div class="sr-body">${lampHTML(LAMPS_BODY)}<span class="sr-hintlabel">SR以上</span></div>
          <div class="sr-seam"></div>
          <div class="sr-lid">${lampHTML(LAMPS_LID)}</div>
        </div>
      </div>`).join('');
    st.podEls = [...el.pods.children].map((n) => {
      const g = (s) => n.querySelector(s);
      return {
        root: n, shadow: g('.sr-shadow'), aura: g('.sr-aura'), dust: g('.sr-dust'), trail: g('.sr-trail'), rays: g('.sr-rays'), beam: g('.sr-beam'),
        wrap: g('.sr-cardwrap'), card: g('.sr-card'), back: g('.sr-back'), front: g('.sr-front'), chip: g('.sr-chip'), name: g('.sr-name'), sub: g('.sr-sub'),
        stars: [...n.querySelectorAll('.sr-stars i')], nw: g('.sr-new'), sheen: g('.sr-sheen b'), art: g('.sr-art'), body: g('.sr-body'),
        lid: g('.sr-lid'), seam: g('.sr-seam'), hint: g('.sr-hintlabel'),
      };
    });
    if (m.multi) {
      const count = [0, 0, 0, 0, 0, 0];
      let shards = 0;
      m.pods.forEach((p) => { count[p.tier]++; if (p.r.type === 'shard') shards += p.r.amount; });
      el.listCount.textContent = `${m.n}件`;
      el.listSum.innerHTML = [5, 4, 3, 2, 1].filter((k) => count[k]).map((k) => `<span style="--c:${TIER_VAR[k]}">${TIER_NAME[k]} ${count[k]}</span>`).join('') +
        (shards ? `<span style="--c:${TIER_VAR[0]}">武装片 計${shards}</span>` : '');
      el.listGrid.innerHTML = m.pods.map((p) => `
        <div class="sr-tile" data-tier="${TIER_KEY[p.tier]}" style="--c:${TIER_VAR[p.tier]}" role="listitem" aria-label="${esc(`${TIER_NAME[p.tier]} ${nameOf(p.r)} ${subOf(p.r)}${p.r.new ? ' NEW' : ''}`)}" title="${esc(nameOf(p.r))}">
          <span class="sr-t-top"><span class="sr-t-chip">${TIER_NAME[p.tier]}</span>${p.r.new ? '<span class="sr-t-new">NEW</span>' : ''}</span>
          <span class="sr-t-name">${esc(nameOf(p.r))}</span>
          <span class="sr-t-sub"><span>${esc(subOf(p.r))}</span><span class="sr-t-stars">${starsHTML(starCount(p.tier))}</span></span>
        </div>`).join('');
      st.tileEls = [...el.listGrid.children];
    } else { el.listGrid.innerHTML = ''; el.listCount.textContent = ''; el.listSum.innerHTML = ''; st.tileEls = []; }
    st.cutFor = -1;
  }

  // 長い名前は切り捨てず、枠に収まるまで文字を縮める（下限 min px）。毎コマではなく配置時だけ。
  function fitText(nodes, min) {
    nodes.forEach((n) => {
      n.style.fontSize = '';
      let size = parseFloat(getComputedStyle(n).fontSize);
      while ((n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1) && size > min) {
        size -= 0.5; n.style.fontSize = size + 'px';
      }
    });
  }
  function fitAll() {
    const tmp = [];
    [el.list, ...st.podEls.map((e) => e.front), ...st.podEls.map((e) => e.card)].forEach((n) => {
      tmp.push([n, n.style.visibility, n.style.opacity]);
      n.style.visibility = 'visible'; n.style.opacity = '0';
    });
    fitText(st.tileEls.map((n) => n.querySelector('.sr-t-name')), 8);
    fitText(st.podEls.map((e) => e.name), 7);
    tmp.forEach(([n, v, op]) => { n.style.visibility = v; n.style.opacity = op; });
    st.podEls.forEach((e) => { cache.delete(e.front); cache.delete(e.card); });
    cache.delete(el.list);
  }
  function layout() {
    const m = st.m; if (!m) return;
    const r = root.getBoundingClientRect();
    const Wd = r.width || innerWidth, H = r.height || innerHeight;
    let ps, gap = 0;
    if (m.multi) { gap = H < 340 ? 8 : 12; ps = Math.floor(Math.min((H - 112 - gap) / 2, (Wd - 60 - 4 * gap) / 5, 124)); }
    else ps = Math.floor(Math.min(H * 0.46, 196));
    el.pods.style.setProperty('--ps', ps + 'px');
    el.pods.style.setProperty('--gap', gap + 'px');
    el.pods.style.setProperty('--cols', m.cols);
    root.dataset.mode = m.multi ? 'multi' : 'single';
    root.dataset.short = H < 340 ? '1' : '';
    st.VH = H; st.panelH = Math.min(H * 0.58, 210);
    fitAll();
  }

  function setCut(m, i) {
    const p = m.pods[i];
    set(el.cut, '--c', TIER_VAR[p.tier]);
    el.cut.dataset.tier = TIER_KEY[p.tier];
    el.cutRarity.textContent = TIER_NAME[p.tier];
    el.mark.textContent = p.tier === 5 ? 'BUDDY' : TIER_NAME[p.tier];
    el.cutA.textContent = nameOf(p.r); el.cutB.textContent = nameOf(p.r);
    // 「新しい」は入力の new:true の時だけ。所持済み（new:false）のバディには付けない。
    el.cutSub.textContent = subOf(p.r) + (p.tier === 5 ? (p.r.new ? '　新しいバディが合流' : '　バディが合流') : '');
    el.cutStars.innerHTML = starsHTML(starCount(p.tier));
    el.cutNew.hidden = !p.r.new;
    el.cut.setAttribute('aria-hidden', 'false');
    el.cut.setAttribute('aria-label', `${TIER_NAME[p.tier]} ${nameOf(p.r)}`);
    st.cutFor = i;
  }

  /* 状態の適用：毎コマ書き換えるのは transform / opacity / clip-path と色の変数だけ */
  function apply(fs) {
    const m = st.m, R = m.reduced;
    if (fs.entry < 1 && !R) {
      const x = fs.entry * 130 - 15;
      set(el.stage, 'clipPath', `polygon(0 0, calc(${x}% + 12vh) 0, calc(${x}% - 12vh) 100%, 0 100%)`);
      set(el.wipe, 'opacity', '1'); set(el.wipe, 'transform', `translateX(${(x / 100) * st.W}px) skewX(-24deg)`);
    } else { set(el.stage, 'clipPath', ''); set(el.wipe, 'opacity', '0'); }
    set(el.stage, 'opacity', R ? f3(Math.max(0.001, fs.entry)) : '1');
    set(el.world, 'transform', fs.shake ? `translate3d(0, ${fs.shake.toFixed(2)}px, 0)` : '');
    set(el.flash, 'opacity', f3(fs.flash));
    const lv = fs.level;
    set(el.signal, '--sig', lv >= 3 ? TIER_VAR[lv] : 'var(--sr-lamp)');
    set(el.signal, 'opacity', lv ? (lv >= 3 ? '1' : '0.35') : '0');
    if (el.badge.textContent !== (BADGE[lv] || '')) el.badge.textContent = BADGE[lv] || '';
    set(el.badge, '--c', lv >= 3 ? TIER_VAR[lv] : 'var(--sr-lamp)');
    set(el.badge, 'opacity', fs.badge ? '1' : '0');
    set(el.ring, 'opacity', fs.ring ? f3(fs.ring.op) : '0');
    set(el.ring, 'transform', fs.ring ? `scale(${f3(fs.ring.scale)})` : 'scale(0)');
    set(el.stat, 'opacity', f3(fs.stat));
    if (fs.stat) set(el.stat, 'transform', `translateY(${((fs.t * 300) % 9).toFixed(1)}px)`);
    if (el.phase.textContent !== fs.phase) el.phase.textContent = fs.phase;

    const ps = st.ps;
    fs.pods.forEach((s, i) => {
      const e = st.podEls[i];
      const sc = 1 + 0.12 * s.focus + 0.05 * s.lift;
      set(e.root, 'transform', `scale(${f3(sc)})`);
      set(e.root, 'opacity', f3(s.op * s.dim));
      set(e.root, 'zIndex', s.focus ? '2' : '');
      set(e.art, 'transform', `translate3d(0, ${s.y.toFixed(1)}px, 0) rotate(${s.rot.toFixed(2)}deg)`);
      set(e.trail, 'opacity', f3(s.trail));
      set(e.trail, 'transform', `translate3d(0, ${s.y.toFixed(1)}px, 0) scaleY(${f3(0.3 + s.trail)})`);
      set(e.shadow, 'opacity', f3(s.ground * (0.25 + 0.75 * s.shell)));
      set(e.shadow, 'transform', `scale(${f3(0.45 + 0.55 * s.ground)})`);
      set(e.dust, 'opacity', f3(s.dust > 0 && s.dust < 1 ? (1 - s.dust) * 0.8 : 0));
      set(e.dust, 'transform', `scale(${f3(0.5 + s.dust * 1.3)}, ${f3(0.5 + s.dust * 0.7)})`);
      set(e.root, '--lamp', s.lamp);
      set(e.aura, 'opacity', f3(Math.max(s.leak, s.lampTier >= 3 ? 0.5 * s.shell : 0)));
      set(e.seam, 'opacity', f3(Math.max(s.leak, s.burst)));
      set(e.seam, 'transform', `scaleX(${f3(0.55 + 0.45 * Math.max(s.leak, s.burst))}) scaleY(${f3(1 + 5 * s.burst)})`);
      set(e.seam, '--seam', s.burst > 0 ? 'var(--c)' : s.lamp);
      set(e.hint, 'opacity', f3(s.hint));
      // 蓋は継ぎ目を軸に跳ね上がる。10連は隣のポッドに重ならないよう小さく動かして早く消す
      const lidUp = m.multi ? 16 : 34, lidRot = m.multi ? 7 : 11;
      set(e.lid, 'transform', R ? '' : `translate3d(0, ${(-s.open * lidUp).toFixed(1)}%, 0) rotate(${(-s.open * lidRot).toFixed(1)}deg)`);
      set(e.lid, 'opacity', f3(R ? 1 - s.open : s.shell * (1 - (m.multi ? 0.85 : 0.6) * s.open)));
      set(e.body, 'opacity', f3(R ? 1 - s.open : s.shell));
      set(e.card, 'opacity', f3(s.card));
      // 開封口（継ぎ目）より下は、ポッドが消えるまで隠す。カードがポッドの中から出てくるように見せる
      set(e.wrap, 'clipPath', R || s.shell <= 0.001 ? 'none' : `inset(-400% -80% ${(SEAM_BOTTOM * ps * E.outCubic(s.shell)).toFixed(1)}px -80%)`);
      // 1連は確定したカードを少し大きく持ち上げて見せる（10連は格子に収める）
      const big = m.multi ? 0 : 0.14 * s.rise;
      const cy = R ? -big * 0.5 * ps : (1 - s.rise) * 0.34 * ps - s.lift * 0.06 * ps - big * 0.5 * ps;
      set(e.card, 'transform', R ? (big ? `translate3d(0, ${cy.toFixed(1)}px, 0) scale(${f3(1 + big)})` : '') : `translate3d(0, ${cy.toFixed(1)}px, 0) scaleX(${f3(s.sx)}) scale(${f3((0.7 + 0.3 * s.rise) * (1 + big))})`);
      set(e.back, 'visibility', s.front ? 'hidden' : 'visible');
      set(e.front, 'visibility', s.front ? 'visible' : 'hidden');
      const lb = f3(s.label);
      set(e.chip, 'opacity', lb); set(e.name, 'opacity', lb); set(e.sub, 'opacity', lb);
      set(e.name, 'transform', `translateY(${((1 - s.label) * 6).toFixed(1)}px)`);
      e.stars.forEach((n, k) => set(n, 'transform', `scale(${f3(s.stars[k] || 0)})`));
      if (e.nw) { set(e.nw, 'opacity', f3(s.newp)); set(e.nw, 'transform', `rotate(8deg) scale(${f3(1.8 - 0.8 * s.newp)})`); }
      set(e.sheen, 'transform', `translateX(${(-120 + 260 * s.sheen).toFixed(0)}%) skewX(-18deg)`);
      set(e.sheen, 'opacity', s.sheen > 0 && s.sheen < 1 ? '1' : '0');
      set(e.beam, 'opacity', s.beam ? '0.9' : '0');
      set(e.beam, 'transform', `scaleY(${f3(s.beam)})`);
      set(e.rays, 'opacity', f3(s.rays * 0.6));
      set(e.rays, 'transform', s.rays ? `rotate(${s.raysRot.toFixed(1)}deg) scale(${f3(0.6 + 0.4 * s.rays)})` : 'scale(0)');
    });

    // カットイン：斜めの境界で面を開き、名前は上下2分割で同時に定位置へ
    const c = fs.cut;
    if (c) {
      if (st.cutFor !== c.i) setCut(m, c.i);
      set(el.cut, 'opacity', f3(c.op));
      set(el.cut, 'transform', c.outX ? `translateX(${(c.outX * -8).toFixed(1)}%)` : '');
      set(el.band, 'opacity', c.band == null ? '0' : f3(c.bandOp));
      set(el.band, 'transform', c.band == null ? '' : `translateY(${((1 - c.band) * -90).toFixed(1)}px)`);
      const D = 0.445 * st.panelH / 2; // tan24° × 面の高さの半分
      if (R) { set(el.panel, 'clipPath', ''); set(el.panel, 'opacity', f3(c.slash)); set(el.cutLine, 'opacity', '0'); }
      else {
        const x = c.slash * 140 - 20;
        set(el.panel, 'opacity', '1');
        set(el.panel, 'clipPath', c.slash >= 1 ? '' : `polygon(0 0, calc(${x}% + ${D}px) 0, calc(${x}% - ${D}px) 100%, 0 100%)`);
        set(el.cutLine, 'opacity', c.slash > 0 && c.slash < 1 ? '1' : '0');
        set(el.cutLine, 'transform', `translateX(${((x / 100) * st.W).toFixed(1)}px) skewX(-24deg)`);
      }
      set(el.speed, 'transform', R ? '' : `translate3d(${(-((c.speed * 900) % 240)).toFixed(1)}px, 0, 0)`);
      set(el.mark, 'transform', `translate3d(${((1 - c.mark) * 12).toFixed(1)}%, -50%, 0)`);
      set(el.mark, 'opacity', f3(0.14 * c.mark));
      set(el.cutA, 'transform', `translateY(${((1 - c.title) * -40).toFixed(1)}px)`);
      set(el.cutB, 'transform', `translateY(${((1 - c.title) * 40).toFixed(1)}px)`);
      const to = c.title > 0 ? '1' : '0';
      set(el.cutA, 'opacity', to); set(el.cutB, 'opacity', to);
      [...el.cutStars.children].forEach((n, k) => set(n, 'transform', `scale(${f3(c.stars[k] || 0)})`));
      set(el.cutNew, 'opacity', f3(c.newp));
      set(el.cutNew, 'transform', `rotate(6deg) scale(${f3(1.8 - 0.8 * c.newp)})`);
    } else {
      set(el.cut, 'opacity', '0');
      if (el.cut.getAttribute('aria-hidden') !== 'true') el.cut.setAttribute('aria-hidden', 'true');
    }

    if (fs.list) {
      set(el.list, 'visibility', 'visible');
      set(el.list, 'opacity', f3(fs.list.op));
      st.tileEls.forEach((n, i) => { const v = fs.list.items[i]; set(n, 'opacity', f3(v)); set(n, 'transform', R ? '' : `translateY(${((1 - v) * 12).toFixed(1)}px)`); });
    } else { set(el.list, 'visibility', 'hidden'); set(el.list, 'opacity', '0'); }

    const atHold = st.hold != null && !fs.final;
    set(el.hint, 'opacity', atHold && performance.now() - st.hold >= MIN_HOLD_MS ? '1' : '0');
    set(el.final, 'visibility', fs.final ? 'visible' : 'hidden');
    set(el.final, 'opacity', fs.final ? '1' : '0');
    if (el.skip.disabled !== fs.final) el.skip.disabled = fs.final;
  }

  const render = () => apply(frameState(st.m, st.t, st.VH));
  const nextStop = () => st.m.stops.find((s) => s >= st.t - 1e-6 && !st.passed.has(s));

  // 時間を進める。停止点に達したらその時刻に止め、タップまで保持する（1コマで通過させない）
  function advance(dt) {
    if (st.hold != null || st.scrub) return;
    const ns = nextStop(); // 進める前に確定する（進めた後に探すと、またいだ停止点を見落とす）
    st.t += dt * (o.fast ? 2 : 1);
    if (ns != null && st.t >= ns) { st.t = ns; st.hold = performance.now(); o.onEvent({ type: 'stop', t: ns, final: ns >= st.m.dur - 1e-6 }); if (ns >= st.m.dur - 1e-6) onFinal(); }
  }
  // 再生ループは世代番号で1本に限定する（もう一度・再開・閉じるの繰り返しで多重化させない）
  function tick(now, gen) {
    if (!st.playing || gen !== st.gen || st.destroyed) return;
    st.frames++;
    st.ticksByGen[gen] = (st.ticksByGen[gen] || 0) + 1;
    const dt = st.last == null ? 0 : Math.min(0.1, (now - st.last) / 1000);
    st.last = now;
    if (!document.hidden) advance(dt);
    render();
    requestAnimationFrame((n) => tick(n, gen));
  }
  function onFinal() {
    clearPendingIn(o.storage, o.pendingKey);
    o.onEvent({ type: 'final' });
    const first = el.final.querySelector('.is-primary') || el.final.querySelector('button');
    first?.focus({ preventScroll: true });
  }

  function tap() {
    const now = performance.now();
    if (!st.m || now - st.lastTap < TAP_GAP_MS) return;
    st.lastTap = now;
    if (st.scrub) { st.scrub = false; return; }
    if (st.t >= st.m.dur - 1e-6) return;
    if (st.hold != null) {
      if (now - st.hold < MIN_HOLD_MS) return; // 高レアの確定直後は連打で流さない
      st.passed.add(nextStop());
      st.hold = null;
      return;
    }
    // 早送り：次の区切り（演出の段の頭）か停止点の早い方へ
    const ns = nextStop();
    const nm = st.m.marks.find((x) => x > st.t + 0.01);
    const target = nm != null && nm < ns ? nm : ns;
    st.t = target;
    if (target === ns) { st.hold = now; o.onEvent({ type: 'stop', t: ns, final: ns >= st.m.dur - 1e-6 }); if (ns >= st.m.dur - 1e-6) onFinal(); }
    render();
  }

  function skip() {
    if (!st.m) return;
    st.m.stops.forEach((s) => st.passed.add(s));
    st.t = st.m.dur; st.hold = performance.now(); st.scrub = false;
    onFinal(); render();
  }

  function play(raw, { atEnd = false } = {}) {
    const results = validate(raw);
    if (st.starting || st.destroyed) return false; // 二重起動防止（入口ボタンの連打）
    st.starting = true;
    st.results = results;
    st.m = build(results, o.reduced);
    st.t = 0; st.hold = null; st.passed = new Set(); st.last = null; st.scrub = false;
    mountPods(st.m);
    el.hudLabel.textContent = `${o.label}×${st.m.n}`;
    root.hidden = false;
    el.stage.style.opacity = '1';
    syncButtons();
    const r = root.getBoundingClientRect(); st.W = r.width || innerWidth;
    layout();
    st.ps = parseFloat(el.pods.style.getPropertyValue('--ps')) || 120;
    if (atEnd) skip(); else writePending(o.storage, o.pendingKey, results);
    st.playing = true;
    const gen = ++st.gen;
    requestAnimationFrame((n) => tick(n, gen));
    setTimeout(() => { st.starting = false; }, 300);
    o.onEvent({ type: 'play', n: st.m.n, atEnd });
    return true;
  }
  function replay() { if (!st.results) return false; st.playing = false; st.starting = false; return play(st.results); }

  async function close() {
    if (root.hidden) return;
    st.playing = false; st.gen++;
    clearPendingIn(o.storage, o.pendingKey);
    const a = root.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: o.reduced ? 0 : 210, easing: 'cubic-bezier(.32,0,.67,0)' });
    await a?.finished.catch(() => {});
    root.hidden = true;
    o.onClose();
  }

  function syncButtons() {
    el.fastBtn.setAttribute('aria-pressed', String(!!o.fast));
    el.reduceBtn.setAttribute('aria-pressed', String(!!o.reduced));
    root.dataset.reduced = o.reduced ? '1' : '';
  }
  function setFast(v) { o.fast = !!v; syncButtons(); o.onEvent({ type: 'option', fast: o.fast }); }
  function setReduced(v) {
    // 確定済み結果のまま時間軸を作り直し、到達済みの段から再開する
    o.reduced = !!v; syncButtons(); o.onEvent({ type: 'option', reduced: o.reduced });
    if (!st.m) return;
    const done = st.t >= st.m.dur - 1e-6, prog = st.t / st.m.dur;
    st.m = build(st.results, o.reduced); mountPods(st.m); layout();
    st.passed = new Set(); st.hold = null;
    if (done) skip(); else { st.t = st.m.marks.filter((x) => x <= prog * st.m.dur).pop() ?? 0; render(); }
  }
  function seek(t) {
    if (!st.m) return;
    st.scrub = true; st.hold = null;
    st.t = Math.max(0, Math.min(st.m.dur, t));
    st.passed = new Set(st.m.stops.filter((s) => s < st.t));
    render();
  }

  /* ── 入力 ── */
  el.stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input, .sr-tile')) return;
    tap();
  });
  const onKey = (e) => {
    if (root.hidden || !st.m) return;
    if (e.key === 'Escape') { e.preventDefault(); if (st.t >= st.m.dur - 1e-6) close(); else skip(); }
    else if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest?.('button, input, textarea, select')) { e.preventDefault(); tap(); }
  };
  document.addEventListener('keydown', onKey);
  el.skip.addEventListener('click', skip);
  el.fastBtn.addEventListener('click', () => setFast(!o.fast));
  el.reduceBtn.addEventListener('click', () => setReduced(!o.reduced));
  el.final.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sr-action]'); if (!b) return;
    const id = b.dataset.srAction;
    if (id === 'close') close();
    else if (id === 'again') replay();
    o.onAction(id);
  });
  const onResize = () => { if (!st.m || root.hidden) return; const r = root.getBoundingClientRect(); st.W = r.width || innerWidth; layout(); st.ps = parseFloat(el.pods.style.getPropertyValue('--ps')) || st.ps; render(); };
  addEventListener('resize', onResize);
  const onVis = () => { st.last = null; };
  document.addEventListener('visibilitychange', onVis);

  function destroy() {
    st.destroyed = true; st.playing = false; st.gen++;
    document.removeEventListener('keydown', onKey);
    removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
    root.remove();
  }

  return {
    root,
    play, replay, tap, skip, close, destroy, seek, setFast, setReduced,
    get options() { return { fast: o.fast, reduced: o.reduced }; },
    ticksByGen: () => ({ ...st.ticksByGen }),
    // 検証用：rAFを止め、固定刻み（既定1/60秒）で通常再生と同じ advance→render を回す
    simulate(seconds, fps = 60) {
      st.gen++; st.playing = false;
      const log = [];
      for (let k = 0; k < Math.round(seconds * fps); k++) {
        const before = st.hold != null;
        advance(1 / fps); render();
        if (!before && st.hold != null) log.push({ frame: k, t: +st.t.toFixed(3) });
      }
      return { t: +st.t.toFixed(3), hold: st.hold != null, holdsReached: log };
    },
    resume() { if (!st.m) return; st.playing = true; st.last = null; const gen = ++st.gen; requestAnimationFrame((n) => tick(n, gen)); },
    perf(n = 600) { const a = performance.now(); for (let k = 0; k < n; k++) { st.t = (k / n) * st.m.dur; render(); } return +((performance.now() - a) / n).toFixed(3); },
    state: () => ({ t: +st.t.toFixed(3), dur: st.m && +st.m.dur.toFixed(3), hold: st.hold != null, stops: st.m && st.m.stops.map((s) => +s.toFixed(3)), passed: [...st.passed].length, frames: st.frames, gen: st.gen, playing: st.playing, cutSub: el.cutSub.textContent, phase: el.phase.textContent }),
  };
}
