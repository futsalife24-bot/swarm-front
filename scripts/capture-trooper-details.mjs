import {chromium} from '@playwright/test';
const b=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await b.newPage({viewport:{width:1000,height:900}});await p.clock.install();await p.goto('http://127.0.0.1:5314/assets/blender/preview-trooper/');await p.waitForFunction(()=>window.trooperQA);await p.clock.pauseAt(new Date(Date.now()+100));
for(const side of ['front','back']){await p.evaluate(side=>{const q=trooperQA;document.querySelector('aside').style.display='none';q.camera.position.set(side==='front'?.65:.7,1.6,side==='front'?-1.9:1.9);q.camera.lookAt(0,1.38,0);q.set('Weapon_Idle_Rifle',0)},side);await p.screenshot({path:`dist-validation/trooper-polish/detail-${side}.png`});}
}finally{await b.close()}
