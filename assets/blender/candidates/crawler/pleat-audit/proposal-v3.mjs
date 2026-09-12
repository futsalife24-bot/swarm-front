import fs from 'node:fs';
import {gameFix,renderFix as previousRenderFix} from './proposal-v2.mjs';
export {gameFix};
export const dir='assets/blender/candidates/crawler/pleat-audit/integration-v3';
export const renderFix=s=>previousRenderFix(s)
 .replace('if (!w) this.crawlerAim.clear();\n      ','')
 .replaceAll('this.visual.clear();','this.visual.clear();\n      this.crawlerAim.clear();\n      this.structures.get("crawler")?.controller.states.clear();');
fs.mkdirSync(dir,{recursive:true});
for(const [file,fix] of [['src/shared/game.ts',gameFix],['src/client/render.ts',renderFix]]){
 let output=fix(fs.readFileSync(file,'utf8'));
 if(file.includes('render'))output=output.replace('visual = new Map();','visual = new Map<string, T.Vector3>();').replace('crawlerAim = new Map();','private crawlerAim = new Map<number, { cool: number; time: number; until: number }>();');
 fs.writeFileSync(dir+'/'+file.split('/').at(-1)+'.proposed.txt',output);
}
