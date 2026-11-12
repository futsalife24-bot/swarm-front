// 確定演出10案の「実装イメージ」用の試作レイヤー（2026-11-11）。
// 本体の演出（gacha.js）の上に、案ごとの描画を重ねるだけ。時間軸・結果・操作には組み込んでいない。
// kakutei-preview.mjs が場面ごとに set() で状態を渡し、seek() のたびに draw() が呼ばれる。
const H = 390, TAU = Math.PI * 2;
const GOLD = '#ffc94d', PURPLE = '#b28cff', TEAL = '#6fffd2', NEUTRAL = '#57c7d4';
const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x), out3 = (x) => 1 - (1 - c01(x)) ** 3;
const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
const rgba = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')},${c01(a).toFixed(3)})`;
let st = null, cap = null, snap = null, buddy = null, targetRoot = null;
let buddyArts = new Map();
const BUDDY_ARTS = ['b-tatara', 'b-yosuga', 'b-tobari', 'b-oriha'];
const COMMON_LINES = ['……きこえる？', 'そっちへ行く。'];
const BUDDY_LINES = {
  'b-tatara': ['準備できた。', 'そっちへ行く。'],
  'b-yosuga': ['……見つけた。', '待ってて。'],
  'b-tobari': ['聞こえたよ。', 'すぐそばに。'],
  'b-oriha': ['つながった。', '会いに行くね。'],
};
let buddyLines = COMMON_LINES;
const world = (g, I) => g.setTransform(I.S * I.cam.z, 0, 0, I.S * I.cam.z, I.S * (I.VW / 2 - I.cam.x * I.cam.z + I.sh.x), I.S * (H / 2 - I.cam.y * I.cam.z + I.sh.y));
const screen = (g, I) => g.setTransform(I.S, 0, 0, I.S, 0, 0);
const add = (g) => { g.globalCompositeOperation = 'lighter'; }, over = (g) => { g.globalCompositeOperation = 'source-over'; };
const glow = (g, x, y, r, col, a) => { if (a <= 0.004 || r <= 0) return; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba('#ffffff', a)); gr.addColorStop(0.2, rgba(col, a * 0.9)); gr.addColorStop(0.55, rgba(col, a * 0.3)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); };
const ring = (g, x, y, r, col, a, lw, sy = 1) => { if (a <= 0.004 || r <= 0) return; g.save(); g.translate(x, y); g.scale(1, sy); g.strokeStyle = rgba(col, a); g.lineWidth = lw; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); g.restore(); };
// ぎざぎざの線（ひび）。seed で形が決まる
const jag = (g, x0, y0, an, len, seed, sy = 1, steps = 9) => { g.beginPath(); g.moveTo(x0, y0); let x = x0, y = y0, a = an; for (let i = 1; i <= steps; i++) { a = an + (hash(seed, i) - 0.5) * 0.9; x += Math.cos(a) * len / steps; y += Math.sin(a) * len / steps * sy; g.lineTo(x, y); } g.stroke(); return [x, y]; };

