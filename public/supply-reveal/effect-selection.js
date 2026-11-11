import { CLIPS } from './reference-scenes.js';

export function eligible(n, m) {
  const high = m.tiers.some((v) => v >= 4), ssr = m.tiers.includes(4), sr = m.tiers.some((v) => v >= 3);
  return n === 10 ? m.tiers.includes(5)
    : n === 2 || n === 4 ? m.multi && sr
    : n === 3 ? m.multi && ssr
    : n === 1 ? high : ssr;
}

/** 表示候補のみ選ぶ。結果を変更しない。バディの通信優先は既存どおり。 */
export function chooseEffect(m, requested, rng = Math.random) {
  if (requested === false || requested === 0) return 0;
  if (Number.isInteger(requested)) {
    if (requested < 1 || requested > 10 || !eligible(requested, m)) throw Error('確定演出と結果の下限が一致しません');
    return requested;
  }
  if (eligible(10, m)) return 10;
  const pool = CLIPS.map((c) => c.n).filter((n) => eligible(n, m));
  if (!pool.length) return 0;
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw Error('演出の乱数が不正です');
  return pool[Math.floor(value * pool.length)];
}
