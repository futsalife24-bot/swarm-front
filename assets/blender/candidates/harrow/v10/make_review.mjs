import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {build} from 'esbuild';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../../../..');
const out=path.join(root,'dist-validation/harrow-v10');fs.mkdirSync(out,{recursive:true});
const models=Object.fromEntries(['v9','v10'].map(v=>[v,'data:model/gltf-binary;base64,'+fs.readFileSync(path.join(here,'..',v,'harrow.glb')).toString('base64')]));
let source=fs.readFileSync(path.join(root,'scripts/harrow-v10-preview.ts'),'utf8');
source='const MODELS='+JSON.stringify(models)+';\n'+source.replace('`/assets/blender/candidates/harrow/${request.version}/harrow.glb`','MODELS[request.version]');
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:path.join(root,'scripts')},bundle:true,write:false,minify:true,format:'iife',target:'es2022'});
let html=fs.readFileSync(path.join(root,'scripts/harrow-v10-preview.html'),'utf8').replace('<script type="module" src="./harrow-v10-preview.ts"></script>',()=>'<script>'+result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
fs.writeFileSync(path.join(out,'HARROW-v10-review.html'),html);
console.log('OFFLINE_REVIEW_BYTES',Buffer.byteLength(html));
if(process.argv.includes('--serve'))http.createServer((req,res)=>{
 if(req.method==='POST'&&req.url==='/record'){
  const chunks=[];let size=0;req.on('data',b=>{size+=b.length;if(size>100*1024*1024)req.destroy();else chunks.push(b);});
  req.on('end',()=>{fs.writeFileSync(path.join(out,'flight.webm'),Buffer.concat(chunks));res.end('flight.webm');});return;
 }
 if(req.url==='/flight.webm'){const file=path.join(out,'flight.webm');if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','video/webm');res.end(fs.readFileSync(file));return;}
 if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
 res.writeHead(404);res.end();
}).listen(5200,'127.0.0.1',()=>console.log('REVIEW http://127.0.0.1:5200/'));
