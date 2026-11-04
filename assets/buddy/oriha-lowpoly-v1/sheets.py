"""確認用の画像を並べ、元絵比較と方向別一覧を作る。モデル画像自体は加工しない。"""
from PIL import Image,ImageDraw,ImageFont,ImageOps
from pathlib import Path
out=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',22)
small=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',16)
def sheet(name,items,cols=2,w=700,h=510,crop=None):
    rows=(len(items)+cols-1)//cols
    canvas=Image.new('RGB',(cols*w,rows*h+64),'#202522');d=ImageDraw.Draw(canvas)
    d.text((24,14),'オリハ｜ローポリ試作01　属性・能力は未決定',font=font,fill='#eee9dc')
    for i,(file,label) in enumerate(items):
        x=(i%cols)*w;y=(i//cols)*h+64
        im=Image.open(out/file).convert('RGB')
        if crop:im=im.crop(crop)
        im=ImageOps.contain(im,(w-24,h-50))
        canvas.paste(im,(x+(w-im.width)//2,y+36+(h-50-im.height)//2))
        d.text((x+16,y+4),label,font=small,fill='#e6e6cf')
    canvas.save(out/'review'/name)


sheet('comparison.png',[('concept.png','元絵：オリハ'),('review/hero.png','試作：S字の分節体・扁平な頭・一枚の尾')])
sheet('directions.png',[(f'review/{n}.png',label) for n,label in [('front','正面'),('side','側面'),('back','背面'),('hero','斜め')]])
sheet('motion-sheet.png',[(f'review/frames/{i:04}.png',label) for i,label in [(45,'S字で静かに浮遊'),(105,'波打って追従'),(225,'体を伸ばす'),(315,'伸びる姿・側面')]])
sheet('game-sizes.png',[(f'review/game-{w}-{n}.png',f'{w}×{390 if w==844 else 360} / バディ{n}体') for w,n in [(844,1),(640,1),(844,4),(640,4)]],w=860,h=450)
