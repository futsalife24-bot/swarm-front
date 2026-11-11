// Real previewWeapon/weaponImage against shipped GLBs, without sending a share.
// --available allows an incomplete production batch; omit for the final check.
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const out = "dist-validation/weapon-preview-sharing";
const kinds = ["rifle", "smg", "shotgun", "slug", "rocket", "heavy", "sniper", "laser", "grenade", "sticky", "kick", "medic"];
const present = [];
const missing = [];
for (const [i, kind] of kinds.entries()) {
  const directory = ["rifle", "shotgun", "rocket"].includes(kind) ? "realism-v2" : "unique-v1";
  try {
    await fs.access(`public/assets/weapons/${directory}/${kind}_${i % 5}.glb`);
    present.push(kind);
  } catch { missing.push(kind); }
}
await fs.mkdir(out, { recursive: true });
const browserSource = `
import { previewWeapon, weaponImage } from './src/client/weapon-sharing.ts';
import { makeWeapon } from './src/shared/progression.ts';
import { WEAPONS } from './src/shared/defs.ts';
const kinds = ${JSON.stringify(kinds)}, present = ${JSON.stringify(present)};
document.body.innerHTML = '<h1>武器詳細プレビュー・共有画像</h1><p>各武器の上段が詳細プレビュー、下段が実際の共有画像。比較用の個別画面です。</p><main></main>';
const main = document.querySelector('main'), rows = [];
function foreground(canvas, region) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0;
  for (let y=region[0]; y<region[1]; y++) for (let x=0; x<canvas.width; x++) {
    const i=(y*canvas.width+x)*4;
    if (pixels[i+3] && Math.abs(pixels[i]-17)+Math.abs(pixels[i+1]-35)+Math.abs(pixels[i+2]-47)>30) count++;
  }
  return count;
}
window.check = (async () => {
  for (const [i, kind] of kinds.entries()) {
    const cell=document.createElement('section'); main.append(cell);
    const label=document.createElement('h2'); label.textContent=WEAPONS[kind].name+' / '+['N','R','SR','SSR','LR'][i%5]; cell.append(label);
    if (!present.includes(kind)) { cell.append('未生成'); rows.push({kind,missing:true}); continue; }
    try {
      const w=makeWeapon('preview-'+kind,kind,i%5,{power:0,reload:0,range:0,rate:0},false,i);
      const host=document.createElement('div'); host.className='preview'; cell.append(host);
      const dispose=await previewWeapon(host,w);
      const actual=host.querySelector('canvas');
      if (!actual) throw Error('preview canvas missing');
      const copy=document.createElement('canvas'); copy.width=actual.width; copy.height=actual.height;
      copy.getContext('2d').drawImage(actual,0,0);
      const previewPixels=foreground(copy,[0,copy.height]);
      const previewImage=document.createElement('img'); previewImage.src=copy.toDataURL();
      dispose(); host.replaceChildren(previewImage);
      const blob=await weaponImage(w);
      if (blob.type!=='image/png' || !blob.size) throw Error('share image blob empty');
      const bitmap=await createImageBitmap(blob);
      const shareCanvas=document.createElement('canvas'); shareCanvas.width=bitmap.width; shareCanvas.height=bitmap.height;
      shareCanvas.getContext('2d').drawImage(bitmap,0,0); bitmap.close();
      const sharePixels=foreground(shareCanvas,[70,440]);
      const shareImage=document.createElement('img'); shareImage.className='share'; shareImage.src=shareCanvas.toDataURL(); cell.append(shareImage);
      if (previewPixels<100 || sharePixels<500) throw Error('blank image '+previewPixels+'/'+sharePixels);
      rows.push({kind,rarity:i%5,previewPixels,sharePixels,bytes:blob.size,shareSize:[shareCanvas.width,shareCanvas.height]});
    } catch(e) {
      const message=String(e); cell.append('検証失敗: '+message); rows.push({kind,error:message});
    }
  }
  return rows;
})();`;
const bundle = await build({
  stdin: { contents: browserSource, resolveDir: process.cwd(), sourcefile: "preview-sharing-check.js" },
  bundle: true, write: false, format: "esm", platform: "browser",
  define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
});
const html = `<html lang="ja"><meta charset="utf-8"><style>
body{margin:0;padding:12px;background:#11232f;color:white;font:14px sans-serif}h1{font-size:20px;margin:0}p{margin:6px 0 12px}main{display:grid;grid-template-columns:repeat(2,390px);gap:10px}section{background:#203846;padding:8px;min-height:360px}h2{font-size:16px;margin:0 0 5px}.preview{width:374px;height:170px;background:#11232f}.preview img{width:100%;height:170px}.share{width:100%;height:auto;display:block;margin-top:6px}
</style><body><script type="module" src="/bundle.js"></script></body></html>`;
const server = http.createServer(async (req, res) => {
  const name = new URL(req.url, "http://127.0.0.1").pathname;
  if (name === "/") return void res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"}).end(html);
  if (name === "/bundle.js") return void res.writeHead(200, {"Content-Type":"text/javascript"}).end(bundle.outputFiles[0].contents);
  if (!name.startsWith("/assets/weapons/")) return void res.writeHead(404).end();
  const relative = name.slice(1), target = path.resolve("public", relative), root = path.resolve("public", "assets", "weapons");
  if (!target.startsWith(root + path.sep)) return void res.writeHead(403).end();
  try { res.writeHead(200, {"Content-Type":"model/gltf-binary"}).end(await fs.readFile(target)); }
  catch { res.writeHead(404).end(); }
});
let browser;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({channel:"chrome",args:["--use-angle=d3d11"]});
  const page = await browser.newPage({viewport:{width:844,height:390},serviceWorkers:"block"});
  const errors = [], failedRequests = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("response", r => { if (r.url().includes("/assets/weapons/") && !r.ok()) failedRequests.push({url:r.url(),status:r.status()}); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => !!window.check);
  const rows = await page.evaluate(() => window.check);
  await page.screenshot({path:`${out}/preview-sharing.png`,fullPage:true});
  const report = {scope:"Product previewWeapon and weaponImage with local GLBs; separate review page, not actual detail dialog or a share action",viewport:[844,390],missing,rows,errors,failedRequests};
  await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  if (errors.length || failedRequests.length || rows.some(row=>row.error) || (missing.length && !process.argv.includes("--available"))) {
    console.error(JSON.stringify(report,null,2)); process.exitCode=1;
  } else console.log(JSON.stringify(report,null,2));
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
