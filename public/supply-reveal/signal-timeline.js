// 結果・初期色・対象箱を確定した計画の描画だけを時刻へ写す。
export function signalLayers(plan, m, t, A) {
  if (!plan) return [];
  const layers = [], B = m.tLaunch, [launch, drop, open] = plan.phases;
  if (launch === 1 && t < B + 0.9) layers.push({ id: 'gold', p: { k: t <= B ? Math.min(1, t / B) : Math.max(0, 1 - (t - B) / 0.5), shock: t <= B ? -1 : (t - B) / 0.9 } });
  if (drop === 2 && t > B && t < B + 2.6) layers.push({ id: 'meteor', p: { t: t - B } });
  if (drop === 3) {
    const p = m.pods[plan.targets[1]], a = t - p.tLand;
    if (a >= 0 && a < 2.8) layers.push({ id: 'crack', p: { a, x: 422 + p.x, gy: p.gy } });
  }
  if ((launch === 'response' || launch === 'signature' || launch === 'lamp' || launch === 'multilock' || launch === 'reverse' || launch === 'reverseSeal') && t <= B + 0.72) {
    layers.push({ id: launch, p: { age: A, release: Math.max(0, t - B), launched: t > B + 0.001 } });
  }
  if (drop === 'heartbeat') {
    const p = m.pods[plan.targets[1]];
    if (p && t >= p.tFall && t < p.tOpen) layers.push({ id: 'heartbeat', p: { index: p.i } });
  }
  if (drop === 'sonic') {
    const p = m.pods[plan.targets[1]];
    if (p && t >= p.tFall && t <= p.tLand + 0.3) layers.push({ id: 'sonic', p: { index: p.i } });
  }
  if (drop === 'landing') {
    const p = m.pods[plan.targets[1]];
    if (p && t >= p.tCall && t < Math.min(p.tOpen, p.tLand + 1.5)) {
      layers.push({ id: 'landing', p: { index: p.i, age: t - p.tCall, landed: t - p.tLand } });
    }
  }
  if (open === 'delayed') {
    const p = m.pods[plan.targets[2]], start = p?.beats?.[0]?.t0;
    if (p && t > start && t < p.tOpen) layers.push({ id: 'delayed', p: { index: p.i, age: t - start } });
  }
  if (open === 'skeleton') {
    const p = m.pods[plan.targets[2]], start = p?.beats?.[0]?.t0;
    if (p && t > start && t < p.tOpen) layers.push({ id: 'skeleton', p: { index: p.i, age: t - start } });
  }
  return layers;
}

export function signalCues(plan, m) {
  const cues = [], [launch, drop, open] = plan.phases, B = m.tLaunch;
  if (launch === 1) cues.push({ t: B + 0.001, id: 'promote4', vol: 0.7 });
  if (drop === 2) for (let i = 0; i < 5; i++) cues.push({ t: B + [0.25, 0.5, 0.8, 1.05, 1.3][i], id: 'whoosh', vol: 0.5, rate: 0.7 + 0.12 * i });
  if (drop === 3) { const p = m.pods[plan.targets[1]]; cues.push({ t: p.tLand, id: 'land' }, { t: p.tLand + 0.02, id: 'promote4', vol: 0.55 }); }
  if (launch === 'response') cues.push({ t: B + 0.015, id: 'sig-response', vol: 0.7 });
  if (launch === 'signature') cues.push(
    { t: B + 0.015, id: 'sig-signature', vol: 0.6 },
  );
  if (launch === 'lamp') cues.push({ t: B + 0.025, id: 'sig-lamp', vol: 0.5 });
  if (launch === 'multilock') [0.36, 0.64, 0.92].forEach((u, i) => cues.push({
    t: B * u, id: 'sig-multilock', vol: 0.55 + 0.1 * i, rate: 1.1 - 0.12 * i,
  }));
  if (launch === 'reverse') cues.push(
    { t: B * 0.28, id: 'sig-reverse', vol: 0.45, rate: 1.15 },
    { t: B * 0.92, id: 'sig-reverse', vol: 0.7, rate: 0.82 },
  );
  if (launch === 'reverseSeal') cues.push(
    { t: B * 0.2, id: 'sig-reverseSeal', vol: 0.48, rate: 1.06 },
    { t: B * 0.58, id: 'sig-reverseSeal', vol: 0.68, rate: 0.86 },
  );
  if (drop === 'heartbeat') {
    const p = m.pods[plan.targets[1]];
    if (p) cues.push(
      { t: p.tFall + 0.025, id: 'sig-heartbeat', vol: 0.4, pan: p.pan },
      { t: p.tLand + 0.045, id: 'sig-heartbeat', vol: 0.75, pan: p.pan },
    );
  }
  if (drop === 'sonic') {
    const p = m.pods[plan.targets[1]];
    if (p) [0.82, 0.92, 0.99].forEach((u, i) => cues.push({
      t: p.tFall + (p.tLand - p.tFall) * u,
      id: 'sig-sonic', vol: 0.72, rate: 0.88 + 0.11 * i, pan: p.pan,
    }));
  }
  if (drop === 'landing') {
    const p = m.pods[plan.targets[1]];
    if (p) cues.push(
      { t: p.tCall + 0.025, id: 'sig-landing-rail', vol: 0.54, pan: p.pan },
      { t: p.tLand + 0.025, id: 'sig-landing-lock', vol: 0.72, pan: p.pan },
    );
  }
  if (open === 'delayed') {
    const p = m.pods[plan.targets[2]], start = p?.beats?.[0]?.t0;
    if (Number.isFinite(start)) cues.push({ t: start + 0.24, id: 'sig-delayed', vol: 0.72, pan: p.pan });
  }
  if (open === 'skeleton') {
    const p = m.pods[plan.targets[2]], start = p?.beats?.[0]?.t0;
    if (Number.isFinite(start)) cues.push(
      { t: start + 0.015, id: 'sig-skeleton-slide', vol: 0.58, pan: p.pan },
      { t: start + 0.34, id: 'sig-skeleton-lock', vol: 0.72, pan: p.pan },
    );
  }
  return cues;
}
