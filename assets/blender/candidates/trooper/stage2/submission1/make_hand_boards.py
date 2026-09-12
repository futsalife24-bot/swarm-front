from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
Q=Path(__file__).resolve().parent;data=json.loads((Q/'hand_fit_projection.json').read_text());font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',24)
for side in ['L','R']:
 for view in ['palm','side']:
  board=Image.new('RGB',(1800,1280),(35,39,42));d=ImageDraw.Draw(board)
  for i,pose in enumerate(['open','half','grip']):
   key=f'hand_{side}_{pose}_{view}';im=Image.open(Q/(key+'.png')).convert('RGB');overlay=im.copy();draw=ImageDraw.Draw(overlay)
   for bone in data[key]:
    points=[tuple(p) for p in bone['points']];draw.line(points,fill=(255,103,90),width=3)
    for x,y in points:draw.ellipse((x-3,y-3,x+3,y+3),fill=(255,206,112))
   d.text((i*600+16,8),f'{side} {view.upper()} | {pose.upper()}',font=font,fill='white');board.paste(im,(i*600,40));d.text((i*600+16,648),'SAME POSE + PROJECTED BONES',font=font,fill='white');board.paste(overlay,(i*600,680))
  board.save(Q/f'P2_hand_{side}_{view}.jpg',quality=94)
