// 確定済みの表示予定だけを描く。呼出元のCanvas状態を変えない。
const H = 390, TAU = Math.PI * 2, TEAL = '#6fffd2', PINK = '#ff5fa8';
const clamp = (v) => Math.max(0, Math.min(1, v));
const out = (v) => 1 - (1 - clamp(v)) ** 3;
const screen = (g, I) => g.setTransform(I.S, 0, 0, I.S, 0, 0);
const world = (g, I) => g.setTransform(I.S * I.cam.z, 0, 0, I.S * I.cam.z,
  I.S * (I.VW / 2 - I.cam.x * I.cam.z + I.sh.x),
  I.S * (H / 2 - I.cam.y * I.cam.z + I.sh.y));

function rings(g, x, y, size, alpha = 1) {
  g.strokeStyle = `rgba(111,255,210,${alpha})`; g.lineWidth = 2;
  for (const dx of [-size * 0.3, size * 0.3]) {
    g.beginPath(); g.arc(x + dx, y, size * 0.26, 0, TAU); g.stroke();
  }
  g.fillStyle = `rgba(255,95,168,${alpha})`;
  g.beginPath(); g.arc(x, y + size * 0.22, Math.max(2, size * 0.07), 0, TAU); g.fill();
}

function buddyLabel(g, x, y, width, height, alpha = 1) {
  g.fillStyle = `rgba(2,22,27,${0.82 * alpha})`;
  g.strokeStyle = `rgba(111,255,210,${0.9 * alpha})`; g.lineWidth = 1.3;
  g.beginPath(); g.roundRect(x, y, width, height, 5); g.fill(); g.stroke();
  rings(g, x + 16, y + height / 2, 27, alpha);
  g.font = '700 11px "GX Rajdhani", "Yu Gothic", sans-serif';
  g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = `rgba(234,255,249,${alpha})`;
  g.fillText('BUDDY', x + 36, y + height / 2 + 0.5);
}

function waveRing(g, x, y, r, alpha, sy = 1) {
  g.strokeStyle = `rgba(111,255,210,${clamp(alpha)})`; g.lineWidth = 2.3;
  g.beginPath();
  for (let i = 0; i <= 96; i++) {
    const a = i / 96 * TAU, rr = r + Math.sin(a * 28) * 2.5 + Math.sin(a * 13) * 1.5;
    const xx = x + Math.cos(a) * rr, yy = y + Math.sin(a) * rr * sy;
    if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy);
  }
  g.stroke();
}

function response(g, I, p) {
  if (I.phase !== 'afterPods') return;
  const cx = I.VW / 2, gy = I.m.multi ? 268 : 306, reduced = I.m.reduced;
  world(g, I);
  const sweep = clamp((p.age - 0.14) / 0.52);
  if (!reduced && !p.launched && sweep > 0 && sweep < 1) {
    g.fillStyle = 'rgba(111,255,210,.13)'; g.beginPath(); g.moveTo(cx, gy);
    g.arc(cx, gy, 116, -Math.PI / 2 + sweep * TAU - 0.42, -Math.PI / 2 + sweep * TAU);
    g.closePath(); g.fill();
  }
  const phase = p.age % 1.15;
  const beat = reduced ? 0 : Math.exp(-(((phase - 0.23) / 0.11) ** 2))
    + 0.8 * Math.exp(-(((phase - 0.51) / 0.12) ** 2));
  g.shadowColor = TEAL; g.shadowBlur = 18 + beat * 17; g.fillStyle = TEAL;
  g.beginPath(); g.arc(cx, gy, 5 + beat * 3, 0, TAU); g.fill(); g.shadowBlur = 0;
  if (!reduced && !p.launched) for (const offset of [0.23, 0.51]) {
    const age = (p.age - offset + 11.5) % 1.15;
    if (age < 0.48) waveRing(g, cx, gy, 12 + age * 145, (1 - age / 0.48) * 0.62, 0.34);
  }
  if (p.launched && !reduced && p.release < 0.6) waveRing(g, cx, gy, 50 + out(p.release / 0.6) * 420, 1 - p.release / 0.6, 0.36);
  screen(g, I);
  if (!p.launched) {
    g.font = '700 10px "GX Rajdhani", monospace'; g.textAlign = 'center';
    g.fillStyle = TEAL; g.fillText('SIGNAL DETECTED /// CH-07', cx, 260);
    g.fillStyle = PINK; g.beginPath(); g.arc(cx + 115, 257, 3, 0, TAU); g.fill();
    buddyLabel(g, cx - 47, 274, 94, 24);
  }
}

