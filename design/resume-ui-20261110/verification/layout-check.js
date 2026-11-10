// 配置の検査（preview.html?check=1 の時だけ読み込む）。画面外・44px未満・文字の切れ・重なりを数える。演出の動作には不要。
const vis = (e) => {
  if (!e) return false;
  for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity <= 0.01 || n.hidden) return false;
  }
  const d = e.closest('details');
  if (d && !d.open && !e.closest('summary')) return false;
  return e.getClientRects().length > 0;
};
const box = (e) => e.getBoundingClientRect();
const hit = (p, q) => p.left < q.right - 1 && p.right > q.left + 1 && p.top < q.bottom - 1 && p.bottom > q.top + 1;

export function check(label) {
  const W = innerWidth, H = innerHeight;
  const out = { label, W, H, offscreen: [], small: [], clipped: [], overlap: [] };
  const outside = (r) => r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1;
  const btns = [...document.querySelectorAll('button, summary, select, input[type=range]')].filter(vis);
  btns.forEach((b) => {
    const r = box(b);
    if (r.height < 43.5 || (b.tagName !== 'SELECT' && b.tagName !== 'INPUT' && r.width < 43.5)) out.small.push(`${(b.textContent || b.id || b.tagName).trim().slice(0, 12)}:${Math.round(r.width)}x${Math.round(r.height)}`);
    if (outside(r)) out.offscreen.push((b.textContent || b.id).trim().slice(0, 12));
  });
  // 操作どうしの重なり
  for (let a = 0; a < btns.length; a++) for (let b = a + 1; b < btns.length; b++) {
    if (btns[a].contains(btns[b]) || btns[b].contains(btns[a])) continue;
    if (hit(box(btns[a]), box(btns[b]))) out.overlap.push(`${btns[a].textContent.trim().slice(0, 8)}×${btns[b].textContent.trim().slice(0, 8)}`);
  }
  [...document.querySelectorAll('.sr-tile, .sr-cut-panel, .sr-cut-title, .sr-cut-rarity, .sr-cut-stars, .sr-cut-new, .sr-cut-band, .sr-list-head, .sr-badge, .sr-pod, .sr-hud-id')]
    .filter(vis).forEach((e) => { const r = box(e); if (outside(r)) out.offscreen.push(`${e.className} ${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}`); });
  // カットイン名（上下2分割）は面からのはみ出しで別に検査する
  [...document.querySelectorAll('.sr-t-name, .sr-name')].filter(vis).forEach((e) => {
    if (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) out.clipped.push(`${e.textContent.slice(0, 14)} ${e.scrollHeight}/${e.clientHeight}`);
  });
  [...document.querySelectorAll('.sr-hud-label, .sr-phase, .sr-list-head h2, .sr-hint, .sr-badge')].filter(vis).forEach((e) => {
    if (e.scrollWidth > e.clientWidth + 1) out.clipped.push(`${e.className} 横はみ出し`);
  });
  document.querySelectorAll('.sr-tile').forEach((t) => {
    if (!vis(t)) return;
    const parts = [...t.querySelectorAll('.sr-t-chip, .sr-t-new, .sr-t-stars, .sr-t-name, .sr-t-sub > span:first-child')].filter(vis).map(box);
    for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) if (hit(parts[a], parts[b])) out.overlap.push('一覧タイル内の重なり');
    const chip = t.querySelector('.sr-t-chip'); if (box(chip).height > 20) out.clipped.push('レア度表示が折り返し');
    if (box(t.querySelector('.sr-t-sub')).bottom > box(t).bottom + 1) out.clipped.push('タイル下端からはみ出し');
  });
  const cut = document.querySelector('.sr-cut-title'), panel = document.querySelector('.sr-cut-panel');
  if (vis(cut) && box(cut).bottom > box(panel).bottom + 1) out.clipped.push('カットイン名が面からはみ出し');
  if (vis(cut) && box(cut).top < box(panel).top - 1) out.clipped.push('カットイン名が面の上にはみ出し');
  // カード表面の文字がカードからはみ出していないか
  document.querySelectorAll('.sr-front').forEach((f) => {
    if (!vis(f)) return;
    const fr = box(f);
    f.querySelectorAll('.sr-chip, .sr-name, .sr-sub, .sr-stars').forEach((x) => { const r = box(x); if (r.top < fr.top - 1 || r.bottom > fr.bottom + 1) out.clipped.push('カード内の文字がはみ出し'); });
  });
  // 文字とボタンの重なり（HUD・最終操作と演出の文字）
  const btnRects = [...document.querySelectorAll('.sr-root button, .dbg button, .dbg input')].filter(vis).map(box);
  [...document.querySelectorAll('.sr-cut-title, .sr-cut-rarity, .sr-cut-new, .sr-cut-band span, .sr-list-head, .sr-tile, .sr-badge, .sr-hud-id, .sr-hint')].filter(vis).forEach((e) => {
    const r = box(e);
    btnRects.forEach((h) => { if (hit(r, h)) out.overlap.push(`${(e.className || e.tagName).split(' ')[0]}×ボタン`); });
  });
  return out;
}
window.__check = check;
