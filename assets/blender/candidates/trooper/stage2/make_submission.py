from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
Q=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',24)
def board(name,rows,w=540,h=600,crop_width=None):
 cols=max(len(r) for r in rows);out=Image.new('RGB',(cols*w,len(rows)*(h+42)),(35,40,42));d=ImageDraw.Draw(out)
 for j,row in enumerate(rows):
  for i,(file,label) in enumerate(row):
   im=Image.open(file).convert('RGB')
   if crop_width and im.width>crop_width:im=im.crop(((im.width-crop_width)//2,0,(im.width+crop_width)//2,im.height))
   im.thumbnail((w,h));x=i*w+(w-im.width)//2;y=j*(h+42)+42+(h-im.height)//2;out.paste(im,(x,y));d.text((i*w+10,j*(h+42)+8),label,font=font,fill='white')
 out.save(Q/name,quality=94)
views=['front','side','back','oblique']
board('P2_01_before_after.jpg',[[(Q.parent/'stage1'/f'before_color_{v}.png','BEFORE | '+v.upper()) for v in views],[(Q/f'armor_{v}.png','AFTER | '+v.upper()) for v in views]],450,600,600)
board('P2_02_flex.jpg',[[(Q/'flex120_bare.png','120 DEG | CLOTH'),(Q/'flex120_armored.png','120 DEG | ARMOR')],[(Q/'tuck_bare.png','TUCK | CLOTH'),(Q/'tuck_armored.png','TUCK | ARMOR')]])
for label,num in [('rifle','03'),('launcher','04')]:
 board(f'P2_{num}_{label}.jpg',[[(Q/f'{label}_{v}.png',label.upper()+' | '+v.upper()) for v in ['front','back','side']],[(Q/f'{label}_grip_right.png','RIGHT HAND | GRIP'),(Q/f'{label}_grip_left.png','LEFT HAND | SUPPORT')]])
board('P2_05_reach.jpg',[[(Q/f'{label}{suffix}.png',label.upper()+' | '+view) for suffix,view in [('', 'BACK'),('_side','SIDE'),('_close','GRIP')]] for label in ['reach_rifle','reach_rocket']])
board('P2_06_tuck_weapons.jpg',[[(Q/'tuck_armored.png','TUCK | PLATES'),(Q/'tuck_back_weapons.png','TUCK | BACK WEAPONS'),(Q/'tuck_side_weapons.png','TUCK | SIDE WEAPONS')]])
board('P2_07_shotgun.jpg',[[(Q/'shotgun_front.png','SHOTGUN | FRONT'),(Q/'shotgun_grip_right.png','RIGHT HAND | GRIP'),(Q/'shotgun_grip_left.png','LEFT HAND | SUPPORT')]])
if (Q/'reach_rifle_cutaway.png').exists():
 board('P2_08_reach_cutaway.jpg',[[(Q/'reach_rifle_cutaway.png','RIFLE | TORSO / SPARE HIDDEN'),(Q/'reach_rocket_cutaway.png','ROCKET | TORSO / SPARE HIDDEN')]],720,800)
print('Stage2 submission boards saved')
