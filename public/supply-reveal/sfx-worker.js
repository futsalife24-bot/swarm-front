// 効果音の波形を別スレッドで計算する（重い音は1秒以上かかるので、画面を止めないため）
// 演出で鳴る順に計算する。間に合わない音は画面側でその場で計算することになり、描画が一瞬止まるため
import { IDS, render, DEFAULT_STYLE } from './sfx.js';
// 射出のタップで call・bed・slam が同時に鳴るので最初に。1回目の溜めは1連が charge0、10連が charge1
const ORDER = ['call', 'bed', 'slam', 'fall', 'land', 'land_s', 'charge0', 'charge1', 'promote3', 'pop', 'pop_r', 'charge2', 'promote4', 'charge3', 'promote5', 'charge4', 'hold',
  'open0', 'open1', 'open2', 'open3', 'open4', 'open5', 'whoosh', 'star', 'new', 'done', 'tile', 'ui'];
self.onmessage = (e) => {
  const st = typeof e.data === 'string' ? e.data : DEFAULT_STYLE;
  for (const id of [...ORDER.filter((i) => IDS.includes(i)), ...IDS.filter((i) => !ORDER.includes(i))]) { const [l, r] = render(id, st), L = l.slice(), R = r.slice(); self.postMessage({ id, l: L, r: R }, [L.buffer, R.buffer]); }
  self.postMessage({ done: true });
};
