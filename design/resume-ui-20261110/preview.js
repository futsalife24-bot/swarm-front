// 横画面プレビュー：モジュールを入口から呼び出すだけ。抽選・保存・券の消費は行わない。
import { createSupplyReveal, validate, readPending, audit, build, frameState, PRESETS1, PRESETS10 } from './supply-reveal/supply-reveal.js';

const $ = (s) => document.querySelector(s);
const OPT_KEY = 'supply-reveal-preview-opt';
const PENDING_KEY = 'supply-reveal-preview-pending';
const session = (() => { try { return sessionStorage; } catch { return null; } })();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function loadOpt() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(OPT_KEY) || '{}') || {}; } catch { o = {}; }
  let prm = false; try { prm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* noop */ }
  return { fast: !!o.fast, reduce: o.reduce ?? prm, debug: !!o.debug };
}
const opt = loadOpt();
const saveOpt = () => { try { localStorage.setItem(OPT_KEY, JSON.stringify(opt)); } catch { /* 保存できなくても動作は続ける */ } };

let lastN = 1;
const reveal = createSupplyReveal(document.body, {
  label: '配布券（仮）',
  reduced: opt.reduce,
  fast: opt.fast,
  storage: session,
  pendingKey: PENDING_KEY,
  finalActions: [
    { id: 'again', label: '同じ結果でもう一度' },
    { id: 'close', label: '閉じる', primary: true },
  ],
  onEvent: (e) => {
    if (e.type === 'option') {
      if ('fast' in e) opt.fast = e.fast;
      if ('reduced' in e) opt.reduce = e.reduced;
      saveOpt(); syncOpt();
    }
  },
  onClose: () => {
    $('#launcher').hidden = false;
    $('.dbg').hidden = true;
    $(`.use[data-use="${lastN}"]`)?.focus({ preventScroll: true });
    refreshResume();
  },
});

function start(raw, o) {
  const res = validate(raw);
  if (!reveal.play(res, o)) return;
  lastN = res.length;
  $('#launcher').hidden = true;
  $('.dbg').hidden = !opt.debug;
}

function fillSelect(sel, presets) { sel.innerHTML = Object.keys(presets).map((k) => `<option>${esc(k)}</option>`).join(''); }
fillSelect($('#preset1'), PRESETS1);
fillSelect($('#preset10'), PRESETS10);
$('#preset10').value = 'バディ＋SSR＋SR';
$('#json').value = JSON.stringify(PRESETS10['SSR＋SR']).replace(/},{/g, '},\n{');
function syncOpt() { $('#opt-fast').checked = opt.fast; $('#opt-reduce').checked = opt.reduce; $('#opt-debug').checked = opt.debug; }
syncOpt();
$('#opt-fast').addEventListener('change', (e) => { opt.fast = e.target.checked; reveal.setFast(opt.fast); saveOpt(); });
$('#opt-reduce').addEventListener('change', (e) => { opt.reduce = e.target.checked; reveal.setReduced(opt.reduce); saveOpt(); });
$('#opt-debug').addEventListener('change', (e) => { opt.debug = e.target.checked; saveOpt(); });
document.querySelectorAll('.use').forEach((b) => b.addEventListener('click', () => {
  const n = b.dataset.use === '1' ? 1 : 10;
  start(n === 1 ? PRESETS1[$('#preset1').value] : PRESETS10[$('#preset10').value]);
}));
$('#json-play').addEventListener('click', () => {
  try { start(JSON.parse($('#json').value)); $('#json-msg').textContent = ''; }
  catch (e) { $('#json-msg').textContent = e.message; }
});
function refreshResume() { const p = readPending(session, PENDING_KEY); $('#resume').hidden = !p; return p; }
$('#resume-open').addEventListener('click', () => { const p = refreshResume(); if (p) start(p, { atEnd: true }); });
$('#resume-drop').addEventListener('click', () => { try { session?.removeItem(PENDING_KEY); } catch { /* noop */ } refreshResume(); });
refreshResume();

// 検証用シークバー（プレビュー専用）
const seekEl = $('#dbg-seek');
seekEl.addEventListener('input', () => { const s = reveal.state(); if (s.dur) reveal.seek((seekEl.value / 1000) * s.dur); $('#dbg-time').textContent = `${reveal.state().t.toFixed(2)}s`; });
$('#dbg-interrupt').addEventListener('click', () => location.reload());

// 検証用の窓口（?check=1 の検査スクリプトと自動検証が使う）
window.SupplyRevealPreview = { reveal, start, audit, build, frameState, validate, PRESETS1, PRESETS10 };
if (/[?&]check=1/.test(location.search)) import('./verification/layout-check.js');
