"""確認用の画像を並べ、元絵比較と方向別一覧を作る。モデル画像自体は加工しない。"""
from PIL import Image,ImageDraw,ImageFont,ImageOps
from pathlib import Path
out=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',22)
small=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',16)
def sheet(name,items,cols=2,w=700,h=510):
    rows=(len(items)+cols-1)//cols
    canvas=Image.new('RGB',(cols*w,rows*h+64),'#202522');d=ImageDraw.Draw(canvas)
    d.text((24,14),'タタラ｜ローポリ試作01　属性・能力は未決定',font=font,fill='#eee9dc')
    for i,(file,label) in enumerate(items):
        x=(i%cols)*w;y=(i//cols)*h+64
        im=Image.open(out/file).convert('RGB')
        im=ImageOps.contain(im,(w-24,h-50))
        canvas.paste(im,(x+(w-im.width)//2,y+36+(h-50-im.height)//2))
        d.text((x+16,y+4),label,font=small,fill='#e6e6cf')
    canvas.save(out/'review'/name)
sheet('comparison.png',[('concept.png','元絵：穴・ひび・細かな岩層を含む'),('review/hero.png','試作：輪郭・太い腕・平掌を大きな面へ整理')])
sheet('directions.png',[(f'review/{n}.png',label) for n,label in [('front','正面'),('side','側面'),('back','背面'),('hero','斜め')]])
sheet('motion-sheet.png',[(f'review/frames/{i:04}.png',label) for i,label in [(15,'待機'),(75,'移動・追従（その場の歩行）'),(147,'掌を前へ'),(207,'掌を前へ・側面')]])
sheet('game-sizes.png',[(f'review/game-{w}-{n}.png',f'{w}×{390 if w==844 else 360} / バディ{n}体') for w,n in [(844,1),(640,1),(844,4),(640,4)]],w=860,h=450)
