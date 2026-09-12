from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
Q=Path(__file__).resolve().parent
files=sorted((Q/'video-frames').glob('*.png'))
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
for page in range((len(files)+7)//8):
 subset=files[page*8:(page+1)*8];board=Image.new('RGB',(1280,4*230),(24,31,36));d=ImageDraw.Draw(board)
 for i,p in enumerate(subset):
  x=(i%2)*640;y=(i//2)*230
  im=Image.open(p).convert('RGB');im=im.crop((170,80,800,580));im.thumbnail((420,205))
  board.paste(im,(x,y+25));d.text((x+8,y+3),'ACTUAL NORMAL-SPEED VIDEO / '+p.stem+'s',font=font,fill='white')
  full=Image.open(p).convert('RGB');full.thumbnail((200,125));board.paste(full,(x+430,y+70))
 board.save(Q/f'video-contact-{page+1}.jpg',quality=91)
print('CONTACT SHEETS',len(files))
