"""Layout actual Blender renders. No generated/painted alterations to model imagery."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
Q=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
views=['front','side','back','oblique']
for mode in ['clay','color']:
 board=Image.new('RGB',(1600,1130),(35,39,42));d=ImageDraw.Draw(board)
 for row,state in enumerate(['before','after']):
  for col,view in enumerate(views):
   im=Image.open(Q/f'{state}_{mode}_{view}.png').convert('RGB');im.thumbnail((400,533))
   x=col*400;y=row*565
   d.text((x+12,y+5),f'{state.upper()} | {view.upper()}',font=font,fill='white');board.paste(im,(x,y+32))
 board.save(Q/f'comparison_{mode}.jpg',quality=95)
board=Image.new('RGB',(1280,510),(35,39,42));d=ImageDraw.Draw(board)
d.text((16,8),'Same camera / model height 256 px and 128 px. Not in-game proof.',font=font,fill='white')
for i,(state,view) in enumerate((s,v) for v in ['front','back'] for s in ['before','after']):
 im=Image.open(Q/f'{state}_color_{view}.png').convert('RGB')
 # fixed crop fits helmet and sole identically (Z bounds unchanged)
 im=im.crop((80,64,520,762));large=im.resize((161,256),Image.Resampling.LANCZOS);small=im.resize((81,128),Image.Resampling.LANCZOS)
 x=i*320;d.text((x+12,48),f'{state.upper()} {view}',font=font,fill='white');board.paste(large,(x+20,85));board.paste(small,(x+195,213))
board.save(Q/'comparison_small.jpg',quality=95)
print('3 comparison boards saved')
for title,names,target in [('P1-01 REVISED FULL BODY',['after_clay_front','after_clay_oblique'],'p1_01_fullbody.jpg'),('P1-01 REVISED GLOVE - DIRECT CLOSEUP RENDERS',['detail_hand_palm','detail_hand_back','detail_hand_side'],'p1_01_glove.jpg')]:
 imgs=[Image.open(Q/(n+'.png')).convert('RGB') for n in names]
 board=Image.new('RGB',(600*len(imgs),max(im.height for im in imgs)+72),(35,39,42));d=ImageDraw.Draw(board);d.text((16,5),title,font=font,fill='white')
 for i,(n,im) in enumerate(zip(names,imgs)):
  d.text((i*600+16,38),n.replace('detail_hand_','').replace('after_clay_','').upper(),font=font,fill='white');board.paste(im,(i*600,72))
 board.save(Q/target,quality=95)
