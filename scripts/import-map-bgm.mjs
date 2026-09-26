import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Import only explicitly listed Suno songs, identified by their embedded source URL.
// Chrome may retain a completed download under a temporary name; never rename/delete it.
const directory=process.argv[2];
if(!directory)throw Error('Pass the download directory');
const manifestPath='docs/MAP-BGM-SOURCES.json';
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const files=fs.readdirSync(directory).map(name=>path.join(directory,name)).filter(p=>{
 const s=fs.statSync(p);return s.isFile()&&s.size>100000&&s.mtimeMs>Date.now()-24*60*60*1000;
});
for(const song of manifest.songs){
 if(fs.existsSync(song.file))continue;
 const source=files.find(file=>{
  const fd=fs.openSync(file,'r'),header=Buffer.alloc(8192);
  try{const n=fs.readSync(fd,header,0,header.length,0);return header.subarray(0,n).toString('utf8').includes(song.sunoUrl);}finally{fs.closeSync(fd);}
 });
 if(!source){console.log('Pending: '+song.title);continue;}
 const data=fs.readFileSync(source);fs.writeFileSync(song.file,data,{flag:'wx'});
 console.log(JSON.stringify({map:song.map,songId:song.songId,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')}));
}
