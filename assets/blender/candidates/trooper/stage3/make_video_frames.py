from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import sys,json
Q=Path(__file__).resolve().parent;root=Q/('quick' if '--test' in sys.argv else 'frames');outroot=Q/('video_test_frames' if '--test' in sys.argv else 'video_frames');font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
for direction in ['1_to_2','2_to_1']:
 out=outroot/direction;out.mkdir(parents=True,exist_ok=True)
 files=sorted((root/(direction+'_back')).glob('*.png'))
 if '--test' not in sys.argv:assert [int(p.stem) for p in files]==list(range(61)), 'Final videos require every source frame F0-F60'
 for fpath in files:
  other=root/(direction+'_side')/fpath.name
  if not other.exists():raise FileNotFoundError(other)
  f=int(fpath.stem);im=Image.new('RGB',(960,600),(35,40,42));d=ImageDraw.Draw(im);d.text((12,8),f'{direction} | source F{f:02} | runtime {f/120:.3f}s | '+('OLD HAND' if f<27 else 'BOTH BACK' if f<36 else 'NEW HAND'),font=font,fill='white');im.paste(Image.open(fpath).convert('RGB').resize((480,560)),(0,40));im.paste(Image.open(other).convert('RGB').resize((480,560)),(480,40));im.save(out/fpath.name)
print(outroot)
