import fs from 'node:fs';
import assert from 'node:assert/strict';
export const dir='assets/blender/candidates/crawler/pleat-audit/integration-v2';
export const gameFix=s=>s.replace('e.wind -= dt;','e.wind -= dt;\n      if (e.kind === "crawler" && e.wind < 1e-9) e.wind = 0;');
export const renderFix=s=>{
 let out=s.replace(/visual = new Map(?:<string, T.Vector3>)?\(\);/,`visual = new Map();
  crawlerAim = new Map();`);
 // This transform works on TS and Vite output; typed declarations are restored in source copies below.
 out=out.replace('this.houndVisualInputs.length = 0;',`if (!w) this.crawlerAim.clear();
      this.houndVisualInputs.length = 0;`);
 out=out.replace(/const t =\s*e.wind > 0/,`let crawlerAttacking = false;
          if (e.kind === "crawler") {
            const prior = this.crawlerAim.get(e.id);
            const valid = prior && prior.time <= w.time;
            const fired = valid && e.wind <= 0 && e.cool > 0.85 && e.cool > prior.cool + 0.4;
            const until = e.active === false ? 0 : fired ? w.time + Math.max(0, 0.75 - (1.2 - e.cool)) : valid ? prior.until : 0;
            crawlerAttacking = e.active !== false && (e.wind > 0 || w.time < until);
            this.crawlerAim.set(e.id, { cool: e.cool, time: w.time, until });
          }
          const t = e.wind > 0 || crawlerAttacking`);
 out=out.replace('this.renderer.render(this.scene, this.camera);',`for (const id of this.crawlerAim.keys()) {
      if (!w?.enemies.some(e => e.kind === "crawler" && e.id === id)) this.crawlerAim.delete(id);
    }
    this.renderer.render(this.scene, this.camera);`);
 out=out.replaceAll('moving && e.active !== false && !e.wind','moving && e.active !== false && (e.kind === "crawler" ? !(e.wind > 0) : !e.wind)');
 assert.notEqual(out,s); return out;
};
fs.mkdirSync(dir,{recursive:true});
for(const [file,fix] of [['src/shared/game.ts',gameFix],['src/client/render.ts',renderFix]]){
 let output=fix(fs.readFileSync(file,'utf8'));
 if(file.includes('render'))output=output.replace('visual = new Map();','visual = new Map<string, T.Vector3>();').replace('crawlerAim = new Map();','private crawlerAim = new Map<number, { cool: number; time: number; until: number }>();');
 fs.writeFileSync(dir+'/'+file.split('/').at(-1)+'.proposed.txt',output);
}
