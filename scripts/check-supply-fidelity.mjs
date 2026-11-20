// 元動画の場面と同一の時刻・FX値・画像サイズで移植先を撮影する。
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.resolve(project, '..');
const { chromium } = createRequire(path.join(project, 'package.json'))('@playwright/test');
const out = path.join(project, 'docs/evidence/supply-kakutei-20261111/ported-stills');
fs.mkdirSync(out, { recursive: true });
const prefix = '/' + path.basename(project) + '/public/supply-reveal/';
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${prefix}gacha.css"><body style="margin:0"><script type="module">
import {createSupplyReveal} from '${prefix}runtime.js';
import {PRESETS1,PRESETS10} from '${prefix}core.js';
import {CLIPS} from '${prefix}reference-scenes.js';
const reveal=createSupplyReveal(document.body,{captions:true,warm:false});
await reveal.ready; window.PROBE={reveal,PRESETS1,PRESETS10,CLIPS};
</script></body></html>`;
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.ttf':'font/ttf' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/probe.html') { res.setHeader('content-type','text/html'); res.end(html); return; }
  const file = path.resolve(workspace, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(workspace + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0,'127.0.0.1',r));
let browser;
const errors=[];
const records=[];
try {
  browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11','--mute-audio']});
  const page=await(await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2})).newPage();
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/probe.html`);
  await page.waitForFunction(()=>window.PROBE&&document.fonts.status==='loaded');
  for(let n=1;n<=10;n++) {
    const count=await page.evaluate(async n=>{
      const p=window.PROBE,c=p.CLIPS[n-1],[num,key]=c.scene.split(':');
      await p.reveal.play((num==='10'?p.PRESETS10:p.PRESETS1)[key],{manual:true,silent:true,effects:n});
      await Promise.all([...document.images].map(im=>im.complete?0:im.decode().catch(()=>{})));
      const m=p.reveal.model();
      p.segments=c.make({B:m.tLaunch,stops:m.stops,cues:m.cues,pods:m.pods});
      return p.segments.length;
    },n);
    let clock=0,k=0;
    for(let index=0;index<count;index++) {
      const info=await page.evaluate(index=>({d:PROBE.segments[index].d,fx:!!PROBE.segments[index].fx}),index);
      for(const u of info.fx?[0.25,0.7]:[0.6]) {
        await page.evaluate(({n,index,u,clock})=>{
          const p=PROBE,c=p.CLIPS[n-1],s=p.segments[index];
          const st={...(s.fx?s.fx(s.d*u,u):{id:null}),caption:c.caption,sub:c.sub,gold:!!s.gold,notap:!!s.notap,right:!!c.right};
          if(st.p&&'snap' in st.p) st.p.snap=true;
          p.reveal.seek(s.a+(s.b-s.a)*u,clock+s.d*u,!!s.tap,st);
        },{n,index,u,clock});
        const name=`${String(n).padStart(2,'0')}-${k++}.jpg`;
        await page.screenshot({path:path.join(out,name),type:'jpeg',quality:86});
        records.push({n,index,u,name});
      }
      clock+=info.d;
    }
  }
  const ported=path.join(project,'public/supply-reveal');
  const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const manifest=JSON.parse(fs.readFileSync(path.join(project,'docs/evidence/supply-kakutei-20261111/reference-manifest.json'),'utf8'));
  const normalized=s=>s.replaceAll('\r\n','\n');
  const stringHash=s=>crypto.createHash('sha256').update(normalized(s)).digest('hex');
  const assets=manifest.assets.map(({name,sha256,normalizedSha256})=>({name,equal:normalizedSha256?stringHash(normalized(fs.readFileSync(path.join(ported,'assets',name),'utf8')).split('\n').map(l=>l.trimEnd()).join('\n').trimEnd()+'\n')===normalizedSha256:hash(path.join(ported,'assets',name))===sha256}));
  const core=fs.readFileSync(path.join(ported,'core.js'),'utf8'),fx=fs.readFileSync(path.join(ported,'kakutei-fx.js'),'utf8'),audio=fs.readFileSync(path.join(ported,'sfx.js'),'utf8');
  const formulas={renderer:stringHash(core.slice(core.indexOf('function createRenderer('),core.indexOf('const loadImg')))===manifest.renderer,fx:stringHash(fx.slice(fx.indexOf('const FX = {'),fx.indexOf('export async function install')))===manifest.fx,audio:stringHash(audio.slice(0,audio.indexOf('// ブラウザ用：')))===manifest.audioFormula,css:stringHash(fs.readFileSync(path.join(ported,'gacha.css'),'utf8'))===manifest.css};
  const report={frames:records,assets,formulas,errors};
  fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({frames:records.length,assetsMatch:assets.every(a=>a.equal),formulas,errors}));
  if(errors.length||assets.some(a=>!a.equal)||Object.values(formulas).some(v=>!v)) process.exitCode=1;
} finally { await browser?.close(); server.close(); }
