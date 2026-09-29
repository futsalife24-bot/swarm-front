import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile,FileBlob} from '@oai/artifact-tool';

const repo=process.env.SWARM_REPO;
const workspace=process.env.SWARM_WORKSPACE;
const skill=process.env.PRESENTATION_SKILL;
const dir=path.join(repo,'docs/presentations/rebuild-20260929');
const build=path.join(workspace,'artifacts/update-presentation/.build');
const out=path.join(dir,'output');
const {slides,sourceBase}=await import(pathToFileURL(path.join(dir,'content.mjs')).href);
const p=Presentation.create({slideSize:{width:1280,height:720}});
const C={bg:'#102027',white:'#F0F5F3',muted:'#B4C9CA',mint:'#8FE0BE',orange:'#FFB177',cyan:'#87D7F2'};
const assets={poster:path.join(dir,'assets/update-concept.png'),trooper:path.join(repo,'docs/evidence/trooper-design-v9/rifle-oblique.jpg'),calyx:path.join(repo,'docs/evidence/calyx-v5/hero.png'),battle:path.join(repo,'docs/evidence/clean-capture/844-clean.png'),title:path.join(repo,'docs/evidence/weekly-title/title-1280.png')};
function txt(s,text,x,y,w,h,size=28,color=C.white,bold=false){
 const a=s.shapes.add({geometry:'textbox',name:text.slice(0,32),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 a.text=text;a.text.style={typeface:'Yu Gothic',fontSize:size,bold,color,wrap:'square',autoFit:'none',insets:{left:0,right:0,top:0,bottom:0}};return a;
}
async function picture(s,key,frame,crop){const f=assets[key];s.images.add({blob:new Uint8Array(await fs.readFile(f)),contentType:f.endsWith('.jpg')?'image/jpeg':'image/png',alt:key,fit:'contain',position:frame,...(crop?{crop}:{} )});}
for(let i=0;i<slides.length;i++){
 const d=slides[i],s=p.slides.add();s.background.fill=C.bg;
 txt(s,'SWARM FRONT  /  REBUILD CONCEPT',70,24,1000,30,17,C.muted);
 txt(s,d.title,70,70,1140,78,d.title.length>23?41:46,C.white,true);
 txt(s,'共同設計 v1  •  実装前の提案',70,683,700,24,16,C.muted);
 txt(s,`${String(i+1).padStart(2,'0')} / ${slides.length}`,1110,680,100,27,19,C.muted);
 if(d.kind==='cover'){
  await picture(s,'poster',{left:70,top:159,width:740,height:418});
  txt(s,d.subtitle,850,178,360,100,40,C.mint,true);
  txt(s,d.lead,850,324,340,130,32,C.white,true);
  txt(s,'変更・成長・爽快感\n守る魅力と、増える魅力',850,479,350,92,24,C.muted);
  txt(s,d.caption,70,613,1140,35,21,C.muted);
 }else if(d.kind==='statement'){
  txt(s,d.big,70,180,1135,235,68,C[d.accent],true);
  txt(s,d.body,74,448,1120,160,30,C.white);
 }else if(d.kind==='table'){
  const vals=[d.headers,...d.rows],n=vals.length;
  const h=n>=8?440:n>=7?434:n>=6?430:360;
  const t=s.tables.add({rows:n,columns:3,left:70,top:173,width:1140,height:h,columnWidths:d.widths,values:vals});
  t.borders.assign({style:'solid',fill:'#3A5359',width:0.65});
  t.cells.block({row:0,column:0,rowCount:n,columnCount:3}).assign({margins:{left:14,right:14,top:9,bottom:8},anchor:'center'});
  for(let r=0;r<n;r++)for(let c=0;c<3;c++){
   const cell=t.getCell(r,c);cell.fill=r===0?'#244348':r%2?'#142B31':'#193239';
   cell.text.style={typeface:'Yu Gothic',fontSize:r===0?24:25,bold:r===0||c===0,color:r===0?C.mint:C.white};
  }
 }else if(d.kind==='steps'){
  d.steps.forEach(([label,title,body],j)=>{const y=182+j*143;txt(s,label,70,y,195,50,31,C.mint,true);txt(s,title,298,y,910,50,34,C.white,true);txt(s,body,298,y+56,910,64,27,C.muted);});
 }else if(d.kind==='build'){
  const accent=C[d.accent];txt(s,d.tagline,70,159,1140,52,30,accent,true);
  d.parts.forEach(([a,b],j)=>{const y=239+j*82;txt(s,a,70,y,360,48,32,j===3?accent:C.white,true);txt(s,b,450,y+5,758,66,27,C.white);});
  txt(s,d.payoff,70,601,1140,48,30,accent,true);
 }else if(d.kind==='pair'){
  [d.left,d.right].forEach((a,j)=>{const x=70+j*590;txt(s,a.headline,x,192,550,80,57,j?C.orange:C.mint,true);txt(s,a.sub,x,305,550,80,32,C.white,true);txt(s,a.body,x,416,550,176,28,C.muted);});
 }else if(d.kind==='imageText'){
  if(d.image==='title'){
   await picture(s,d.image,{left:70,top:167,width:1140,height:247});
   d.items.forEach(([a,b],j)=>{const x=70+j*390;txt(s,a,x,446,365,62,29,C.mint,true);txt(s,b,x,517,355,110,26,C.white);});
  }else{
   await picture(s,d.image,{left:70,top:177,width:540,height:390},d.crop);
   txt(s,d.caption,70,590,540,48,20,C.muted);
   d.items.forEach(([a,b],j)=>{const y=188+j*151;txt(s,a,656,y,554,60,33,C.mint,true);txt(s,b,656,y+62,554,85,27,C.white);});
  }
 }
 if(d.foot)txt(s,d.foot,70,635,1140,42,19,C.muted);
 s.speakerNotes.textFrame.setText(d.notes+'\n\n出典：'+sourceBase+'docs/design/rebuild-20260929/DESIGN.md'+(d.image?'\n画像：'+path.relative(repo,assets[d.image]).replaceAll('\\','/'):'')+'\n提案と検証事項の説明。ゲームへの実装は未着手。');
}
await fs.mkdir(out,{recursive:true});await fs.mkdir(build,{recursive:true});
const candidate=path.join(build,'candidate.pptx');
await(await PresentationFile.exportPptx(p)).save(candidate);
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const tables=slides.flatMap((d,i)=>d.kind==='table'?[i+1]:[]);
const final=path.join(out,process.env.SWARM_PPTX_NAME||'swarm-front-major-update.pptx');
await finalizePresentation({workspaceDir:workspace,candidatePath:candidate,finalPath:final,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...tables.flatMap(n=>['--require-native-table-slide',String(n)])],requiredNativeTableOwnerSlides:tables,requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:['Yu Gothic']},verifyArtifactToolImport:true,receiptPath:path.join(build,path.basename(final)+'.validation.json')});
if(process.env.SWARM_SKIP_RASTER==='1'){console.log(final);process.exit(0);}
const finalDeck=await PresentationFile.importPptx(await FileBlob.load(final));
const renderDir=path.join(build,'renders');await fs.mkdir(renderDir,{recursive:true});
for(let i=0;i<slides.length;i++){
 const slide=finalDeck.slides.items[i];
 const png=await finalDeck.export({slide,format:'png',scale:1});
 await fs.writeFile(path.join(renderDir,`${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
 console.log(`Rendered ${i+1}/${slides.length}`);
}
await fs.writeFile(path.join(dir,'SPEAKER-NOTES.md'),'# スワフロ 大型アップデート — 解説\n\n'+slides.map((d,i)=>`## ${i+1}. ${d.title}\n\n${d.notes}\n`).join('\n')+'\n設計正本：'+sourceBase+'docs/design/rebuild-20260929/DESIGN.md\n','utf8');
console.log(final);