function signature(g, I, p) {
  if (I.phase !== 'afterPods') return;
  screen(g, I);
  const w = I.VW < 700 ? 112 : 136, h = 72;
  const x = Math.min(I.VW - w - 16, I.VW / 2 + (I.VW < 700 ? 102 : 132));
  const y = 164, ready = I.m.reduced ? 1 : clamp((p.age - 0.12) / 0.6);
  const send = p.launched ? out(p.release / 0.55) : 0;
  g.globalAlpha = 1 - send;
  g.translate(send * 20, -send * 8);
  g.fillStyle = 'rgba(4,32,38,.66)'; g.strokeStyle = 'rgba(111,255,210,.75)';
  g.lineWidth = 1.3; g.beginPath(); g.roundRect(x, y, w, h, 6); g.fill(); g.stroke();
  g.save(); g.beginPath(); g.rect(x + 8, y + 7, w - 16, h - 14); g.clip();
  g.strokeStyle = TEAL; g.lineWidth = 2.2; g.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const begin = i * 0.42, progress = clamp((ready - begin) / 0.5);
    if (!progress) continue;
    g.beginPath(); g.arc(x + w / 2 + (i ? 15 : -15), y + 29, 13,
      -Math.PI / 2, -Math.PI / 2 + TAU * progress); g.stroke();
  }
  g.restore();
  if (ready > 0.78) {
    g.fillStyle = PINK; g.beginPath(); g.arc(x + w / 2, y + 40, 3.5, 0, TAU); g.fill();
    g.font = '700 13px "GX Rajdhani", "Yu Gothic", sans-serif';
    g.fillStyle = '#eafff9'; g.textAlign = 'center'; g.fillText('BUDDY', x + w / 2, y + 62);
  }
  g.globalAlpha = 1;
}

function ecg(g, x, y, width, height, shift = 0) {
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const u = i / 64, q = (u * 2 + shift) % 1;
    const pulse = q < 0.29 ? 0 : q < 0.36 ? (q - 0.29) / 0.07 * -0.3
      : q < 0.43 ? -0.3 + (q - 0.36) / 0.07 * 1.3
        : q < 0.52 ? 1 - (q - 0.43) / 0.09 : 0;
    const xx = x + u * width, yy = y - pulse * height;
    if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy);
  }
  g.stroke();
}

function heartbeat(g, I, q) {
  const p = I.m.pods[q.index];
  if (!p || I.t < p.tFall || I.t >= p.tOpen || I.phase !== 'afterPods') return;
  const before = I.t < p.tLand, x = I.VW / 2 + p.x, k = p.h / 168;
  const u = clamp((I.t - p.tFall) / (p.tLand - p.tFall));
  const oy = before ? -(1 - u * u) * (p.gy + p.h + 90) : 0;
  const top = p.gy - p.h + oy;
  world(g, I);
  if (before) {
    g.save(); g.translate(x, top - 10 * k); g.rotate(-Math.PI / 2);
    g.strokeStyle = 'rgba(111,255,210,.94)'; g.lineWidth = 2.4 * k;
    ecg(g, 0, 0, 140 * k, 18 * k, I.m.reduced ? 0 : I.A * 0.8);
    g.restore();
  } else {
    const a = I.t - p.tLand;
    if (!I.m.reduced) for (const offset of [0.04, 0.3]) {
      const age = a - offset;
      if (age >= 0 && age < 0.7) waveRing(g, x, p.gy, (22 + 160 * out(age / 0.7)) * k,
        0.8 * (1 - age / 0.7), 0.28);
    }
    const lx = x - 50, ly = p.gy - p.h - 36;
    buddyLabel(g, lx, ly, 100, 28);
    if (!I.m.reduced) {
      g.strokeStyle = TEAL; g.lineWidth = 1.2;
      ecg(g, lx + 8, ly + 23, 84, 5, I.A * 0.5);
    }
  }
}

function lamp(g, I, p) {
  if (I.phase !== 'afterPods') return;
  // 箱がまだ無い局面の金プレートと章は取り外す。投下照準の灯・射出時の走査は残す。
  world(g, I);
  const x = I.VW / 2, y = I.m.multi ? 268 : 306;
  g.strokeStyle = 'rgba(111,255,210,.72)'; g.lineWidth = 1.2;
  g.beginPath(); g.ellipse(x, y, 58, 17, 0, -2.8, -0.35); g.stroke();
  if (!I.m.reduced && p.launched && p.release < 0.42) {
    const a = 1 - p.release / 0.42;
    g.save(); g.beginPath(); g.ellipse(x, y, 58, 17, 0, 0, TAU); g.clip();
    g.strokeStyle = `rgba(216,255,246,${a})`; g.lineWidth = 2;
    const sx = x - 58 + 116 * out(p.release / 0.42);
    g.beginPath(); g.moveTo(sx, y - 17); g.lineTo(sx, y + 17); g.stroke();
    g.restore();
  }
}

