from pathlib import Path
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent
names=['Rifle_Idle','Rifle_Fire','Rifle_Reload','Rifle_Walk','Shotgun_Fire','Shotgun_Reload','Rocket_Fire','Rocket_Reload']
sheet=Image.new('RGB',(1920,8*350),(26,32,43));draw=ImageDraw.Draw(sheet)
for row,name in enumerate(names):
 for i in range(6):
  image=Image.open(p/'combat-frames'/f'{name}-{i}.png').convert('RGB');image.thumbnail((320,320))
  sheet.paste(image,(i*320,row*350+25))
  draw.text((i*320+8,row*350+7),f'{name} {i*20}%',fill='white')
sheet.save(p/'combat-contact-sheet.png')
print('48 frames assembled')
