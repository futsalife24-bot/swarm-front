"""Summarize fixed-step browser captures; encode normal/half-speed with ffmpeg separately."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw
source=Path(sys.argv[1]); target=Path(sys.argv[2]); target.mkdir(parents=True,exist_ok=True)
raw=(source/'metrics.json').read_bytes()
d=json.loads(raw)
(target/'metrics.json').write_bytes(raw)
assert d['fps']==24 and d['frames']==912
assert len(list(source.glob('*.jpg')))==912
for n in range(912): assert (source/f'{n:04}.jpg').is_file()
selected=int(d['captureId'].split('-')[0])
players=[row['players'][selected] for row in d['samples']]
actions={
 'fired':min(p['ammo'][0] for p in players)<players[0]['ammo'][0],
 'reloaded':any(p['reload']>0 for p in players),
 'switched':any(p['slot']==1 for p in players),
 'evaded':any(p['evade']>0 for p in players),
 'jumped':any(p['y']>1 for p in players),
 'downed':players[-1]['hp']==0,
 'accentStable':all(p['accentSlot']==selected for p in players),
}
assert all(actions.values()),actions
rows=[]
for t in [0,2.5,5.5,8.5,10.5,14.5,16.5,20.25,23.25,26.15,31.25,34.5]:
 r=min(d['samples'],key=lambda x:abs(x['t']-t))
 rows.append(r)
(target/'metrics-summary.json').write_text(json.dumps({'captureId':d['captureId'],'fps':24,'frames':912,'duration':38,'scene':d['scene'],'actions':actions,'samples':rows},indent=2),encoding='utf-8')
times=[0,2,3,5,6,8,9,10.2,10.8,11.5,14.5,16.2,17,20.1,20.3,20.5,23.2,26.05,26.15,26.25,28.5,30,31.3,34.3]
sheet=Image.new('RGB',(4*360,6*440),'#16232d');draw=ImageDraw.Draw(sheet)
for i,t in enumerate(times):
 im=Image.open(source/f'{int(t*24):04}.jpg').crop((300,100,660,520))
 x,y=(i%4)*360,(i//4)*440
 sheet.paste(im,(x,y+20));draw.text((x+8,y+3),f'{t:.2f}s',fill='white')
sheet.save(target/'contact.jpg',quality=94)
print(json.dumps({'target':str(target),'frames':912,'samples':len(d['samples']),'firstSlots':[p.get('accentSlot') for p in d['samples'][0]['players']]},ensure_ascii=False))
