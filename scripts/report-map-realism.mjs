import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='dist-validation/map-realism';
const b=JSON.parse(fs.readFileSync(`${dir}/before/checks.json`)).rows;
const a=JSON.parse(fs.readFileSync(`${dir}/after/checks.json`));
assert.deepEqual(a.errors,[]);
a.rows.forEach((r,i)=>{for(const key of ['low','high','tiles'])assert.equal(r[key],b[i][key]);assert.ok(r.vertices<=b[i].vertices);});
const names=['灰明の街区','薄暮の倉庫地区','蒼鉄の工業区','風渡る草原','白嶺の雪峡','晶脈の地底巣'];
const details=['建材目地・雨だれ・舗装骨材','鋼材の縦筋・不均一な酸化','濃い雨筋・配管の金属反射','緑と枯草・植生ムラ・柔らかな丘','風紋・雪殻の反射・積雪面の陰影','岩層・鉱物筋・湿りの反射差'];
const refs=[
 ['集合住宅の外観','https://www.viszinis.lv/Ilukstes-iela-107-k1'],
 ['工場・倉庫の外壁','https://sanyoukensetsu.co.jp/column/765/'],
 ['Charleroi製鉄施設','https://www.rtbf.be/article/charleroi-le-master-plan-porte-ouest-etat-des-lieux-d-un-projet-qui-compte-bien-faire-rimer-economique-avec-ecologique-11534935'],
 ['LBV・アルプス草原','https://www.lbv.de/naturschutz/lebensraeume-schuetzen/alpen/'],
 ['南アルプス・シュカブラ','https://minamialps-shizuokaken.jp/contents/390'],
 ['BLM・Fort Stanton Cave','https://www.blm.gov/visit/fort-stanton-snowy-river-cave-nca'],
];
fs.writeFileSync(`${dir}/review.html`,`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>全6マップ・素材比較</title>
<style>body{margin:0;background:#111820;color:#e4e9ed;font:16px/1.6 system-ui}main{max-width:1560px;margin:auto;padding:24px}h1{font-size:25px;margin:0}p{color:#acbdcb}nav{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}select,button{font:inherit;background:#263542;color:white;padding:8px 12px;border:1px solid #607483;border-radius:6px}section{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}img{width:100%;display:block}figcaption{padding:6px 0}a{color:#9bcaff}.stat{background:#1c2a35;padding:12px 18px;margin-top:18px}small{color:#a8bac9}@media(max-width:700px){section{grid-template-columns:1fr}}</style>
<main><h1>全6マップの素材・陰影ブラッシュアップ</h1><p>ポリゴン数据え置き。実景の特徴を既存の面に反映。</p>
<nav><select id="map">${names.map((n,i)=>`<option value="${i}">${n}</option>`).join('')}</select><select id="quality"><option value="1">標準</option><option value="0.65">軽量</option></select><select id="angle"><option value="0">正面</option><option value="1.7">別方向</option></select></nav>
<h2 id="detail"></h2><section><figure><figcaption>変更前</figcaption><img id="before" alt="変更前のマップ"></figure><figure><figcaption>変更後</figcaption><img id="after" alt="変更後のマップ"></figure></section><div class="stat" id="stats"></div><p id="ref"></p><small>比較対象は実ゲームRenderer。全24画面のマップLOD三角形数とタイル数は一致、頂点数は増加なし。敵・遠景の非同期読込を含む画面全体の描画カウンターは比較対象外。スマホ実機性能は未計測。</small></main>
<script>const rows=${JSON.stringify(a.rows)},details=${JSON.stringify(details)},refs=${JSON.stringify(refs)};function update(){const i=Number(document.querySelector('#map').value),q=document.querySelector('#quality').value,angle=document.querySelector('#angle').value;for(const side of ['before','after'])document.getElementById(side).src=side+'/'+q+'-map-'+i+'-'+angle+'.png';const r=rows.find(r=>r.index===i&&r.quality===Number(q));document.querySelector('#detail').textContent=details[i];document.querySelector('#stats').textContent='三角形数（低LOD / 最大LOD）: '+r.low.toLocaleString()+' / '+r.high.toLocaleString()+' ｜ 変更前後 ±0';const link=document.createElement('a');link.href=refs[i][1];link.textContent='参考写真: '+refs[i][0];link.target='_blank';link.rel='noreferrer';document.querySelector('#ref').replaceChildren(link);}document.querySelectorAll('select').forEach(s=>s.onchange=update);update();</script></html>`);
fs.writeFileSync(`${dir}/budget.json`,JSON.stringify({views:a.rows.length,polygonBudget:'unchanged',vertexBudget:'not increased',errors:[]},null,2));
console.log('PASS: 24 map views; review.html generated.');
