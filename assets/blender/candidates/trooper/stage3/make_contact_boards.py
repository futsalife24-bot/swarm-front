from pathlib import Path
import sys,json
from PIL import Image,ImageDraw,ImageFont
Q=Path(__file__).resolve().parent;prefix=sys.argv[1] if len(sys.argv)>1 else ''
report=json.loads((Q/(prefix+'contact-diagnosis.json')).read_text())['frames'];font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20)
for group in ['C1','C2','C3']:
 frames=[r for r in report if r['group']==group];w=560;h=608;out=Image.new('RGB',(w*len(frames),h*2),(36,42,45));draw=ImageDraw.Draw(out)
 for row,variant in enumerate(['normal','transparent']):
  for col,r in enumerate(frames):
   im=Image.open(Q/f"{prefix}{group}_{r['direction']}_{r['frame']:02}_{variant}.png").convert('RGB');out.paste(im,(col*w,row*h+48))
   label=f"{group} {r['direction']} F{r['frame']:02} | {variant.upper()}"
   draw.text((col*w+8,row*h+3),label,font=font,fill='white')
   text=f"max inside {r['maxDepthMeters']*1000:.1f} mm | {r['insideVerticesOver3mm']} vertices >3mm" if row else f"runtime {r['frame']/120:.4f} s | same saved pose"
   draw.text((col*w+8,row*h+25),text,font=font,fill='#f5cf7a' if row else '#bac4cb')
 out.save(Q/f'{prefix}{group}_contact.jpg',quality=94)
print('CONTACT BOARDS COMPLETE')
