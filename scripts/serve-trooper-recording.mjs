import {createServer} from 'node:http';
import {writeFileSync,mkdirSync} from 'node:fs';
const dir='dist-validation/trooper-run-v6';mkdirSync(dir,{recursive:true});
createServer((req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:5326');
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
 const files={'/video':'before-after.webm','/qa':'browser-checks.json'};
 if(req.method!=='POST'||!files[req.url]){res.writeHead(404);res.end();return}
 const chunks=[];let size=0;req.on('data',chunk=>{size+=chunk.length;if(size>150e6)req.destroy();else chunks.push(chunk)});
 req.on('end',()=>{writeFileSync(`${dir}/${files[req.url]}`,Buffer.concat(chunks));res.end('saved');console.log(files[req.url],size)});
}).listen(5327,'127.0.0.1',()=>console.log('Local recording receiver :5327'));
