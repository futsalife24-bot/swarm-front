import fs from 'node:fs';
import {chromium} from '@playwright/test';
const source='data:image/jpeg;base64,'+fs.readFileSync('assets/art/app-icon-user-20260914.jpg').toString('base64');
const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage();
 for(const [size,maskable] of [[192,false],[512,false],[512,true],[180,false],[64,false]]) {
  const png=await page.evaluate(async({source,size,maskable})=>{
   const img=new Image();img.src=source;await img.decode();
   const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   ctx.fillStyle='#020d10';ctx.fillRect(0,0,size,size);
   // Crop around the lettering's centre, rather than the full artwork's centre.
   // Identical framing for all purposes avoids extra padding in installed icons.
   const crop=img.width/1.16, cx=img.width*.5, cy=img.height*(604/1280);
   ctx.drawImage(img,cx-crop/2,cy-crop/2,crop,crop,0,0,size,size);return c.toDataURL('image/png').split(',')[1];
  },{source,size,maskable});
  const filename=`public/icon-swarm-v3-${size}${maskable?'-maskable':''}.png`;
  fs.writeFileSync(filename,Buffer.from(png,'base64'));console.log(filename);
 }
}finally{await browser.close()}
