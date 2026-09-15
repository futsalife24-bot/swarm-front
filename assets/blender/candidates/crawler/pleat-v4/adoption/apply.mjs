import fs from 'node:fs';
const root='assets/blender/candidates/crawler/pleat-audit/integration-v3/';
for(const [kind,path] of [['render','src/client/render.ts'],['game','src/shared/game.ts']]){
 let text=fs.readFileSync(path,'utf8').replaceAll('\r\n','\n');
 const diff=fs.readFileSync(root+kind+'-fix.diff','utf8').replaceAll('\r\n','\n');
 for(const h of diff.split(/^@@.*@@.*\n/m).slice(1)){
  const lines=h.split('\n').filter(l=>[' ','+','-'].includes(l[0]));
  const before=lines.filter(l=>l[0]!=='+').map(l=>l.slice(1)).join('\n');
  const after=lines.filter(l=>l[0]!=='-').map(l=>l.slice(1)).join('\n');
  if(!text.includes(before))throw new Error('Drift in '+path);
  text=text.replace(before,after);
 }
 fs.writeFileSync(path,text);
}
const file='src/client/bestiary.ts';let s=fs.readFileSync(file,'utf8');
s=s.replace('0.8秒の位置予告後、低速の高威力エネルギー弾。予告した地点へ撃つため、横移動で回避できます。','照準した地点へ、低速の強いエネルギー弾を放ちます。').replace('16〜20mを目安に間合いを保ち','離れた間合いを保ち').replace('隊員を多く巻き込める地点を3.1秒予告し、半径7mを攻撃。','隊員の集まる場所へ予兆が広がり、周囲を攻撃します。').replace('散開して予告円から離れます。','');fs.writeFileSync(file,s);
