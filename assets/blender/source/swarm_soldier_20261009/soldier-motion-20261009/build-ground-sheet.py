from pathlib import Path
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent
sheet=Image.new('RGB',(1920,4*265),(26,32,43));draw=ImageDraw.Draw(sheet)
for row,name in enumerate(['Down','Dodge_Roll','Jump_Start','Jump_Land']):
 for i in range(6):
  im=Image.open(p/'ground-frames'/f'{name}-{i}.png').convert('RGB');im.thumbnail((320,240));sheet.paste(im,(i*320,row*265+25));draw.text((i*320+5,row*265+5),f'{name} {i*20}%',fill='white')
sheet.save(p/'ground-contact-sheet.png')
