from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
Q=Path(__file__).resolve().parent;font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
data=json.loads((Q/'diagnostic_hand_projection.json').read_text())
board=Image.new('RGB',(1400,750),(35,39,42));d=ImageDraw.Draw(board)
for i,name in enumerate(['open','curl']):
 im=Image.open(Q/f'diagnostic_hand_{name}.png').convert('RGB');draw=ImageDraw.Draw(im)
 for b in data[name]:
  ps=[tuple(p) for p in b['points']];draw.line(ps,fill=(255,97,91),width=3)
  for x,y in ps:draw.ellipse((x-4,y-4,x+4,y+4),fill=(255,200,110))
 d.text((i*700+16,10),f'CURRENT {name.upper()} | projected existing finger bones',font=font,fill='white');board.paste(im,(i*700,50))
board.save(Q/'hand_bind_diagnosis.jpg',quality=95)
