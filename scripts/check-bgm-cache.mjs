import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/sw.js','utf8');
for(const [status,fail] of [[206,false],[200,false],[200,true]]){
 const handlers={};let writes=0,promise;
 const response=new Response(new Uint8Array([1,2,3]),{status});
 vm.runInNewContext(source,{URL,Response,self:{registration:{scope:'https://game.test/'},addEventListener:(name,fn)=>handlers[name]=fn},fetch:async()=>response,caches:{match:async()=>undefined,open:async()=>({put:async()=>{writes++;if(fail)throw Error('quota');}})}});
 handlers.fetch({request:new Request('https://game.test/assets/audio/bgm-v1/title.mp3',{headers:status===206?{Range:'bytes=0-2'}:{}}),respondWith:p=>promise=p});
 const actual=await promise;assert.equal(actual.status,status);assert.deepEqual([...new Uint8Array(await actual.arrayBuffer())],[1,2,3]);assert.equal(writes,status===206?0:1);
}
console.log('PASS service worker: partial stream passes through, complete response cached, quota failure preserves playback');
