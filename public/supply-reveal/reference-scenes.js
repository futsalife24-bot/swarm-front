const c01 = (x) => Math.max(0, Math.min(1, x));

// 10案。seg = { d:秒, a→b:本体の時刻（同じなら止める）, tap:TAPの表示, snd:本体の音をそのまま鳴らす, fx:(seg内の秒, 0〜1) → 重ねる描画, cues:追加の音 }
export const CLIPS = [
  { n: 1, scene: '1:SSR武器', caption: '① 金の射出', sub: '射出のタップ ／ SSR以上が1個以上確定', make: (M) => { const B = M.B; return [
    { d: 0.55, a: 0, b: B, gold: true, fx: (s, u) => ({ id: 'gold', p: { k: u, shock: -1 } }) },
    { d: 1.5, a: B, b: B, tap: true, gold: true, fx: () => ({ id: 'gold', p: { k: 1, shock: -1 } }) },
    { d: 1.9, a: B, b: B + 1.9, snd: true, gold: true, cues: [{ at: 0, id: 'promote4', vol: 0.7 }], fx: (s) => ({ id: 'gold', p: { k: 1 - c01(s / 0.5), shock: s / 0.9 } }) }]; } },
  { n: 2, scene: '10:SSR＋SR', caption: '② 流星群の降下', sub: '降下中 ／ SSR以上が1個以上確定', make: (M) => { const B = M.B; return [
    { d: 0.5, a: B, b: B, tap: true },
    { d: 2.6, a: B, b: B + 2.6, snd: true, cues: [0.25, 0.5, 0.8, 1.05, 1.3].map((at, i) => ({ at, id: 'whoosh', vol: 0.5, rate: 0.7 + 0.12 * i })), fx: (s) => ({ id: 'meteor', p: { t: s } }) }]; } },
  { n: 3, right: true, scene: '10:SSR＋SR', caption: '③ 地割れの着地', sub: '着地 ／ そのポッドがSSR以上確定', make: (M) => { const P = M.pods.find((p) => p.tier === 4), a = M.B + 0.25, b = M.pods[9].tLand + 1.9; return [
    { d: b - a, a, b, snd: true, cues: [{ at: P.tLand - a, id: 'land' }, { at: P.tLand - a + 0.02, id: 'promote4', vol: 0.55 }], fx: (s) => ({ id: 'crack', p: { a: a + s - P.tLand, x: 844 / 2 + P.x, gy: P.gy } }) }]; } },
  { n: 4, scene: '10:SSR＋SR', caption: '④ 目印の先読み', sub: 'タップの前 ／ そのポッドがSR以上確定', make: (M) => { const P = M.pods.find((p) => p.tier === 3), t = P.tStop, pp = { x: 844 / 2 + P.x, gy: P.gy, h: P.h }; return [
    { d: 0.9, a: t, b: t, tap: true },
    { d: 1.7, a: t, b: t, tap: true, cues: [{ at: 0, id: 'lock' }, { at: 0.02, id: 'star', vol: 0.8 }], fx: (s) => ({ id: 'presage', p: { ...pp, k: c01(s / 0.15), a: s } }) },
    { d: 1.3, a: t, b: t + 1.3, snd: true, fx: (s) => ({ id: 'presage', p: { ...pp, k: 1 - c01(s / 0.3), a: 9 } }) }]; } },
  { n: 5, scene: '1:SSR武器', caption: '⑤ 飛び級昇格', sub: '溜めの終わり ／ SSR以上確定（SR+を飛ばす）', make: (M) => { const P = M.pods[0], [b1, b2] = P.beats, pp = { x: 844 / 2, cy: P.gy - P.h / 2 }; return [
    { d: 0.3, a: b1.t0 - 0.3, b: b1.t0 },
    { d: b1.t1 - b1.t0 - 0.01, a: b1.t0, b: b1.t1 - 0.01, snd: true },
    { d: 0.78, a: b2.t1 - 0.004, b: b2.t1 + 0.776, snd: true, cues: [{ at: 0, id: 'slam', vol: 0.7 }], fx: (s) => ({ id: 'skip', p: { ...pp, a: s } }) },
    { d: 0.9, a: b2.t1 + 0.78, b: b2.t1 + 0.78, tap: true, fx: (s) => ({ id: 'skip', p: { ...pp, a: 0.78 + s } }) }]; } },
  { n: 6, scene: '1:SSR武器', caption: '⑥ 再点火', sub: '開封の瞬間 ／ SSR以上確定（灯が消えてから一気に上がる）', make: (M) => { const P = M.pods[0], [b1, b2] = P.beats, pp = { x: 844 / 2, cy: P.gy - P.h / 2 }; return [
    { d: 0.3, a: b1.t0 - 0.3, b: b1.t0 },
    { d: b1.t1 - b1.t0 - 0.01, a: b1.t0, b: b1.t1 - 0.01, snd: true },
    { d: 1.25, a: b1.t0 - 0.05, b: b1.t0 - 0.05, cues: [{ at: 0, id: 'tile', rate: 0.5, vol: 0.9 }], fx: (s) => ({ id: 'relight', p: { ...pp, dark: c01(s / 0.12), t: s, burst: -1 } }) },
    { d: 0.78, a: b2.t1 - 0.004, b: b2.t1 + 0.776, snd: true, cues: [{ at: 0, id: 'slam' }], fx: (s) => ({ id: 'relight', p: { ...pp, dark: 0, t: 0, burst: s } }) },
    { d: 0.8, a: b2.t1 + 0.78, b: b2.t1 + 0.78, tap: true }]; } },
  { n: 7, scene: '1:SSR武器', caption: '⑦ 長押し解放', sub: '最後のタップ ／ SSR以上確定（離した瞬間に開封）', make: (M) => { const P = M.pods[0], t = P.last[0]; return [
    { d: 0.8, a: t, b: t, notap: true, fx: () => ({ id: 'hold', p: { g: 0, rel: -1, press: 0 } }) },
    { d: 1.8, a: t, b: P.tOpen - 0.02, notap: true, cues: [{ at: 0, id: 'charge2' }, { at: 0.45, id: 'charge3' }, { at: 0.85, id: 'charge4' }, { at: 1.2, id: 'hold' }], fx: (s, u) => ({ id: 'hold', p: { g: u, rel: -1, press: 1 } }) },
    { d: 0.25, a: P.tOpen - 0.02, b: P.tOpen - 0.02, notap: true, fx: () => ({ id: 'hold', p: { g: 1, rel: -1, press: 1 } }) },
    { d: 1.4, a: P.tOpen - 0.004, b: P.tOpen + 1.396, snd: true, notap: true, fx: (s) => ({ id: 'hold', p: { g: 1, rel: s, press: 0 } }) }]; } },
  { n: 8, scene: '1:SSR武器', caption: '⑧ 無音と時間停止', sub: '開封の直前 ／ SSR以上確定', make: (M) => { const P = M.pods[0], t = P.hold[0] + 0.42, pp = { x: 844 / 2, cy: P.gy - P.h / 2 }; return [
    { d: t - P.last[0], a: P.last[0], b: t, snd: true },
    { d: 2.0, a: t, b: t, notap: true, fx: (s) => ({ id: 'freeze', p: { ...pp, k: c01(s / 0.12) * (1 - c01((s - 1.9) / 0.1)), a: s } }) },
    { d: P.tOpen - t, a: t, b: P.tOpen - 0.004 },
    { d: 1.4, a: P.tOpen - 0.004, b: P.tOpen + 1.396, snd: true }]; } },
  { n: 9, scene: '1:SSR武器', caption: '⑨ 画面割れ', sub: '開封の瞬間 ／ SSR以上確定（景色が変わったら確定）', make: (M) => { const P = M.pods[0], t = P.tOpen - 0.02, pp = { x: 844 / 2, cy: P.gy - P.h / 2 }; return [
    { d: 0.6, a: P.hold[0], b: t, snd: true },
    { d: 0.55, a: t, b: t, notap: true, cues: [{ at: 0, id: 'land_s', rate: 1.6 }, { at: 0.2, id: 'land_s', rate: 1.9, vol: 0.8 }, { at: 0.38, id: 'land_s', rate: 2.2, vol: 0.8 }], fx: (s, u) => ({ id: 'shatter', p: { ...pp, crack: u, fall: -1 } }) },
    { d: 1.5, a: t, b: t, notap: true, cues: [{ at: 0, id: 'slam' }, { at: 0.02, id: 'open4' }], fx: (s) => ({ id: 'shatter', p: { ...pp, crack: 1, fall: s, snap: s === 0 } }) },
    { d: 1.6, a: P.cut.c0 + 0.1, b: P.cut.c0 + 1.7, cues: [{ at: 0.35, id: 'slam', vol: 0.8 }], fx: () => ({ id: 'dawn', p: { k: 1 } }) }]; } },
  { n: 10, scene: '1:バディ', caption: '⑩ 通信ジャック', sub: 'どの場面でも ／ バディ確定', make: (M) => { const P = M.pods[0], b3 = P.beats[2], t = P.beats[1].t1 + 0.78; return [
    { d: 0.7, a: t, b: t, tap: true },
    { d: 0.45, a: t, b: t, notap: true, cues: [0, 0.05, 0.1, 0.16, 0.24, 0.33].map((at, i) => ({ at, id: 'ui', rate: 0.5 + 0.2 * (i % 3), vol: 1 })), fx: (s) => ({ id: 'jack', p: { g: 1, w: 0, a: 0 } }) },
    { d: 2.6, a: t, b: t, notap: true, cues: [{ at: 0, id: 'whoosh', rate: 0.6 }, { at: 0.05, id: 'call' }], fx: (s) => ({ id: 'jack', p: { g: s < 0.15 ? 1 : 0.12 * (Math.sin(s * 9) > 0.6 ? 1 : 0), w: c01(s / 0.22), a: s } }) },
    { d: 0.3, a: t, b: t, notap: true, fx: (s, u) => ({ id: 'jack', p: { g: 1, w: 1 - u, a: 3 } }) },
    { d: 1.3, a: b3.t1 - 0.004, b: b3.t1 + 1.296, snd: true }]; } },
];
