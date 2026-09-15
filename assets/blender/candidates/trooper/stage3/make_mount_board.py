from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
Q=Path(__file__).resolve().parent;out=Image.new('RGB',(1400,1470),(38,44,47));d=ImageDraw.Draw(out);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',23)
for i,(name,label) in enumerate([('current_normal','CURRENT | NORMAL'),('current_cutaway','CURRENT | HALF-BODY CUTAWAY'),('proposal_normal','PROPOSAL | NORMAL'),('proposal_cutaway','PROPOSAL | HALF-BODY CUTAWAY')]):
 x=(i%2)*700;y=(i//2)*735;im=Image.open(Q/f'mount_{name}.png').convert('RGB').resize((700,700));out.paste(im,(x,y+35));d.text((x+10,y+5),label,font=font,fill='white')
out.save(Q/'P3_mount_proposal.jpg',quality=92)
