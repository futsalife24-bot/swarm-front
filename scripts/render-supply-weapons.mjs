// 現行GLBを武器詳細と同じカメラ・照明で透過画像にする。外部送信はしない。
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const sample=process.argv.includes('--sample');
const out=sample?'dist-validation/supply-weapon-cutouts/sample':'public/supply-reveal/assets';
await fs.mkdir(out,{recursive:true});
const source=`import {KINDS} from './src/shared/defs.ts';
import {makeWeapon} from './src/shared/progression.ts';
import {weaponModelUrl} from './src/client/weapon-model-url.ts';
import {weaponCutout} from './src/client/weapon-sharing.ts';
window.kinds=KINDS;window.renderWeapon=async(kind,grade)=>{
 const w=makeWeapon('cutout-'+kind+'-'+grade,kind,grade,{power:0,reload:0,range:0,rate:0},false,0);
 const data=await weaponCutout(w),im=new Image();im.src=data;await im.decode();
 const canvas=document.createElement('canvas');canvas.width=im.width;canvas.height=im.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let opaque=0,clear=0,minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1;
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
  if(pixels[(y*canvas.width+x)*4+3]>20){opaque++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}else clear++;
 }
 if(maxX<minX||maxY<minY)throw Error('武器の画像が空です');
 const cut=document.createElement('canvas');cut.width=1024;cut.height=512;const c=cut.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
 const bw=maxX-minX+1,bh=maxY-minY+1,scale=Math.min(1024*.93/bw,512*.84/bh),drawWidth=bw*scale,drawHeight=bh*scale;
 c.drawImage(canvas,minX,minY,bw,bh,(1024-drawWidth)/2,(512-drawHeight)/2,drawWidth,drawHeight);
 return {data:cut.toDataURL('image/webp',.94),url:weaponModelUrl(kind,grade),width:im.width,height:im.height,opaque,clear};
};`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'supply-cutout.js'},bundle:true,format:'esm',platform:'browser',write:false,define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}});
const root=path.resolve('public/assets/weapons');
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/')return void res.writeHead(200,{'Content-Type':'text/html'}).end('<script type="module" src="/bundle.js"></script>');
 if(url.pathname==='/bundle.js')return void res.writeHead(200,{'Content-Type':'text/javascript'}).end(bundle.outputFiles[0].contents);
 if(!url.pathname.startsWith('/assets/weapons/'))return void res.writeHead(404).end();
 const file=path.resolve(root,url.pathname.slice('/assets/weapons/'.length));if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();
 try{const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':'model/gltf-binary'}).end(data);}catch{res.writeHead(404).end();}
});
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});const page=await browser.newPage();
 const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/weapons/')&&!r.ok())failed.push({url:r.url(),status:r.status()});});
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!!window.renderWeapon);
 const kinds=await page.evaluate(()=>window.kinds);const selected=sample?['rifle','heavy','medic']:kinds;const records=[];
 for(const kind of selected)for(let grade=0;grade<5;grade++){
  const result=await page.evaluate(({kind,grade})=>window.renderWeapon(kind,grade),{kind,grade});
  if(!result.data.startsWith('data:image/webp;base64,')||result.width!==1024||result.height!==512||result.opaque<500||result.clear<500)throw Error(`${kind}/${grade}: 画像が不正`);
  const output=Buffer.from(result.data.split(',')[1],'base64'),input=await fs.readFile(path.join('public',result.url));
  const name=`w-v2-${kind}-${grade}.webp`;await fs.writeFile(path.join(out,name),output);
  records.push({kind,grade,input:result.url,inputSha256:createHash('sha256').update(input).digest('hex'),file:name,sha256:createHash('sha256').update(output).digest('hex'),bytes:output.length,width:result.width,height:result.height,opaque:result.opaque,clear:result.clear});
 }
 if(errors.length||failed.length)throw Error(JSON.stringify({errors,failed}));
 await fs.mkdir('dist-validation/supply-weapon-cutouts',{recursive:true});
 await fs.writeFile(`dist-validation/supply-weapon-cutouts/${sample?'sample':'report'}.json`,JSON.stringify({scope:'Accepted GLB rendered by the actual weapon detail camera and lights, transparent background; local browser.',records,errors,failed},null,2));
 console.log(JSON.stringify({kinds:selected.length,images:records.length,errors:errors.length,failed:failed.length}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