const FX = {
  // 1 金の射出：標的と光の柱が金色になり、タップで金の衝撃波が地平線まで走る
  gold(g, I, p) {
    const cx = I.VW / 2, gy = I.m.multi ? 268 : 306, pu = 0.5 + 0.5 * Math.sin(I.A * 4.5); world(g, I); add(g);
    glow(g, cx, gy - 30, 260 + 30 * pu, GOLD, 0.55 * p.k); g.fillStyle = rgba(GOLD, 0.55 * p.k); g.fillRect(cx - 3, -100, 6, gy + 100); glow(g, cx, gy, 90, '#fff2c0', 0.7 * p.k);
    for (let i = 0; i < 3; i++) { const u = (I.A * 0.55 + i / 3) % 1; ring(g, cx, gy, 70 + 230 * u, GOLD, p.k * 0.8 * (1 - u), 2.5, 0.3); }
    g.save(); g.translate(cx, gy); g.scale(1, 0.3); g.strokeStyle = rgba('#fff2c0', 0.9 * p.k); g.lineWidth = 3; g.setLineDash([22, 12]); g.lineDashOffset = -I.A * 50; g.beginPath(); g.arc(0, 0, 120 + 8 * pu, 0, TAU); g.stroke(); g.setLineDash([]); g.restore();
    for (let i = 0; i < 24; i++) { const u = (I.A * (0.25 + 0.3 * hash(i, 1)) + hash(i, 2)) % 1; glow(g, cx + (hash(i, 3) - 0.5) * 300, gy - u * 240, 5 + 6 * hash(i, 4), GOLD, p.k * (1 - u) * 0.9); } // 舞い上がる金の粒
    if (p.shock >= 0 && p.shock < 1) { const s = p.shock; ring(g, cx, gy, 80 + 900 * out3(s), '#fff2c0', 1 - s, 10 * (1 - s) + 1, 0.3); ring(g, cx, gy, 60 + 620 * out3(s), GOLD, 0.8 * (1 - s), 6 * (1 - s) + 1, 0.3);
      const gr = g.createLinearGradient(0, 96, 0, 140); gr.addColorStop(0, rgba(GOLD, 0)); gr.addColorStop(0.5, rgba('#fff2c0', 0.9 * (1 - s))); gr.addColorStop(1, rgba(GOLD, 0)); g.fillStyle = gr; g.fillRect(-100, 96, I.VW + 200, 44);
      screen(g, I); g.fillStyle = rgba(GOLD, 0.28 * (1 - s)); g.fillRect(0, 0, I.VW, H); }
    over(g);
  },
  // 2 流星群の降下：ポッドより先に流れ星が降り、空が段階の色に染まる
  meteor(g, I, p) {
    screen(g, I); add(g); const k = c01(p.t * 3) * (1 - c01((p.t - 1.9) * 2));
    const gr = g.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, rgba(PURPLE, 0.42 * k)); gr.addColorStop(1, rgba(PURPLE, 0)); g.fillStyle = gr; g.fillRect(0, 0, I.VW, 200);
    for (let i = 0; i < 46; i++) { const s0 = hash(i, 1) * 1.5, life = 0.32 + 0.3 * hash(i, 5), u = (p.t - s0) / life; if (u < 0 || u > 1) continue;
      const big = i % 7 === 0, x0 = I.VW * (0.15 + 1.05 * hash(i, 2)), y0 = -20 + 60 * hash(i, 3), dx = -(260 + 240 * hash(i, 4)) * (big ? 1.5 : 1), dy = (150 + 130 * hash(i, 6)) * (big ? 1.7 : 1), x = x0 + dx * u, y = y0 + dy * u, L = big ? 0.3 : 0.2;
      const lg = g.createLinearGradient(x, y, x - dx * L, y - dy * L); lg.addColorStop(0, rgba('#ffffff', 0.95 * (1 - u * 0.5))); lg.addColorStop(0.3, rgba(PURPLE, 0.7)); lg.addColorStop(1, rgba(PURPLE, 0)); g.strokeStyle = lg; g.lineWidth = big ? 3.4 : 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - dx * L, y - dy * L); g.stroke(); glow(g, x, y, big ? 16 : 8, PURPLE, 0.9 * (1 - u * 0.5)); }
    over(g);
  },
  // 3 地割れの着地：そのポッドだけ地面が割れ、割れ目から金の光が漏れる
  crack(g, I, p) {
    if (p.a < 0) return; world(g, I); add(g); const k = out3(p.a / 0.3), fade = 1 - c01((p.a - 2.2) / 0.6), pu = 0.75 + 0.25 * Math.sin(I.A * 6);
    glow(g, p.x, p.gy - 30, 190, GOLD, 0.5 * fade * pu * c01(p.a * 6)); g.save(); g.translate(p.x, p.gy); g.scale(1, 0.3); glow(g, 0, 0, 260, GOLD, 0.6 * fade); g.restore();
    for (let i = 0; i < 11; i++) { const an = i * TAU / 11 + (hash(i, 7) - 0.5) * 0.4, len = (150 + 190 * hash(i, 8)) * k;
      g.strokeStyle = rgba(GOLD, 0.4 * fade * pu); g.lineWidth = 9; g.lineJoin = 'round'; const [ex, ey] = jag(g, p.x, p.gy, an, len, i * 13 + 1, 0.32); g.strokeStyle = rgba('#fff6d6', 0.95 * fade); g.lineWidth = 2.2; jag(g, p.x, p.gy, an, len, i * 13 + 1, 0.32);
      if (i % 2 === 0) { g.lineWidth = 1.4; jag(g, (p.x + ex) / 2, (p.gy + ey) / 2, an + 0.8, len * 0.4, i * 13 + 5, 0.32, 5); } }
    if (p.a < 0.7) { ring(g, p.x, p.gy, 60 + 520 * out3(p.a / 0.7), '#fff2c0', 1 - p.a / 0.7, 8 * (1 - p.a / 0.7) + 1, 0.3); screen(g, I); g.fillStyle = rgba(GOLD, 0.3 * Math.exp(-p.a * 7)); g.fillRect(0, 0, I.VW, H); world(g, I); }
    for (let i = 0; i < 26; i++) { const u = ((p.a * (0.35 + 0.4 * hash(i, 1))) + hash(i, 2)) % 1; glow(g, p.x + (hash(i, 3) - 0.5) * 320, p.gy - u * 150 + (hash(i, 9) - 0.5) * 30, 4 + 5 * hash(i, 4), GOLD, fade * (1 - u) * c01(p.a * 3)); } // 割れ目から立ちのぼる光
    over(g);
  },
  // 4 目印の先読み：次に開けるポッドの▼と輪が紫に変わり、火花が散る
  presage(g, I, p) {
    world(g, I); add(g); const w = p.h * 1.073, kk = p.h / 168, cy = p.gy - p.h * 0.5, pu = 0.5 + 0.5 * Math.sin(I.A * 7), k = p.k;
    glow(g, p.x, cy, w * (1.5 + 0.2 * pu), PURPLE, 0.55 * k);
    g.save(); g.translate(p.x, p.gy - 2 * kk); g.scale(1, 0.3); g.strokeStyle = rgba('#e9dcff', 0.95 * k); g.lineWidth = 4 * kk + 1; g.setLineDash([16 * kk, 10 * kk]); g.lineDashOffset = -I.A * 110; g.beginPath(); g.arc(0, 0, w * (0.82 + 0.06 * pu), 0, TAU); g.stroke(); g.setLineDash([]); g.lineWidth = 2; g.strokeStyle = rgba(PURPLE, 0.8 * k); g.beginPath(); g.arc(0, 0, w * 1.05, 0, TAU); g.stroke(); g.restore();
    over(g); const ay = p.gy - p.h - 20 * kk - 9 * kk * pu; g.fillStyle = rgba('#d9c4ff', k); g.strokeStyle = rgba('#3a1f6e', k); g.lineWidth = 2; g.beginPath(); g.moveTo(p.x - 17 * kk, ay - 17 * kk); g.lineTo(p.x + 17 * kk, ay - 17 * kk); g.lineTo(p.x, ay + 4 * kk); g.closePath(); g.fill(); g.stroke(); add(g);
    if (p.a >= 0 && p.a < 0.6) { ring(g, p.x, cy, w * (0.4 + 1.6 * out3(p.a / 0.5)), PURPLE, 1 - p.a / 0.5, 5 * (1 - p.a / 0.5) + 1, 0.8);
      for (let i = 0; i < 20; i++) { const an = hash(i, 1) * TAU, sp = 90 + 220 * hash(i, 2), d = (1 - Math.exp(-4 * p.a)) / 4; glow(g, p.x + Math.cos(an) * sp * d, cy + Math.sin(an) * sp * d + 150 * p.a * p.a, 6, i % 3 ? PURPLE : '#ffffff', (1 - p.a / 0.6) ** 1.3); } }
    for (let i = 0; i < 8; i++) { const u = ((I.A * 0.8) + hash(i, 5)) % 1, an = hash(i, 6) * TAU; glow(g, p.x + Math.cos(an) * w * 0.8, p.gy - 4 - u * p.h * 1.1, 4, PURPLE, k * (1 - u)); }
    over(g);
  },
  // 5 飛び級昇格：稲光とともに一気に金へ
  skip(g, I, p) {
    world(g, I); const a = p.a, kk = 1;
    if (a < 0.6) { const u = a / 0.6; add(g); g.strokeStyle = rgba('#ffffff', 1 - u); g.lineWidth = 5 * (1 - u) + 1; jag(g, p.x + 6, p.cy - 130, Math.PI / 2, 260, 3, 1, 7); glow(g, p.x, p.cy, 300, GOLD, 0.6 * Math.exp(-a * 6)); over(g); }
  },
  // 6 再点火：灯が消えて静まり、一拍おいて内側から一気に上がる
  relight(g, I, p) {
    screen(g, I);
    if (p.dark > 0) { g.fillStyle = `rgba(0,2,4,${(0.8 * p.dark).toFixed(3)})`; g.fillRect(0, 0, I.VW, H); g.font = '700 22px "Yu Gothic", sans-serif'; g.textAlign = 'center'; g.fillStyle = rgba('#8fa3a8', 0.8 * p.dark * c01((p.t - 0.35) * 3)); g.fillText('………', I.VW / 2, 110);
      if (p.t > 0.75) { world(g, I); add(g); const q = c01((p.t - 0.75) / 0.35); glow(g, p.x, p.cy, 30 + 60 * q, GOLD, 0.9 * q * (0.6 + 0.4 * Math.sin(I.A * 40))); g.strokeStyle = rgba('#fff2c0', q); g.lineWidth = 2; for (let i = 0; i < 5; i++) jag(g, p.x, p.cy, i * TAU / 5 + 0.4, 70 * q, i + 20, 1, 5); over(g); } } // 内側から漏れ始める光
    if (p.burst >= 0) { const a = p.burst; world(g, I); add(g); glow(g, p.x, p.cy, 420, GOLD, 0.9 * Math.exp(-a * 4)); for (let i = 0; i < 3; i++) ring(g, p.x, p.cy, 60 + (500 + 200 * i) * out3(a / 0.7), i ? GOLD : '#ffffff', 1 - c01(a / 0.7), 8 * (1 - c01(a / 0.7)) + 1, 0.85);
      for (let i = 0; i < 40; i++) { const an = hash(i, 1) * TAU, sp = 200 + 700 * hash(i, 2), d = (1 - Math.exp(-3 * a)) / 3; glow(g, p.x + Math.cos(an) * sp * d, p.cy + Math.sin(an) * sp * d * 0.8, 7, i % 3 ? GOLD : '#ffffff', (1 - c01(a / 0.9)) ** 1.3); }
      screen(g, I); g.fillStyle = rgba('#fff2c0', 0.4 * Math.exp(-a * 9)); g.fillRect(0, 0, I.VW, H); over(g); }
  },
  // 7 長押し解放：押している間、光と輪がせり上がり、離した瞬間に開封
  hold(g, I, p) {
    screen(g, I); const cx = I.VW / 2, cy = 336, G = p.g;
    if (p.rel < 0) { add(g); const gr = g.createRadialGradient(cx, H / 2, 120, cx, H / 2, I.VW * 0.6); gr.addColorStop(0, rgba(GOLD, 0)); gr.addColorStop(1, rgba(GOLD, 0.5 * G * G)); g.fillStyle = gr; g.fillRect(0, 0, I.VW, H);
      for (let i = 0; i < 30; i++) { const u = ((I.A * (0.6 + G)) + hash(i, 1)) % 1, an = hash(i, 2) * TAU, R = 330 * (1 - u); glow(g, cx + Math.cos(an) * R, 200 + Math.sin(an) * R * 0.6, 5, GOLD, G * u); } over(g); // 吸い込まれる光
      const jx = (hash(Math.floor(I.A * 60), 3) - 0.5) * 5 * G * G, jy = (hash(Math.floor(I.A * 60), 4) - 0.5) * 5 * G * G;
      g.fillStyle = 'rgba(2,8,12,.78)'; g.beginPath(); g.arc(cx + jx, cy + jy, 40, 0, TAU); g.fill(); g.strokeStyle = rgba('#3a555c', 1); g.lineWidth = 7; g.beginPath(); g.arc(cx + jx, cy + jy, 33, 0, TAU); g.stroke();
      g.strokeStyle = rgba(G > 0.98 ? '#ffffff' : GOLD, 1); g.lineCap = 'round'; g.beginPath(); g.arc(cx + jx, cy + jy, 33, -Math.PI / 2, -Math.PI / 2 + TAU * G); g.stroke(); g.lineCap = 'butt';
      g.fillStyle = rgba('#ffffff', 0.35 + 0.5 * (p.press ? 1 : 0)); g.beginPath(); g.arc(cx + jx, cy + jy, p.press ? 17 : 21, 0, TAU); g.fill();
      g.font = '800 17px "Yu Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.8)'; const txt = G > 0.98 ? '離せ！' : p.press ? '押し続けろ！' : '長押し'; g.strokeText(txt, cx, cy - 56); g.fillStyle = rgba(G > 0.98 ? '#ffffff' : '#ffe9a8', 1); g.fillText(txt, cx, cy - 56);
    } else if (p.rel < 0.6) { add(g); ring(g, cx, cy, 33 + 700 * out3(p.rel / 0.6), '#fff2c0', 1 - p.rel / 0.6, 7 * (1 - p.rel / 0.6) + 1, 1); over(g); }
  },
  // 8 無音と時間停止：色が抜けてポッドだけ色が残り、火花が空中で止まる
  freeze(g, I, p) {
    const px = (p.x - I.cam.x) * I.cam.z + I.VW / 2, py = (p.cy - I.cam.y) * I.cam.z + H / 2, k = p.k; screen(g, I);
    g.save(); g.beginPath(); g.rect(0, 0, I.VW, H); g.arc(px, py, 118, 0, TAU, true); g.clip('evenodd'); g.globalCompositeOperation = 'saturation'; g.fillStyle = `rgba(128,128,128,${k.toFixed(3)})`; g.fillRect(0, 0, I.VW, H); g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(0,0,0,${(0.42 * k).toFixed(3)})`; g.fillRect(0, 0, I.VW, H); g.restore();
    add(g); for (let i = 0; i < 46; i++) { const an = hash(i, 1) * TAU, R = 90 + 260 * hash(i, 2), dr = p.a * 2.5; glow(g, px + Math.cos(an) * (R + dr), py + Math.sin(an) * (R + dr) * 0.7, 3 + 5 * hash(i, 3), i % 4 ? GOLD : '#ffffff', 0.9 * k); } // 空中で止まった火花（ごくゆっくり動く）
    const hb = (p.a % 0.85) / 0.85; ring(g, px, py, 110 + 260 * out3(hb), '#ffffff', 0.55 * k * (1 - hb), 2.5, 1); glow(g, px, py, 150, GOLD, 0.35 * k * Math.exp(-hb * 6)); over(g); // 鼓動
    g.fillStyle = `rgba(0,0,0,${k.toFixed(3)})`; g.fillRect(0, 0, I.VW, 26 * k); g.fillRect(0, H - 26 * k, I.VW, 26 * k); // 上下の帯（映画の画面）
  },
  // 押した座標を保持し、押すたびに全てのひびを画面の端まで伸ばす。
  fracture(g, I, p) {
    screen(g, I); const count = p.points.length, length = Math.hypot(I.VW, H) * (0.22 + count * 0.24);
    for (let j = 0; j < count; j++) {
      const point = p.points[j], x = point.x * I.VW, y = point.y * H;
      add(g); glow(g, x, y, 35, '#ffffff', 0.4); g.lineJoin = 'round';
      for (let i = 0; i < 12; i++) {
        const an = i * TAU / 12 + (hash(i, j + 4) - 0.5) * 0.25, len = length * (0.65 + hash(i, j + 9) * 0.35);
        g.strokeStyle = rgba('#b5e7ff', 0.3); g.lineWidth = 4; jag(g, x, y, an, len, i * 17 + j, 1, 9);
        g.strokeStyle = rgba('#ffffff', 0.9); g.lineWidth = 1.1; jag(g, x, y, an, len, i * 17 + j, 1, 9);
      }
      over(g);
    }
  },
  // 9 画面割れ：画面がガラスのように割れて砕け、向こうに金色の夜明けが現れる
  shatter(g, I, p) {
    const W = I.cv.width, Hh = I.cv.height, px = p.screenPoint ? p.screenPoint.x * W : ((p.x - I.cam.x) * I.cam.z + I.VW / 2) * I.S, py = p.screenPoint ? p.screenPoint.y * Hh : ((p.cy - I.cam.y) * I.cam.z + H / 2) * I.S;
    if (p.fall < 0) { g.setTransform(1, 0, 0, 1, 0, 0); add(g); glow(g, px, py, 130 * I.S * p.crack, '#ffffff', 0.8 * p.crack); g.lineJoin = 'round';
      for (let i = 0; i < 16; i++) { const an = i * TAU / 16 + (hash(i, 3) - 0.5) * 0.3, len = W * 0.75 * out3(p.crack) * (0.6 + 0.4 * hash(i, 4)); g.strokeStyle = rgba('#ffffff', 0.35); g.lineWidth = 5 * I.S; const [ex, ey] = jag(g, px, py, an, len, i * 7 + 2, 1, 10); g.strokeStyle = rgba('#ffffff', 0.95); g.lineWidth = 1.3 * I.S; jag(g, px, py, an, len, i * 7 + 2, 1, 10); if (i % 2) jag(g, (px + ex) / 2, (py + ey) / 2, an + 1.1, len * 0.3, i + 40, 1, 5); }
      for (let r = 1; r <= 3; r++) { g.beginPath(); for (let i = 0; i <= 16; i++) { const an = i * TAU / 16, rr = r * 90 * I.S * p.crack * (0.85 + 0.3 * hash(i % 16, r)); i ? g.lineTo(px + Math.cos(an) * rr, py + Math.sin(an) * rr) : g.moveTo(px + Math.cos(an) * rr, py + Math.sin(an) * rr); } g.strokeStyle = rgba('#ffffff', 0.6); g.lineWidth = I.S; g.stroke(); } over(g); return; }
    if (p.snap || !snap) { if (p.points) FX.fracture(g, I, { points: p.points }); snap = document.createElement('canvas'); snap.width = W; snap.height = Hh; snap.getContext('2d').drawImage(I.cv, 0, 0); }
    // 向こう側：金色の夜明け
    screen(g, I); const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#140b2a'); sky.addColorStop(0.42, '#7a3a2a'); sky.addColorStop(0.6, '#ffb24d'); sky.addColorStop(0.66, '#fff0b8'); sky.addColorStop(0.7, '#5a3410'); sky.addColorStop(1, '#120a04'); g.fillStyle = sky; g.fillRect(0, 0, I.VW, H);
    add(g); glow(g, I.VW / 2, 250, 330, GOLD, 0.95); g.fillStyle = rgba('#fff2c0', 0.16); for (let i = 0; i < 18; i++) { const an = -Math.PI + i * Math.PI / 17 + 0.04 * Math.sin(I.A * 0.6 + i), w = 0.03 + 0.03 * hash(i, 1); g.beginPath(); g.moveTo(I.VW / 2, 250); g.lineTo(I.VW / 2 + Math.cos(an - w) * 900, 250 + Math.sin(an - w) * 900); g.lineTo(I.VW / 2 + Math.cos(an + w) * 900, 250 + Math.sin(an + w) * 900); g.fill(); }
    for (let i = 0; i < 40; i++) { const u = ((I.A * (0.08 + 0.1 * hash(i, 1))) + hash(i, 2)) % 1; glow(g, hash(i, 3) * I.VW, H - u * H, 3 + 4 * hash(i, 4), '#fff2c0', 0.8 * Math.sin(Math.PI * u)); } over(g);
    // 砕けて落ちる破片（割れる直前の画面を三角形に切って落とす）
    g.setTransform(1, 0, 0, 1, 0, 0); const NX = 9, NY = 5, P = (i, j) => [i === 0 ? 0 : i === NX ? W : (i + (hash(i, j) - 0.5) * 0.7) * W / NX, j === 0 ? 0 : j === NY ? Hh : (j + (hash(i + 9, j) - 0.5) * 0.7) * Hh / NY];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
      for (const tri of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) { const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3, dist = Math.hypot(cx - px, cy - py) / W, la = p.fall - dist * 0.55, sd = i * 31 + j * 7 + (tri[1] === q[1] ? 0 : 3); if (la > 1.0) continue;
        g.save(); if (la > 0) { g.translate(cx + (cx - px) * 0.9 * la + (hash(sd, 1) - 0.5) * 120 * la * I.S, cy + (cy - py) * 0.5 * la + 1500 * la * la * I.S * 0.5); g.rotate((hash(sd, 2) - 0.5) * 5 * la); g.scale(1 - 0.3 * la, 1 - 0.3 * la); g.translate(-cx, -cy); g.globalAlpha = 1 - c01((la - 0.55) / 0.45); }
        g.beginPath(); g.moveTo(tri[0][0], tri[0][1]); g.lineTo(tri[1][0], tri[1][1]); g.lineTo(tri[2][0], tri[2][1]); g.closePath(); g.save(); g.clip(); g.drawImage(snap, 0, 0); g.restore(); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.2 * I.S; g.stroke(); g.restore(); } }
    g.setTransform(1, 0, 0, 1, 0, 0); add(g); g.fillStyle = rgba('#fff6d6', 0.75 * Math.exp(-p.fall * 9)); g.fillRect(0, 0, W, Hh); over(g);
  },
  // 9 の続き：景色が変わったまま、カットインへ
  dawn(g, I, p) { screen(g, I); add(g); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, rgba('#ff9a3c', 0.32 * p.k)); gr.addColorStop(0.5, rgba(GOLD, 0.1 * p.k)); gr.addColorStop(1, rgba('#ff9a3c', 0.3 * p.k)); g.fillStyle = gr; g.fillRect(0, 0, I.VW, H); over(g); },
  // 10 通信ジャック：画面が乱れ、通信窓が割り込んでバディの影が映る
  jack(g, I, p) {
    const W = I.cv.width, Hh = I.cv.height, fr = Math.floor(I.A * 30); g.setTransform(1, 0, 0, 1, 0, 0);
    if (p.g > 0) { for (let i = 0; i < 12; i++) { const y = Math.floor(hash(i, fr) * Hh), hh = Math.floor((0.02 + 0.08 * hash(i + 3, fr)) * Hh), dx = (hash(i + 5, fr) - 0.5) * 220 * I.S * p.g; g.drawImage(I.cv, 0, y, W, hh, dx, y, W, hh); }
      add(g); for (let i = 0; i < 7; i++) { g.fillStyle = rgba(i % 2 ? TEAL : '#ff5fa8', 0.4 * p.g); g.fillRect(0, hash(i + 20, fr) * Hh, W, (2 + 14 * hash(i + 30, fr)) * I.S); } over(g); }
    screen(g, I); g.fillStyle = `rgba(0,6,6,${(0.6 * p.w).toFixed(3)})`; g.fillRect(0, 0, I.VW, H);
    if (p.w > 0.02) { const ww = 430, wh = 196 * p.w, x0 = I.VW / 2 - ww / 2, y0 = 200 - wh / 2; g.fillStyle = 'rgba(2,14,13,.95)'; g.fillRect(x0, y0, ww, wh); g.save(); g.beginPath(); g.rect(x0, y0, ww, wh); g.clip();
      add(g); glow(g, x0 + 110, 200, 150, TEAL, 0.35); over(g);
      if (buddy && buddy.complete) { const bh = 176, bw = bh * buddy.naturalWidth / buddy.naturalHeight, jx = (hash(fr, 9) - 0.5) * 6; g.drawImage(buddy, x0 + 110 - bw / 2 + jx, 200 - bh / 2 + 4, bw, bh); } // 影だけ（誰かは見せない）
      g.fillStyle = 'rgba(111,255,210,.07)'; for (let y = y0; y < y0 + wh; y += 4) g.fillRect(x0, y, ww, 1.4); const sy = y0 + ((I.A * 90) % 196); g.fillStyle = 'rgba(111,255,210,.14)'; g.fillRect(x0, sy, ww, 14);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = '700 13px "GX Rajdhani", sans-serif'; g.fillStyle = rgba(TEAL, 0.9); g.fillText('UNKNOWN SIGNAL  ///  CH-07', x0 + 216, 132); g.fillStyle = rgba('#ff5fa8', 0.5 + 0.5 * Math.sin(I.A * 10)); g.fillText('● REC', x0 + ww - 60, 132);
      const msg = buddyLines[0], n = Math.floor(c01((p.a - 0.4) / 0.9) * msg.length); g.font = '800 26px "Yu Gothic", sans-serif'; g.fillStyle = '#eafff8'; g.fillText(msg.slice(0, n), x0 + 216, 188);
      if (p.a > 1.5) { g.font = '700 15px "Yu Gothic", sans-serif'; g.fillStyle = rgba(TEAL, c01((p.a - 1.5) * 4)); g.fillText(buddyLines[1], x0 + 216, 218); }
      g.fillStyle = rgba(TEAL, 0.85); for (let i = 0; i < 26; i++) { const hh = 4 + 26 * Math.abs(Math.sin(I.A * (6 + i * 0.7) + i)) * (p.a > 0.4 ? 1 : 0.2); g.fillRect(x0 + 216 + i * 7, 262 - hh, 4, hh); }
      g.restore(); g.strokeStyle = rgba(TEAL, 0.95); g.lineWidth = 2; g.strokeRect(x0, y0, ww, wh); add(g); g.strokeStyle = rgba(TEAL, 0.3); g.lineWidth = 8; g.strokeRect(x0, y0, ww, wh); over(g); }
  },
};
export async function install(reveal, assetBase, isReduced = () => false) {
  targetRoot = reveal.root;
  buddy = null; buddyArts = new Map(); buddyLines = COMMON_LINES;
  targetRoot.dataset.jackArt = ''; targetRoot.dataset.jackLine = buddyLines[0]; targetRoot.dataset.jackReply = buddyLines[1];
  cap = document.createElement('div'); cap.className = 'kx-cap'; cap.hidden = true; targetRoot.appendChild(cap);
  const s = document.createElement('style'); s.textContent = '.gx-root .kx-cap{position:absolute;left:14px;bottom:12px;z-index:97;padding:6px 14px 6px 12px;font:700 15px/1.5 "Yu Gothic","Hiragino Sans",sans-serif;color:#fff;background:rgba(0,0,0,.72);border-left:4px solid #ffc94d;white-space:pre;pointer-events:none}.gx-root .kx-cap[hidden]{display:none}.gx-root .kx-cap small{display:block;font-size:11px;font-weight:600;color:#ffe9a8}'
    + '.gx-root.kx-gold .gx-launch b{color:#fff7d8!important;-webkit-text-stroke:2px #342000;paint-order:stroke fill;text-shadow:0 3px 4px #000,0 0 10px #000,0 0 18px #000!important}.gx-root.kx-gold .gx-launch small{color:#fff2c0!important;border-color:rgba(255,201,77,.8)!important}.gx-root.kx-notap .gx-tap{display:none!important}.gx-root.kx-right .kx-cap{left:auto;right:14px}'; document.head.appendChild(s);
  // 全バディの絵を先に黒緑の影へ変換し、選ばれた個体だけ表示する。
  await Promise.all(BUDDY_ARTS.map(async (art) => {
    const im = new Image(); im.src = assetBase + art + '.webp';
    await new Promise((r) => { im.onload = im.onerror = r; });
    if (!im.naturalWidth || !im.naturalHeight) return;
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#062822'; g.fillRect(0, 0, c.width, c.height);
    const silhouette = new Image(); silhouette.src = c.toDataURL();
    await new Promise((r) => { silhouette.onload = silhouette.onerror = r; });
    if (silhouette.naturalWidth && silhouette.naturalHeight) buddyArts.set(art, silhouette);
  }));
  reveal.setOnDraw((g, I) => { if (st && st.id && FX[st.id] && (st.id === 'crack' ? I.phase === 'beforePods' : I.phase === 'afterPods')) FX[st.id](g, isReduced() ? { ...I, A: 0 } : I, st.p || {}); });
  return () => { reveal.setOnDraw(null); set(null); cap?.remove(); s.remove(); cap = null; delete targetRoot.dataset.jackArt; delete targetRoot.dataset.jackLine; delete targetRoot.dataset.jackReply; targetRoot = null; buddy = null; buddyLines = COMMON_LINES; buddyArts.clear(); };
}
export function setBuddyArt(art) {
  buddy = buddyArts.get(art) || null;
  buddyLines = Object.hasOwn(BUDDY_LINES, art) ? BUDDY_LINES[art] : COMMON_LINES;
  if (targetRoot) {
    targetRoot.dataset.jackArt = buddy ? art : '';
    targetRoot.dataset.jackLine = buddyLines[0];
    targetRoot.dataset.jackReply = buddyLines[1];
  }
}
export function set(s) { st = s; if (!s) snap = null; if (cap) { cap.innerHTML = s && s.caption ? `${s.caption}<small>${s.sub || ''}</small>` : ''; cap.hidden = !cap.innerHTML; } targetRoot?.classList.toggle('kx-gold', !!(s && s.gold)); targetRoot?.classList.toggle('kx-notap', !!(s && s.notap)); targetRoot?.classList.toggle('kx-right', !!(s && s.right)); }
export function reset() { snap = null; }
