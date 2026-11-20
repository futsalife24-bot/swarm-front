// 箱のローカル座標で描く投影。元画像の装甲面・斜面・継ぎ目を保ち、地板は描かない。
export function drawCrateStencil(g, w, h, progress = 1) {
  const k = h / 168;
  g.save();
  // 正面の凹んだパネル。面取りと留め具を避けて投影を切る。
  g.beginPath();
  for (const [i, [x, y]] of [[0.27, 0.40], [0.56, 0.40], [0.60, 0.44],
    [0.60, 0.61], [0.56, 0.65], [0.28, 0.65], [0.25, 0.61], [0.25, 0.44]].entries()) {
    if (i) g.lineTo((x - 0.5) * w, (y - 1) * h);
    else g.moveTo((x - 0.5) * w, (y - 1) * h);
  }
  g.closePath(); g.clip();
  g.beginPath(); g.rect(-w * 0.26, -h * 0.61, w * 0.37 * progress, h * 0.27); g.clip();
  // 正面にも僅かな縦のパース。箱の揺れ・圧縮・カメラは呼出元と完全に共有する。
  g.transform(1, -0.025, 0.035, 1, -w * 0.085, -h * 0.47);
  g.lineCap = 'butt'; g.lineJoin = 'bevel';
  const paths = [
    [[-22, -12], [-29, 0], [-22, 12]],
    [[-12, -10], [-18, 0], [-12, 10]],
    [[-3, -9], [-8, 0], [-3, 9]],
    [[5, -9], [22, -9]], [[5, -3], [16, -3]],
    [[5, 3], [22, 3]], [[5, 9], [12, 9]],
  ];
  const strokes = () => {
    g.beginPath();
    for (const points of paths) for (const [i, [x, y]] of points.entries()) {
      if (i) g.lineTo(x * k, y * k); else g.moveTo(x * k, y * k);
    }
    g.stroke();
  };
  // 接触側の暗い縁と反射側の細線。金属の明暗が透ける弱い加算光だけを重ねる。
  g.translate(0.7 * k, 0.9 * k); g.strokeStyle = 'rgba(0,12,17,.72)'; g.lineWidth = 2 * k; strokes();
  g.translate(-0.7 * k, -0.9 * k); g.globalCompositeOperation = 'screen';
  g.shadowColor = '#57c7d4'; g.shadowBlur = 3 * k;
  g.strokeStyle = 'rgba(111,255,210,.60)'; g.lineWidth = 1.35 * k; strokes();
  g.shadowBlur = 0; g.strokeStyle = 'rgba(224,255,250,.58)'; g.lineWidth = 0.45 * k; strokes();
  // 金は短い検査線のみ。面を埋めず、章やプレートは作らない。
  g.strokeStyle = 'rgba(255,201,77,.78)'; g.lineWidth = 0.65 * k;
  g.beginPath(); g.moveTo(5 * k, 15 * k); g.lineTo(22 * k, 15 * k); g.stroke();
  g.restore();

  // 側面の既存溝へ細い走査線を回し、正面と側面で異なる奥行きを出す。
  g.save(); g.globalCompositeOperation = 'screen';
  g.strokeStyle = 'rgba(87,199,212,.40)'; g.lineWidth = 0.8 * k;
  g.beginPath(); g.moveTo(w * 0.325, -h * 0.58);
  g.lineTo(w * (0.325 + 0.07 * progress), -h * (0.58 + 0.026 * progress));
  g.stroke(); g.restore();
}
