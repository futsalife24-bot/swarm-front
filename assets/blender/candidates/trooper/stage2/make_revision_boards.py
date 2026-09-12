from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
Q=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
def board(name,rows,w,h):
 cols=max(map(len,rows));out=Image.new('RGB',(cols*w,len(rows)*(h+40)),(35,40,42));d=ImageDraw.Draw(out)
 for j,row in enumerate(rows):
  for i,(file,label) in enumerate(row):
   im=Image.open(Q/file).convert('RGB');im.thumbnail((w,h));out.paste(im,(i*w+(w-im.width)//2,j*(h+40)+40+(h-im.height)//2));d.text((i*w+9,j*(h+40)+8),label,font=font,fill='white')
 out.save(Q/name,quality=95)
board('R2_01_knees.jpg',[[(f'knee_{a}_{mode}_{view}.png',f'{a} DEG | {mode.upper()} {view.upper()}') for mode,view in [('bare','front'),('armored','front'),('bare','side'),('armored','side')]] for a in [60,120]],400,325)
board('R2_02_waist.jpg',[[('waist_tuck_normal.png','SAME TUCK | NORMAL LIGHT'),('waist_tuck_softlight.png','SAME TUCK | LOW SHADOW CLAY')]],700,700)
for kind in ['rifle','rocket']:
 board(f'R2_03_reach_{kind}.jpg',[[(f'grasp_reach_{kind}_normal.png','REACH | NORMAL'),(f'grasp_reach_{kind}_outer.png','GRIP | BODY HIDDEN')],[(f'grasp_reach_{kind}_opposite.png','OPPOSITE | BODY HIDDEN'),(f'grasp_reach_{kind}_rear.png','THUMB SIDE | BODY HIDDEN')]],600,660)
board('R2_04_held.jpg',[[(f'grasp_held_{kind}_{view}.png',kind.upper()+' | '+label) for view,label in [('normal','NORMAL'),('outer','GRIP / BODY HIDDEN'),('rear','THUMB / BODY HIDDEN')]] for kind in ['rifle','rocket']],500,555)
board('R2_05_launcher_left.jpg',[[('grasp_launcher_left_outer.png','LEFT SUPPORT | BODY HIDDEN'),('grasp_launcher_left_rear.png','LEFT THUMB | BODY HIDDEN')]],600,660)
if (Q/'web_open_L.png').exists():board('R2_06_web_open.jpg',[[('web_open_L.png','LOCAL THUMB WEB | LEFT OPEN'),('web_open_R.png','LOCAL THUMB WEB | RIGHT OPEN')]],600,600)
print('Revision boards saved')
