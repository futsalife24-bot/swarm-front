import { CLIPS } from './reference-scenes.js';

export function eligible(n, m, previewSingle = false) {
  const high = m.tiers.some((v) => v >= 4), ssr = m.tiers.includes(4);
  if (!high) return false;
  return n === 10 ? m.tiers.includes(5)
    : n === 2 || n === 4 ? (m.multi || previewSingle)
    : n === 3 ? (m.multi || previewSingle) && ssr
    : n === 1 ? high : ssr;
}

/** 表示候補のみランダムに選ぶ。結果を変更しない。 */
export function chooseEffect(m, requested, rng = Math.random, previewSingle = false) {
  if (requested === false || requested === 0) return 0;
  if (Number.isInteger(requested)) {
    if (requested < 1 || requested > 10 || !eligible(requested, m, previewSingle)) throw Error('確定演出と結果の下限が一致しません');
    return requested;
  }
  const pool = CLIPS.map((c) => c.n).filter((n) => eligible(n, m));
  if (!pool.length) return 0;
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw Error('演出の乱数が不正です');
  return pool[Math.floor(value * pool.length)];
}
