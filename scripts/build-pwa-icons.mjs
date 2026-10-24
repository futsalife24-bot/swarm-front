import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const original=fs.readFileSync('assets/art/app-icon-user-20261024.png');
assert.equal(createHash('sha256').update(original).digest('hex'),'7229dc0ab2eed9b0f518c2c32f3a123976b87a831ac573be1edf1aa0d3611b64','原本画像のSHA256が一致しません');
const source='data:image/png;base64,'+original.toString('base64');
const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage();
 for(const [size,maskable] of [[192,false],[512,false],[512,true],[180,false],[64,false]]) {
  const png=await page.evaluate(async({source,size,maskable})=>{
   const img=new Image();img.src=source;await img.decode();
   if(img.width!==1254||img.height!==1254)throw new Error('原本画像の寸法が一致しません');
   const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   ctx.fillStyle='#020d10';ctx.fillRect(0,0,size,size);
   // 原本全体を切らずに縮小。maskableだけ余白を加えて主タイトルを安全領域へ収める。
   const contentSize=maskable?440:size, offset=(size-contentSize)/2;
   ctx.drawImage(img,offset,offset,contentSize,contentSize);return c.toDataURL('image/png').split(',')[1];
  },{source,size,maskable});
  const filename=`public/icon-swarm-v4-${size}${maskable?'-maskable':''}.png`;
  fs.writeFileSync(filename,Buffer.from(png,'base64'));console.log(filename);
 }
}finally{await browser.close()}
