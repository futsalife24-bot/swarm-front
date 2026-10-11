from PIL import Image,ImageDraw
from pathlib import Path
import json
r=Path(__file__).resolve().parent
for kind in ['head','body']:
    ids=sorted(p.name.split('-')[1] for p in r.glob(f'{kind}-*-front.png'))
    sheet=Image.new('RGB',(1500,2120),'#eeeeee'); d=ImageDraw.Draw(sheet)
    for row,id in enumerate(ids):
        for col,view in enumerate(['front','side','back']):
            im=Image.open(r/f'{kind}-{id}-{view}.png').convert('RGB'); im.thumbnail((500,500))
            sheet.paste(im,(col*500,row*530+30));d.text((col*500+10,row*530+8),f'{kind} {id} {view}',fill='black')
    sheet.save(r/f'{kind}-contact.jpg',quality=94)
data=json.loads((r/'geometry.json').read_text())
for v in data:
    print(v['file'],v['vertices'],v['polygons'],'components',v['components'],'sizes',v['size'],'largest', [x['vertices'] for x in v['component_data'][:10]])
