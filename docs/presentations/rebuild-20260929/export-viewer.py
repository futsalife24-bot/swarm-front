"""Read the finalized PPTX and make an offline HTML companion (no PPTX edits).
The browser view preserves this deck's shapes, text, native tables and images.
It is not an Office renderer; PowerPoint rendering remains a separate check.
"""
import sys, zipfile, pathlib, posixpath, base64, html, json
import xml.etree.ElementTree as E

root=pathlib.Path(__file__).parent
source=root/'output/swarm-front-major-update-v2.pptx'
z=zipfile.ZipFile(source)
NS={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def f(e,p): return e.find(p,NS)
def fa(e,p): return e.findall(p,NS)
def px(v): return float(v)/9525
def color(e,p,default='#F0F5F3'):
 a=f(e,p+'/a:srgbClr');return '#'+a.get('val') if a is not None else default
def frame(e):
 x=f(e,'.//a:off');s=f(e,'.//a:ext')
 return f'left:{px(x.get("x"))}px;top:{px(x.get("y"))}px;width:{px(s.get("cx"))}px;height:{px(s.get("cy"))}px;'
def text(body):
 lines=[]
 for p in fa(body,'a:p'):
  spans=[]
  for r in fa(p,'a:r'):
   pr=f(r,'a:rPr');st=''
   if pr is not None:
    st=f'font-size:{float(pr.get("sz","2100"))/75}px;font-weight:{700 if pr.get("b")=="1" else 400};color:{color(pr,"a:solidFill")};'
   spans.append('<span style="'+st+'">'+html.escape(''.join(r.itertext()))+'</span>')
  lines.append('<p>'+''.join(spans)+'</p>')
 return ''.join(lines)
pages=[];notes=[]
for i in range(1,29):
 doc=E.fromstring(z.read(f'ppt/slides/slide{i}.xml'))
 rel=E.fromstring(z.read(f'ppt/slides/_rels/slide{i}.xml.rels'))
 rels={a.get('Id'):(a.get('Target').lstrip('/') if a.get('Target').lstrip('/').startswith('ppt/') else posixpath.normpath('ppt/slides/'+a.get('Target'))) for a in rel}
 bits=[]
 for e in f(doc,'p:cSld/p:spTree'):
  tag=e.tag.split('}')[-1]
  if tag=='sp':
   b=f(e,'p:txBody')
   if b is not None: bits.append('<div class="shape" style="'+frame(f(e,'p:spPr/a:xfrm'))+'">'+text(b)+'</div>')
  elif tag=='pic':
   rid=f(e,'p:blipFill/a:blip').get('{'+NS['r']+'}embed');a=rels[rid]
   mime='image/jpeg' if a.endswith(('.jpg','.jpeg')) else 'image/png'
   crop=f(e,'p:blipFill/a:srcRect');cropstyle='width:100%;height:100%;'
   if crop is not None:
    l,t,r,b=[float(crop.get(x,'0'))/100000 for x in ('l','t','r','b')]
    cropstyle=f'width:{100/(1-l-r)}%;height:{100/(1-t-b)}%;left:{-100*l/(1-l-r)}%;top:{-100*t/(1-t-b)}%;position:absolute;'
   bits.append('<div class="shape image" style="'+frame(f(e,'p:spPr/a:xfrm'))+'"><img alt="スライド資料" style="'+cropstyle+'" src="data:'+mime+';base64,'+base64.b64encode(z.read(a)).decode()+'"></div>')
  elif tag=='graphicFrame':
   table=f(e,'.//a:tbl')
   if table is None:continue
   w=[px(c.get('w')) for c in fa(table,'a:tblGrid/a:gridCol')];rows=[]
   for row in fa(table,'a:tr'):
    cells=[]
    for j,c in enumerate(fa(row,'a:tc')):
     pr=f(c,'a:tcPr');bg=color(pr,'a:solidFill','#102027')
     cells.append(f'<td style="width:{w[j]}px;background:{bg};">'+text(f(c,'a:txBody'))+'</td>')
    rows.append('<tr style="height:'+str(px(row.get('h')))+'px">'+''.join(cells)+'</tr>')
   bits.append('<table class="shape" style="'+frame(f(e,'p:xfrm'))+'"><colgroup>'+''.join(f'<col style="width:{v}px">' for v in w)+'</colgroup>'+''.join(rows)+'</table>')
 pages.append('<section class="slide" aria-label="スライド '+str(i)+'">'+''.join(bits)+'</section>')
 note=E.fromstring(z.read(f'ppt/notesSlides/notesSlide{i}.xml'))
 texts=[a.text or '' for a in fa(note,'.//a:t')];notes.append('\n'.join(texts))
css='''*{box-sizing:border-box}body{margin:0;background:#080f14;color:#f0f5f3;font-family:"Yu Gothic",Meiryo,sans-serif}header{height:58px;display:flex;align-items:center;justify-content:center;gap:16px}button,select{font:inherit;background:#244348;border:1px solid #506b72;color:white;padding:8px 16px;border-radius:5px}button:focus-visible,select:focus-visible{outline:3px solid #8fe0be}#stage{position:relative;margin:0 auto;overflow:hidden}.slide{width:1280px;height:720px;background:#102027;position:absolute;transform-origin:top left;display:none}.slide.active{display:block}.shape{position:absolute;overflow:visible}.shape p{margin:0;line-height:1.24;white-space:pre-wrap;overflow-wrap:normal;word-break:normal}.image{overflow:hidden}.image img{display:block}table{border-collapse:collapse;table-layout:fixed}td{padding:9px 14px 8px;border:1px solid #3a5359;vertical-align:middle}td p{line-height:1.26}aside{max-width:1120px;margin:24px auto 48px;padding:24px;font-size:20px;line-height:1.9;white-space:pre-wrap;background:#142b31}aside[hidden]{display:none}#hint{text-align:center;color:#b4c9ca;font-size:14px;padding:10px}'''
script='''const pages=[...document.querySelectorAll('.slide')],notes=NOTES;let index=0;const select=document.querySelector('select'),aside=document.querySelector('aside');function size(){const scale=Math.min(innerWidth/1280,(innerHeight-95)/720);const stage=document.querySelector('#stage');stage.style.width=(1280*scale)+'px';stage.style.height=(720*scale)+'px';pages.forEach(p=>p.style.transform=`scale(${scale})`)}function show(n){index=Math.max(0,Math.min(27,n));pages.forEach((p,i)=>p.classList.toggle('active',i===index));select.value=index;aside.textContent=notes[index];document.title=`${index+1}/28 スワフロ大型アップデート`;location.hash=index+1}document.querySelector('#prev').onclick=()=>show(index-1);document.querySelector('#next').onclick=()=>show(index+1);select.onchange=()=>show(+select.value);document.querySelector('#notes').onclick=()=>{aside.hidden=!aside.hidden;document.querySelector('#notes').textContent=aside.hidden?'解説を表示':'解説を閉じる'};document.querySelector('#full').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();document.addEventListener('keydown',e=>{if(e.target.tagName==='SELECT')return;if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();show(index+1)}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();show(index-1)}});addEventListener('resize',size);size();show((+location.hash.slice(1)||1)-1);'''.replace('NOTES',json.dumps(notes,ensure_ascii=False))
page='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>スワフロ大型アップデート</title><style>'+css+'</style><header><button id="prev" aria-label="前のスライド">← 前へ</button><select aria-label="スライド選択">'+''.join(f'<option value="{i}">{i+1} / 28</option>' for i in range(28))+'</select><button id="next" aria-label="次のスライド">次へ →</button><button id="notes">解説を表示</button><button id="full">全画面</button></header><main id="stage">'+''.join(pages)+'</main><div id="hint">← → キーで移動 ／ 「解説を表示」でワシの詳しいプレゼンを読めます</div><aside hidden></aside><script>'+script+'</script></html>'
(root/'output/presentation.html').write_text(page,encoding='utf-8')
(root/'SPEAKER-NOTES.md').write_text('# 大型アップデート — スライド別解説\n\n'+'\n\n'.join(f'## {i+1}\n\n{n}' for i,n in enumerate(notes)),encoding='utf-8')
print('28 slides exported to offline viewer')