function sonic(g, I, q) {
  if (I.phase !== 'afterPods') return;
  const p = I.m.pods[q.index];
  if (!p || I.t < p.tFall || I.t > p.tLand + 0.3) return;
  world(g, I);
  const x = I.VW / 2 + p.x, k = p.h / 168;
  for (const u of [0.82, 0.92, 0.99]) {
    const at = p.tFall + (p.tLand - p.tFall) * u;
    const age = I.t - at;
    if (age < 0 || age > (I.m.reduced ? 0.14 : 0.34)) continue;
    const oy = -(1 - u * u) * (p.gy + p.h + 90);
    const y = p.gy - p.h * 0.48 + oy;
    const spread = I.m.reduced ? 1 : 1 + out(age / 0.34) * 2.2;
    const alpha = I.m.reduced ? 0.92 * (1 - age / 0.14) : 0.95 * (1 - age / 0.34);
    g.save(); g.translate(x, y); g.scale(1, 0.43);
    g.strokeStyle = `rgba(255,248,230,${alpha})`; g.lineWidth = 6 * k;
    g.beginPath(); g.arc(0, 0, 46 * k * spread, 0, TAU); g.stroke();
    g.strokeStyle = `rgba(255,201,77,${alpha})`; g.lineWidth = 2.5 * k;
    g.beginPath(); g.arc(0, 0, 51 * k * spread, 0, TAU); g.stroke();
    g.restore();
  }
}

// delayed / skeleton のタグは core.js の箱面へ直接投影する。

function multilock(g, I, q) {
  if (I.phase !== 'afterPods') return;
  world(g, I);
  const cx = I.VW / 2, cy = I.m.multi ? 268 : 306;
  const done = I.m.reduced || q.age >= I.m.tLaunch * 0.92;
  // 金の四隅ブラケットは取り外す。既存照準と同じ地面のパースで三段の収束を残す。
  g.translate(cx, cy); g.scale(1, 0.3);
  for (let i = 0; i < 3; i++) {
    const start = I.m.tLaunch * [0.13, 0.4, 0.7][i];
    const end = I.m.tLaunch * [0.36, 0.64, 0.92][i];
    const progress = I.m.reduced ? 1 : clamp((q.age - start) / (end - start));
    if (!progress) continue;
    const r = [90, 105, 120][i], gap = (1 - out(progress)) * 280;
    g.strokeStyle = done ? 'rgba(111,255,210,.76)' : 'rgba(225,255,249,.65)';
    g.lineWidth = 1.4; g.lineCap = 'butt';
    for (let j = 0; j < 4; j++) {
      const a = j * Math.PI / 2;
      g.beginPath(); g.arc(0, 0, r + gap, a - 0.12, a + 0.12); g.stroke();
    }
  }
  if (done) {
    g.strokeStyle = 'rgba(111,255,210,.52)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(0, 0, 73, 0, TAU); g.stroke();
  }
}

function landing(g, I, q) {
  const p = I.m.pods[q.index];
  if (!p) return;
  world(g, I);
  const x = I.VW / 2 + p.x, gy = p.gy, k = p.h / 168, w = p.h * 1.073;
  const deploy = I.m.reduced ? 1 : out(q.age / Math.max(0.18, p.tFall - p.tCall));
  const impact = q.landed < 0 ? 0 : I.m.reduced ? 1 : out(q.landed / 0.26);
  const sink = q.landed < 0 || I.m.reduced ? 0 : Math.sin(Math.PI * clamp(q.landed / 0.42)) * 10 * k;
  if (I.phase === 'beforePods') {
    // 箱の背後で平板が左右に開き、支柱だけが荷重を受ける。
    g.fillStyle = '#293439'; g.strokeStyle = '#8b999b'; g.lineWidth = 2 * k;
    for (const side of [-1, 1]) {
      const bx = x + side * (w * 0.52 + deploy * 32 * k);
      g.fillRect(bx - 28 * k, gy - 11 * k + sink, 56 * k, 12 * k);
      g.strokeRect(bx - 28 * k, gy - 11 * k + sink, 56 * k, 12 * k);
      g.fillStyle = '#4b5b5e';
      g.fillRect(bx - 5 * k, gy - 58 * k + sink, 10 * k, 47 * k);
      g.fillStyle = '#293439';
    }
    g.fillStyle = '#202c30'; g.fillRect(x - (w * 0.48 + 44 * k * deploy), gy - 4 * k + sink,
      w * 0.96 + 88 * k * deploy, 12 * k);
  } else if (I.phase === 'afterPods' && q.landed >= 0) {
    g.strokeStyle = 'rgba(111,255,210,.75)'; g.lineWidth = 1.3 * k; g.lineCap = 'butt';
    for (const side of [-1, 1]) {
      const bx = x + side * (w * 0.53 + 8 * k);
      g.beginPath(); g.moveTo(bx, gy - 12 * k);
      g.lineTo(bx, gy - (12 + 45 * impact) * k); g.stroke();
      g.beginPath(); g.moveTo(bx, gy - 14 * k);
      g.lineTo(x + side * w * 0.29, gy - 14 * k); g.stroke();
    }
    // 中央の特装章は箱にも支柱にも沿わないため取り外した。
    if (!I.m.reduced && q.landed < 0.38) {
      g.fillStyle = `rgba(192,178,138,${0.3 * (1 - q.landed / 0.38)})`;
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        g.beginPath(); g.arc(x + side * (w * 0.6 + (12 + i * 11) * k), gy - (3 + i * 7) * k,
          (2 + i) * k, 0, TAU); g.fill();
      }
    }
  }
}

