import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../..'),out=path.join(repo,'output/echo-line');
await mkdir(out,{recursive:true});
const mode=process.argv[2]||'preview', width=Number(process.argv[3])||(mode==='preview'?960:1920);
const routes=new Map(['index.html','film.mjs','tower.mjs','landscape.mjs','recorder.mjs','recorder-surfaces.mjs'].map(f=>['/'+f,path.join(dir,f)]));
routes.set('/',''+path.join(dir,'index.html'));routes.set('/score.wav',path.join(out,'score.wav'));
const ray='/public/assets/enemies/ray_motion_v1.glb';routes.set(ray,path.join(repo,ray));
const threeDir=path.join(repo,'node_modules/three');
const mime={'.mjs':'application/javascript','.js':'application/javascript','.html':'text/html; charset=utf-8','.glb':'model/gltf-binary','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  let file=routes.get(url.pathname);
  if(url.pathname.startsWith('/three/')){
    const candidate=path.resolve(threeDir,url.pathname.slice(7));
    if(candidate.startsWith(threeDir+path.sep))file=candidate;
  }
  if(!file||!existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');createReadStream(file).on('error',()=>res.destroy()).pipe(res);
});
server.listen(mode==='serve'?4178:0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
if(mode==='serve'){console.log(origin);await new Promise(()=>{});}
const installed=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser,encoder;
try {
  browser=await chromium.launch({executablePath:process.env.CINEMA_CHROME||installed,headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--enable-webgl','--ignore-gpu-blocklist']});
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>{console.error(e.message);errors.push(e.message);});
  page.on('console',msg=>{if(msg.type()==='error'&&!msg.text().includes('404')){console.error(msg.text());errors.push(msg.text());}});
  await page.goto(origin+'/?capture=1&w='+width);
  await page.waitForFunction(()=>window.film,{},{timeout:60000});
  const identity=await page.evaluate(()=>window.film.renderer);
  console.log('描画開始',mode,width,identity);
  const frame=async(t)=>{
    const url=await page.evaluate(t=>{window.film.draw(t);return document.querySelector('canvas').toDataURL('image/jpeg',.955);},t);
    return Buffer.from(url.slice(url.indexOf(',')+1),'base64');
  };
  if(mode==='preview'){
    for(const t of [2.6,7.2,12.5,17.8,22.4,26.8,30.2,33.5,37.8])await writeFile(path.join(out,'shot-'+String(t).padStart(4,'0')+'.jpg'),await frame(t));
  }else if(['render','world','inserts'].includes(mode)){
    const cuts=[0,120,240,780,840,960];
    for(let shot=0;shot<cuts.length-1;shot++){
      const interior=shot%2===1;
      if((mode==='world'&&interior)||(mode==='inserts'&&!interior))continue;
      const segment=path.join(out,'segment-'+shot+'.mp4');
      encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','24','-vcodec','mjpeg','-i','pipe:0','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-vf','scale=out_color_matrix=bt709:out_range=tv',segment],{stdio:['pipe','inherit','inherit'],windowsHide:true});
      const ended=once(encoder,'close');
      for(let i=cuts[shot];i<cuts[shot+1];i++){
        const jpeg=await frame(i/24);
        if(!encoder.stdin.write(jpeg))await once(encoder.stdin,'drain');
        if(i%96===0)console.log('フレーム',i,'/ 960');
      }
      encoder.stdin.end();const [code]=await ended;if(code!==0)throw new Error('FFmpeg '+code);
    }
    if(mode!=='world'){
      const manifest=path.join(out,'segments.txt');
      await writeFile(manifest,Array.from({length:5},(_,i)=>"file 'segment-"+i+".mp4'").join('\n')+'\n');
      const mux=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','1','-i',manifest,'-i',path.join(out,'score.wav'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','medium','-crf','19','-maxrate','9M','-bufsize','12M','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-movflags','+faststart','-metadata','title=SWARM FRONT｜残響線',path.join(out,'SWARM FRONT - 残響線.mp4')],{stdio:'inherit',windowsHide:true});
      const [code]=await once(mux,'close');if(code!==0)throw new Error('音声合成 '+code);
    }
  }else throw new Error('preview / render / serve を指定してください');
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('完了',mode);
}finally{
  if(encoder&&encoder.exitCode===null)encoder.kill();
  if(browser)await browser.close();server.close();
}
