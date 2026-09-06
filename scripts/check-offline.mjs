import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
let serverRunning=false;
try {const r=await fetch('http://127.0.0.1:8787/health',{signal:AbortSignal.timeout(1500)});serverRunning=r.ok;}catch{}
assert.equal(serverRunning,false,'Stop this project\'s local Workers server before this check.');
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {const page=await browser.newPage();await page.goto('http://127.0.0.1:5186/');await page.getByRole('button',{name:'ソロで出撃準備'}).click();await page.getByRole('button',{name:'ソロ出撃'}).click();await page.locator('#hud').waitFor({state:'visible'});const status=await page.evaluate(()=>window.__swarm.world.phase);assert.equal(status,'battle');writeFileSync('docs/evidence/offline.json',JSON.stringify({workersReachable:false,soloStarted:true,transportMock:false},null,2));console.log('PASS: Workers stopped; standalone solo started in Chrome.');}finally{await browser.close();}
