import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const b=await chromium.launch({channel:'chrome'});
try {
const p=await b.newPage({viewport:{width:844,height:390},serviceWorkers:'block'});
await p.goto('http://127.0.0.1:5348/?playtest=1&menuSample=1');
const button=p.locator('[data-lock]').first();
await button.waitFor();
for(const locked of [true,false,true]){
if((await button.getAttribute('aria-pressed'))!==String(locked)) { await button.locator('img').click(); if(!locked) await p.locator('#pt-confirm').click(); }
assert.equal(await button.getAttribute('aria-pressed'),String(locked));
assert.equal(await p.locator('dialog[open]').count(),0);
assert.ok((await button.locator('img').getAttribute('src')).endsWith(locked?'weapon-locked.png':'weapon-unlocked.png'));
await button.locator('img').evaluate(img=>img.decode());
await p.screenshot({path:`dist-validation/lock-icons/${locked?'locked':'unlocked'}-844.png`});
}
await p.locator('[data-pinned] [data-detail]').click();
await p.locator('#pt-detail-lock img').evaluate(img=>img.decode());
await p.locator('#pt-detail-lock').scrollIntoViewIfNeeded();
await p.screenshot({path:'dist-validation/lock-icons/detail.png'});
fs.writeFileSync('dist-validation/lock-icons/icons.json',JSON.stringify({imageDecode:true,imageClickToggle:true,noAccidentalDialog:true,detailImage:true}));
console.log('PASS image loading, both states, image click toggle, no accidental detail, detail icon');
} finally {await b.close();}


