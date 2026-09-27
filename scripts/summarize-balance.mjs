import fs from 'node:fs';
import crypto from 'node:crypto';
const root='docs/evidence/balance-t7/';
const b=JSON.parse(fs.readFileSync(root+'baseline.json','utf8'));
const s=JSON.parse(fs.readFileSync(root+'support.json','utf8'));
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const n=x=>Number.isFinite(x)?x.toFixed(1):'—';
const kinds=[...new Set(b.catalog.map(x=>x.kind))];
const summary=kinds.map(kind=>({kind,conditions:b.conditions.map(c=>{
  const r=b.results.filter(x=>x.kind===kind&&x.condition===c.id), wins=r.filter(x=>x.clearTime!==null);
  if(r.length!==b.seeds.length)throw Error('Missing or duplicate trials');
  return {condition:c.id,trials:r.length,wins:wins.length,alive:r.filter(x=>x.survival).length,clearMean:wins.length?mean(wins.map(x=>x.clearTime)):null,killMean:mean(r.map(x=>x.kills)),damagePerRound:mean(r.map(x=>x.damagePerRound)),netDamageTaken:mean(r.map(x=>x.netDamageTaken)),bossTTKs:r.map(x=>x.bossTTK)};
})}));
const rows=['# 全候補の機械集計','','勝利数/3、括弧内は勝利試行だけの平均秒。打切りを除いた平均なので勝利数の異なる武器間で単純比較しない。人間の勝率ではない。', '', '| 武器 | 初級 | 中級 | 終盤 | 15-A | 別ST8 |','| --- | --- | --- | --- | --- | --- |'];
for(const r of summary)rows.push(`| ${r.kind} | ${r.conditions.map(c=>`${c.wins}/3 (${c.clearMean===null?'—':n(c.clearMean)})`).join(' | ')} |`);
rows.push('','## N・個体差0の性能','','理論DPSは全弾命中・無減衰・無overkill・mag×interval＋reloadの簡易定常式。回復武器は回復量。実装のtick丸めや部分reloadとは別。','','| 武器 | 1発raw | 理論DPS | 射程 | 間隔 | 装弾 | reload | 弾速 | 半径 |','| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for(const c of b.catalog.filter(x=>x.rarity===0))rows.push(`| ${c.kind} | ${n(c.rawPerRound)} | ${n(c.idealCycleDps)} | ${n(c.range)} | ${c.interval} | ${c.mag} | ${c.reload} | ${c.speed??'即時ray'} | ${c.radius} |`);
rows.push('','## 射撃場の単発平均damage','','姿勢固定・高HPのantに対する3seed平均。密集5体は合計damage。実戦DPS/TTKではない。','','| 武器 | 6m単体 | 20m単体 | 45m単体 | 6m群 | 20m群 | 45m群 |','| --- | --- | --- | --- | --- | --- | --- |');
for(const kind of kinds)rows.push(`| ${kind} | ${[false,true].flatMap(group=>[6,20,45].map(distance=>n(mean(b.ranges.filter(x=>x.kind===kind&&x.group===group&&x.distance===distance).map(x=>x.damage))))).join(' | ')} |`);
rows.push('','## 生存・被害・弾効率','','net damageは同tick回復を相殺し得る。damage/roundはoverkill・複数対象を含む。射撃成否と弾効率は別。','','| 武器 | 条件 | 生存/3 | 平均kill | net被害 | damage/round | boss TTK各seed |','| --- | --- | --- | --- | --- | --- | --- |');
for(const r of summary)for(const c of r.conditions)rows.push(`| ${r.kind} | ${c.condition} | ${c.alive}/3 | ${n(c.killMean)} | ${n(c.netDamageTaken)} | ${n(c.damagePerRound)} | ${c.bossTTKs.map(x=>x===null?'未撃破/未到達':n(x)).join(', ')} |`);
rows.push('','## 敵種相性（20m・単発）','','| 武器 | '+[...new Set(b.affinities.map(x=>x.enemyKind))].join(' | ')+' |','| --- | '+[...new Set(b.affinities.map(x=>x.enemyKind))].map(()=>'---').join(' | ')+' |');
for(const kind of kinds)rows.push(`| ${kind} | ${[...new Set(b.affinities.map(x=>x.enemyKind))].map(enemy=>n(mean(b.affinities.filter(x=>x.kind===kind&&x.enemyKind===enemy).map(x=>x.damage)))).join(' | ')} |`);
rows.push('','## MD回復と照準許容','','| 距離 | yawずれrad | 平均回復/発 | 回復成立/3 |','| --- | --- | --- | --- |');
for(const distance of [6,20,45])for(const offset of [0,.04,.09]){const r=s.healing.filter(x=>x.distance===distance&&x.offset===offset);rows.push(`| ${distance} | ${offset} | ${n(mean(r.map(x=>x.healed)))} | ${r.filter(x=>x.healed>0).length}/3 |`);}
rows.push('','## 命中感度（即時ray）','','| 武器 | 距離 | yawずれrad | damage>0 /3 | 平均damage |','| --- | --- | --- | --- | --- |');
for(const kind of kinds)for(const distance of [6,20,45,90,130])for(const offset of [0,.04,.09]){const r=s.accuracy.filter(x=>x.kind===kind&&x.distance===distance&&x.offset===offset);if(r.length)rows.push(`| ${kind} | ${distance} | ${offset} | ${r.filter(x=>x.damage>0).length}/3 | ${n(mean(r.map(x=>x.damage)))} |`);}
rows.push('','全レア度60性能、stage全編成、育成24点、アクセサリ18点、各試行はJSONを参照。総合順位は付けない。');
fs.writeFileSync(root+'SUMMARY.md',rows.join('\n')+'\n');
fs.writeFileSync(root+'summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({source:b.source,missions:b.results.length,accessoryTrials:b.accessories.length,rangeShots:b.ranges.length,enemyShots:b.affinities.length,healingShots:s.healing.length,accuracyShots:s.accuracy.length,sha256:crypto.createHash('sha256').update(fs.readFileSync(root+'baseline.json')).digest('hex')}));
