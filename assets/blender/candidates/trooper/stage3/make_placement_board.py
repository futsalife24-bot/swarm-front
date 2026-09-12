from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
Q=Path(__file__).resolve().parent
out=Image.new('RGB',(1360,1630),(33,40,43));d=ImageDraw.Draw(out);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',21)
for col,kind in enumerate(['current','idea']):
 for row,variant in enumerate(['normal','transparent']):
  im=Image.open(Q/f'placement_{kind}_{variant}.png').convert('RGB');out.paste(im,(col*680,row*800+40));d.text((col*680+10,row*800+8),f"{'CURRENT' if kind=='current' else 'IDEA: ROCKET +150mm X'} | F27 | {variant}",font=font,fill='white')
d.text((10,1605),'Placement illustration only. Identical arm pose; no socket edit or blend save.',font=font,fill='#ffd086')
out.save(Q/'P3_extra_clearance_idea.jpg',quality=93)
