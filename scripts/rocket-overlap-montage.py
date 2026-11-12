"""通常の初回描画と、計算した交差候補点を重ねた拡大画像を分けて示す。"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path('dist-validation/rocket-overlap-probe')
data=json.loads((root/'report.json').read_text(encoding='utf8'))
font=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',16)
small=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',14)
out=Image.new('RGB',(1140,830),'#0b1922');draw=ImageDraw.Draw(out)
draw.text((12,8),'実ゲーム初回描画の表面交差：通常画像と計測点の拡大',font=font,fill='white')
draw.text((12,32),'赤丸＝武器面との交差候補、黄十字＝銃口。印は計測補助でゲームには表示されません。',font=small,fill='white')
for i,r in enumerate(data['records']):
 x=12+i*564;kind=r['kind'];name='RL-2 コメット' if kind=='rocket' else 'RL-9 メテオ'
 draw.text((x,65),f"{name} 体表 {r['crossings']['body']['crossingPairs']}組 / 武器面 {r['crossings']['weapon']['crossingPairs']}組",font=font,fill='white')
 image=Image.open(root/f'{kind}-first.png').convert('RGB')
 out.paste(image.resize((552,255),Image.Resampling.LANCZOS),(x,91))
 draw.text((x,350),'通常の初回描画（印なし）',font=small,fill='white')
 crop=(335,205,455,295);scale=4
 enlarged=image.crop(crop).resize((480,360),Image.Resampling.NEAREST)
 ed=ImageDraw.Draw(enlarged)
 def coord(p):return ((p[0]-crop[0])*scale,(p[1]-crop[1])*scale)
 for point in r['crossings']['weapon']['exampleScreen']:
  px,py=coord(point);ed.ellipse((px-7,py-7,px+7,py+7),outline='#ff3030',width=3)
 mx,my=coord(r['muzzleScreen']);ed.line((mx-10,my,mx+10,my),fill='#ffe600',width=2);ed.line((mx,my-10,mx,my+10),fill='#ffe600',width=2)
 out.paste(enlarged,(x,380));draw.text((x,744),'同フレームの拡大＋計測補助点',font=small,fill='white')
draw.text((12,785),'辺・面の交差だけを計測。完全内包・共平面・他時点・実通信・実機は未確認。',font=small,fill='white')
out.save(root/'comparison.png')
