import { CLIPS } from './reference-scenes.js';

export function eligible(n, m, previewSingle = false) {
  if (typeof n === 'string') return ADOPTED.includes(n) && eligiblePlan(n, m, previewSingle);
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

// The old numeric picker remains available for the original preview scenes.
export const ADOPTED = Object.freeze([
  1, 2, 3, 4, 9, 10,
  'response', 'signature', 'heartbeat', 'multilock', 'sonic',
  'reverse', 'reverseSeal', 'lamp', 'landing', 'delayed', 'skeleton',
]);

const PHASES = new Map([
  [1, 0], [2, 1], [3, 1], [4, 2], [9, 2], [10, 2],
  ['response', 0], ['signature', 0], ['heartbeat', 1],
  ['multilock', 0], ['sonic', 1], ['reverse', 0],
  ['reverseSeal', 0], ['lamp', 0], ['landing', 1],
  ['delayed', 2], ['skeleton', 2], ['last-default', 1],
]);
const BUDDY = new Set([10, 'response', 'signature', 'heartbeat']);
const SSR_WEAPON = new Set([3, 9]);
const TARGETED = new Set([3, 4, 9, 10, 'heartbeat', 'sonic', 'landing', 'delayed', 'skeleton']);

/** Zero-based phase index: launch, landing, then individual opening. */
export function phaseOf(id) {
  if (!PHASES.has(id)) throw Error('未知の確定演出です');
  return PHASES.get(id);
}

function checkModel(m) {
  if (!m || !Array.isArray(m.tiers) || ![1, 10].includes(m.tiers.length)
    || m.multi !== (m.tiers.length === 10)
    || m.tiers.some((tier) => !Number.isInteger(tier) || tier < 0 || tier > 5)
    || (m.multi && m.tiers[9] < 3)) throw Error('補給結果が不正です');
  if (m.initialTiers !== undefined && (!Array.isArray(m.initialTiers)
    || m.initialTiers.length !== m.tiers.length
    || m.initialTiers.some((tier, i) => !Number.isInteger(tier) || tier < 1 || tier > Math.max(1, m.tiers[i])))) {
    throw Error('初期箱色が不正です');
  }
  if (m.multi && m.tiers[9] === 3 && m.initialTiers?.[9] === 1) {
    throw Error('最後枠SRの初期箱色が不正です');
  }
}

function startingTiers(m) {
  const initial = m.initialTiers ? [...m.initialTiers] : m.tiers.map(() => 1);
  if (m.multi && m.tiers[9] === 3 && m.initialTiers === undefined) initial[9] = 2;
  return initial;
}

function targetOf(id, m) {
  if (!TARGETED.has(id)) return null;
  return m.tiers.findIndex((tier) => id === 10 || id === 'heartbeat'
    ? tier === 5 : SSR_WEAPON.has(id) ? tier === 4 : tier >= 4);
}

function eligiblePlan(id, m, previewSingle) {
  if (BUDDY.has(id)) return m.tiers.includes(5);
  if (id === 3 || id === 9) return m.tiers.includes(4);
  if (id === 2 || id === 4) return m.tiers.some((tier) => tier >= 4);
  if (id === 'last-default') return m.multi && m.tiers[9] >= 4;
  return m.tiers.some((tier) => tier >= 4);
}

function multipleAllowed(m) {
  return m.tiers.includes(5) || (m.multi && m.tiers.filter((tier) => tier >= 4).length >= 2);
}

function freezePlan(phases, targets, initialTiers, implicitLast) {
  return Object.freeze({
    phases: Object.freeze(phases),
    targets: Object.freeze(targets),
    initialTiers: Object.freeze(initialTiers),
    implicitLast,
  });
}

/** Reject a plan whose cues or box colors promise more than the finalized result. */
export function validatePlan(m, plan) {
  checkModel(m);
  if (!plan || !Array.isArray(plan.phases) || plan.phases.length !== 3
    || !Array.isArray(plan.targets) || plan.targets.length !== 3
    || !Array.isArray(plan.initialTiers) || plan.initialTiers.length !== m.tiers.length
    || typeof plan.implicitLast !== 'boolean') throw Error('演出計画が不正です');
  const expectedInitial = startingTiers(m);
  if (plan.initialTiers.some((tier, i) => tier !== expectedInitial[i])) throw Error('初期箱色が結果と一致しません');
  const implicit = m.multi && m.tiers[9] >= 4 && expectedInitial[9] === 1;
  if (plan.implicitLast !== implicit || (implicit && plan.phases[1] !== 'last-default')) {
    throw Error('最後枠の確定合図が一致しません');
  }
  let count = 0;
  for (let phase = 0; phase < 3; phase++) {
    const id = plan.phases[phase], target = plan.targets[phase];
    if (id === 0) {
      if (target !== null) throw Error('対象箱の指定が不正です');
      continue;
    }
    if (!PHASES.has(id) || phaseOf(id) !== phase || (id !== 'last-default' && !ADOPTED.includes(id))
      || !eligiblePlan(id, m, false) || (id === 'last-default' && !implicit)
      || target !== targetOf(id, m)) throw Error('確定演出と結果の下限が一致しません');
    count++;
  }
  if (count > 1 && !multipleAllowed(m)) throw Error('複数局面の条件を満たしません');
  return true;
}

/** Build one immutable playback plan without changing the finalized rewards. */
export function choosePlan(m, requested, rng = Math.random, previewSingle = false, enabled = ADOPTED) {
  checkModel(m);
  if (!Array.isArray(enabled) || enabled.some((id) => !ADOPTED.includes(id))) throw Error('演出候補が不正です');
  const initial = startingTiers(m);
  const implicit = m.multi && m.tiers[9] >= 4 && initial[9] === 1;
  const phases = [0, implicit ? 'last-default' : 0, 0];
  const pick = (pool) => {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw Error('演出の乱数が不正です');
    return pool[Math.floor(value * pool.length)];
  };
  if (Array.isArray(requested)) {
    if (requested.length !== 3) throw Error('固定演出計画が不正です');
    for (let i = 0; i < 3; i++) {
      const id = requested[i] || 0;
      if (id && (!enabled.includes(id) || phaseOf(id) !== i)) throw Error('固定演出計画が不正です');
      if (i === 1 && implicit && id) throw Error('最後枠の合図と衝突します');
      if (id) phases[i] = id;
    }
  } else if (requested !== false && requested !== 0 && requested !== undefined) {
    if (!enabled.includes(requested)) throw Error('固定演出計画が不正です');
    const phase = phaseOf(requested);
    if (phase === 1 && implicit) throw Error('最後枠の合図と衝突します');
    phases[phase] = requested;
  } else if (requested === undefined) {
    const candidates = [0, 1, 2].map((phase) => enabled.filter((id) =>
      phaseOf(id) === phase && eligiblePlan(id, m, previewSingle) && !(phase === 1 && implicit)));
    if (multipleAllowed(m)) {
      for (let phase = 0; phase < 3; phase++) if (candidates[phase].length) phases[phase] = pick(candidates[phase]);
    } else if (!implicit) {
      const available = candidates.flat();
      if (available.length) {
        const id = pick(available);
        phases[phaseOf(id)] = id;
      }
    }
  }
  const targets = phases.map((id) => id ? targetOf(id, m) : null);
  const plan = freezePlan(phases, targets, initial, implicit);
  validatePlan(m, plan);
  return plan;
}
