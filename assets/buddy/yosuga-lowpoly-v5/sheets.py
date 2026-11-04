"""確認用の画像を並べ、元絵比較と方向別一覧を作る。モデル画像自体は加工しない。"""
from PIL import Image,ImageDraw,ImageFont,ImageOps
from pathlib import Path
out=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',22)
small=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',16)
def sheet(name,items,cols=2,w=700,h=510,crop=None):
    rows=(len(items)+cols-1)//cols
    canvas=Image.new('RGB',(cols*w,rows*h+64),'#202522');d=ImageDraw.Draw(canvas)
    d.text((24,14),'ヨスガ｜ローポリ試作05　属性・能力は未決定',font=font,fill='#eee9dc')
    for i,(file,label) in enumerate(items):
        x=(i%cols)*w;y=(i//cols)*h+64
        im=Image.open(out/file).convert('RGB')
        if crop:im=im.crop(crop)
        im=ImageOps.contain(im,(w-24,h-50))
        canvas.paste(im,(x+(w-im.width)//2,y+36+(h-50-im.height)//2))
        d.text((x+16,y+4),label,font=small,fill='#e6e6cf')
    canvas.save(out/'review'/name)
sheet('comparison.png',[('concept.png','元絵：ヨスガv2'),('review/hero.png','試作：台形頭・二枚尾・小さな二足')])
sheet('eye-comparison.png',[('../yosuga-lowpoly-v3/review/front.png','前版：顔面から突出した目'),('review/front.png','改訂：顔の内側に収めた虹彩・瞳孔')],h=370,crop=(320,105,780,290))
sheet('directions.png',[(f'review/{n}.png',label) for n,label in [('front','正面'),('side','側面'),('back','背面'),('hero','斜め')]])
sheet('motion-sheet.png',[(f'review/frames/{i:04}.png',label) for i,label in [(45,'首かしげ・尾の反応'),(105,'小刻みな踏み替え'),(225,'尾を開いて構える'),(315,'尾を開く・側面')]])
sheet('game-sizes.png',[(f'review/game-{w}-{n}.png',f'{w}×{390 if w==844 else 360} / バディ{n}体') for w,n in [(844,1),(640,1),(844,4),(640,4)]],w=860,h=450)

sheet('posture-comparison.png',[('../yosuga-lowpoly-v4/review/side.png','前版：直立'),('review/side.png','今回：胴体15度前傾・顔は前向き'),('../yosuga-lowpoly-v4/review/hero.png','前版：斜め'),('review/hero.png','今回：斜め')])
