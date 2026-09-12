from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
Q=Path(__file__).resolve().parent;font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',23)
def board(name,items,w=600,h=640,cols=2):
 out=Image.new('RGB',(w*cols,h*((len(items)+cols-1)//cols)),(36,42,45));d=ImageDraw.Draw(out)
 for i,(file,label) in enumerate(items):
  x=i%cols*w;y=i//cols*h;im=Image.open(Q/file).convert('RGB');im.thumbnail((w,h-36));out.paste(im,(x+(w-im.width)//2,y+36));d.text((x+8,y+5),label,font=font,fill='white')
 out.save(Q/name,quality=92)
board('P3_01_mount.jpg',[(f'mount_final_{n}.png',l) for n,l in [('normal','SAVED SOCKET | NORMAL'),('cutaway','SAVED SOCKET | CUTAWAY'),('back','RIFLE MOUNT | BACK'),('reach_side','REACH | NORMAL SIDE')]])
board('P3_02_grip.jpg',[(f'mount_final_{n}.png',l) for n,l in [('reach','REACH | NORMAL'),('grip_outer','GRIP | BODY HIDDEN'),('grip_opposite','OPPOSITE | BODY HIDDEN'),('grip_thumb','THUMB | BODY HIDDEN')]])
board('P3_03_tuck_support.jpg',[(f'mount_final_{n}.png',l) for n,l in [('tuck_side','TUCK | NORMAL SIDE'),('tuck_back','TUCK | NORMAL BACK'),('rifle_held','RIFLE | NORMAL'),('left_support','ADJUSTED LEFT SUPPORT')]])
for direction in ['1_to_2','2_to_1']:
 frames=[25,27,28,35,36,37]
 if not all((Q/'frames'/f'{direction}_{v}'/f'{f:03}.png').exists() for v in ['back','side'] for f in frames):continue
 items=[(f'frames/{direction}_{v}/{f:03}.png',f'F{f:02} {v.upper()} | '+('OLD HAND' if f<27 else 'BOTH BACK' if f<36 else 'NEW HAND')) for v in ['back','side'] for f in frames]
 board('P3_04_events_'+direction+'.jpg',items,400,470,6)
print('BOARDS COMPLETE')
