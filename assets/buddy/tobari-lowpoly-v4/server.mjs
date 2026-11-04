import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../..');
const deps=[path.join(root,'node_modules'),path.resolve(root,'../node_modules')].find(p=>fs.existsSync(path.join(p,'three')));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.glb':'model/gltf-binary','.png':'image/png','.json':'application/json','.mp4':'video/mp4'};
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const bases=[['/deps/',deps],['/soldier/',path.join(root,'public/assets/characters')],['/',here]];
  const [prefix,base]=bases.find(([p])=>url.pathname.startsWith(p));
  const file=path.resolve(base,decodeURIComponent(url.pathname.slice(prefix.length))||'index.html');
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(err?'見つかりません':data);});
}).listen(Number(process.env.BUDDY_PORT||4317),'127.0.0.1',()=>console.log('BUDDY_READY'));