function reverse(g, I, q) {
  if (I.phase !== 'afterPods') return;
  world(g, I);
  const x = I.VW / 2, y = I.m.multi ? 268 : 306, B = I.m.tLaunch;
  const progress = I.m.reduced ? 1 : clamp((q.age - B * 0.28) / (B * 0.64));
  const alpha = q.launched ? 1 - clamp(q.release / 0.55) : 1;
  if (!progress || alpha <= 0) return;
  g.globalAlpha = alpha;
  // 内周の切り欠きだけを外周の反転区間へ同期する。外周はcoreが実際に逆転させる。
  g.strokeStyle = progress >= 1 ? 'rgba(111,255,210,.82)' : '#e5f4f5';
  g.lineWidth = 1.3;
  const r = 62;
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + (1 - progress) * 0.35;
    const x0 = x + Math.cos(angle) * r, y0 = y + Math.sin(angle) * r * 0.48;
    g.save(); g.translate(x0, y0); g.rotate(angle);
    g.beginPath(); g.moveTo(-8, -4); g.lineTo(0, 0); g.lineTo(-8, 4); g.stroke();
    g.restore();
  }
  // 中央の六角章は取り外す。反転する内周と外周・SEは維持する。
}

function reverseSeal(g, I, q) {
  if (I.phase !== 'afterPods') return;
  screen(g, I);
  const B = I.m.tLaunch, cx = I.VW / 2, cy = 202;
  const progress = clamp((q.age / B - 0.2) / 0.76);
  const angle = TAU * progress, back = Math.cos(angle) < 0;
  const alpha = q.launched ? 1 - clamp(q.release / 0.5) : 1;
  if (alpha <= 0) return;
  g.globalAlpha = alpha;
  if (!I.m.reduced && progress > 0 && progress < 1) {
    // DOM表示面と同じ縦軸角度。Canvas板はその背後からせり出す。
    const width = 235 * Math.max(0.08, Math.abs(Math.cos(angle)));
    const left = cx - width / 2;
    g.fillStyle = '#172a30';
    g.strokeStyle = back ? 'rgba(111,255,210,.7)' : '#9eabb0'; g.lineWidth = 1.2;
    g.beginPath(); g.roundRect(left, cy - 42, width, 82, 5); g.fill(); g.stroke();
    if (back && width > 52) {
      // 裏面が正対する時だけ斜めの反射が一度通る。
      const flash = 1 - clamp(Math.abs(q.age / B - 0.58) / 0.1);
      if (flash > 0) {
        g.save(); g.beginPath(); g.rect(left + 3, cy - 40, width - 6, 78); g.clip();
        g.strokeStyle = `rgba(255,251,225,${0.8 * flash})`; g.lineWidth = 12;
        const fx = cx + (q.age / B - 0.58) * 440;
        g.beginPath(); g.moveTo(fx - 30, cy + 43); g.lineTo(fx + 30, cy - 43); g.stroke();
        g.restore();
      }
    }
  }
  // 完了時の小六角章も取り外す。
}

// skeleton の投影も側板と同じ箱ローカル座標で描く。

export function drawSignal(g, I, layer) {
  if (!['response', 'signature', 'heartbeat', 'lamp', 'sonic', 'delayed', 'multilock', 'landing', 'reverse', 'reverseSeal', 'skeleton'].includes(layer?.id)) return false;
  g.save();
  try {
    if (layer.id === 'response') response(g, I, layer.p);
    else if (layer.id === 'signature') signature(g, I, layer.p);
    else if (layer.id === 'heartbeat') heartbeat(g, I, layer.p);
    else if (layer.id === 'lamp') lamp(g, I, layer.p);
    else if (layer.id === 'sonic') sonic(g, I, layer.p);
    else if (layer.id === 'multilock') multilock(g, I, layer.p);
    else if (layer.id === 'landing') landing(g, I, layer.p);
    else if (layer.id === 'reverse') reverse(g, I, layer.p);
    else if (layer.id === 'reverseSeal') reverseSeal(g, I, layer.p);
    // delayed / skeleton は箱面の描画で処理済み。
  } finally { g.restore(); }
  return true;
}
