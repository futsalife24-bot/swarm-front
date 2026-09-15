import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const p=await browser.newPage({viewport:{width:1280,height:650}});
  await p.clock.install(); await p.goto('http://127.0.0.1:5326'); await p.locator('#solo').click(); await p.locator('[data-pick="1"]').click();
  await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+2000));
  await p.addStyleTag({content:':root { --safe-top: 100px; --safe-bottom: 40px; } .gear .gear-footer .status { font-size: 16px; }'});
  await p.locator('.gear-footer .status').evaluate(e=>e.textContent='作戦を離脱しました。未確定品は保存されません。');
  const measure=()=>p.evaluate(()=>{const slot=document.querySelector('[data-pick="1"]'),brief=document.querySelector('.gear-brief'), workspace=document.querySelector('.gear-workspace');return {slotBottom:slot.getBoundingClientRect().bottom,workspaceBottom:workspace.getBoundingClientRect().bottom,briefOverflow:brief.scrollHeight-brief.clientHeight,slotOverflow:slot.scrollHeight-slot.clientHeight};});
  const after=await measure();
  await p.screenshot({path:'dist-validation/menu-design/regression-after.png'});
  await p.evaluate(()=>{const style=[...document.querySelectorAll('style[data-vite-dev-id]')].find(e=>e.dataset.viteDevId.endsWith('/menu-theme.css')); if(!style) throw Error('theme missing'); style.sheet.disabled=true;});
  const before=await measure();
  await p.screenshot({path:'dist-validation/menu-design/regression-before.png'});
  assert.ok(before.slotBottom>before.workspaceBottom, 'baseline must reproduce overflow');
  assert.ok(after.slotBottom<=after.workspaceBottom && after.slotOverflow<=1 && after.briefOverflow<=1);
  writeFileSync('dist-validation/menu-design/regression.json',JSON.stringify({condition:'1280x650, safe top 100px / bottom 40px, footer text 16px; theme stylesheet disabled only for baseline',before,after},null,2));
  console.log(JSON.stringify({before,after}));
} finally { await browser.close(); }
