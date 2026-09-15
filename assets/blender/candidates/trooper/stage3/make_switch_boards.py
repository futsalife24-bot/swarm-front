from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
Q=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
for folder in sorted((Q/'quick').glob('*')):
 files=sorted(folder.glob('*.png'));w=240;h=300;im=Image.new('RGB',(w*7,h*2),(35,40,42));d=ImageDraw.Draw(im)
 for i,p in enumerate(files):
  f=int(p.stem);x=(i%7)*w;y=(i//7)*h;pic=Image.open(p).convert('RGB');pic.thumbnail((240,280));im.paste(pic,(x,y+20));state='HAND old' if f<27 else 'BOTH BACK' if f<36 else 'HAND new';d.text((x+3,y+1),f'{f:02} | {state}',font=font,fill='white')
 im.save(Q/('switch_'+folder.name+'.jpg'),quality=90)
