"""RL-9 メテオ。肩掛け用の短い九条リブ付き耐熱ドラム。"""
import math
BORE=.13
SPEC=dict(kind='heavy',code='RL-9',name='RL-9 メテオ',family='rocket',
    bore_z=BORE,inlay=(.0615,-.105,.13),
    neon_profile=[[-.18,.19,.055],[-.11,.19,.05],[-.10,.205,.01],
      [.08,.205,.01],[.10,.2,.06],[.25,.2,.07],[.282,.19,.05],
      [.282,.07,.05],[.25,.06,.07],[.235,.06,.02],[.232,-.025,.02],
      [.23,-.10,.02],[.21,-.10,.02],[.20,-.025,.02],[.19,.06,.02],
      [.10,.07,.04],[.03,.07,.04],[.02,-.12,.022],[-.035,-.123,.022],
      [-.075,-.108,.022],[-.06,.07,.04],[-.18,.07,.055]])

def build(k):
    # 通常の右手握りと左手支えの前後座標は維持する。
    k.profile('Pistol grip',[(-.035,.075),(.025,.075),(.02,-.045),(-.028,-.125),(-.075,-.108)],.042,'black',.003)
    k.guard(.043,.01,.055,.05,'steel')
    k.profile('Front hand support',[(.19,.075),(.235,.075),(.232,-.025),(.23,-.10),(.21,-.10),(.20,-.025)],.038,'black',.003)
    k.rod('Short insulated core',(0,-.17,BORE),(0,.26,BORE),.056,'gunmetal',24)
    k.rod('Rear orange jacket',(0,-.135,BORE),(0,.098,BORE),.060,'rust',24)
    k.rod('Short rear housing',(0,-.176,BORE),(0,-.14,BORE),.060,'steel',24)
    k.ring('Rear outer collar',-.174,BORE,.062,.049,'gunmetal',.008,n=24)
    k.ring('Rear inner glow',-.178,BORE,.034,.026,'glow_heat',.002,n=20)
    k.rod('Rear dark recess',(0,-.179,BORE),(0,-.177,BORE),.025,'black',20)
    # 左手の領域より高く置いた太い筒。9本はそれぞれ独立したリブ。
    k.rod('Ribbed heat drum',(0,.10,BORE),(0,.255,BORE),.070,'rust',32)
    for i in range(9):
        a=2*math.pi*i/9
        x,z=.071*math.cos(a),BORE+.071*math.sin(a)
        k.rod('Longitudinal rib',(x,.11,z),(x,.248,z),.006,'gunmetal',8)
        for y in [.118,.240]:
            k.rod('Rib bracket',(x*.98,y,BORE+(z-BORE)*.98),
                  (x*1.04,y,BORE+(z-BORE)*1.04),.0025,'steel',8)
    for y in [.103,.252]:k.ring('Drum collar',y,BORE,.073,.069,'steel',.006,n=24)
    # 大きな暗色の金属帯を筒全体に配し、橙色の区画を分ける。
    # 9本の縦リブはそのまま、帯の金具は右手インレイを避ける。
    bands=[-.127,-.083,-.039,.005,.049,.093,.137,.181,.225]
    for y in bands:
        radius=.077 if y>=.10 else .068
        k.ring('Heavy transverse armor band',y,BORE,radius,radius-.009,'gunmetal',.014,n=16)
        for i in range(4):
            a=2*math.pi*i/4+math.pi/4
            x,z=radius*math.cos(a),BORE+radius*math.sin(a)
            k.rod('Armor band rivet',(x*.99,y,BORE+(z-BORE)*.99),
                  (x*1.025,y,BORE+(z-BORE)*1.025),.003,'steel',6)
    k.rod('Front taper',(0,.255,BORE),(0,.273,BORE),.070,'gunmetal',24,r2=.061)
    k.ring('Muzzle rim',.277,BORE,.062,.044,'steel',.010,n=24)
    k.ring('Muzzle inner liner',.281,BORE,.044,.033,'black',.002,n=24)
    k.rod('Muzzle dark recess',(0,.281,BORE),(0,.282,BORE),.032,'black',24)
    for side in [-1,1]:
        for i in range(4):
            k.rod('Grip rib',(side*.021,-.059+i*.007,-.085+i*.014),
                  (side*.021,-.028+i*.007,-.085+i*.014),.002,'steel',6)
            z=-.032-i*.014
            k.rod('Forward grip groove',(side*.019,.21,z),(side*.019,.227,z),.0015,'steel',6)
        for y in [-.055,.015,.065]:
            k.profile('Jacket shield',[(y,.095),(y+.028,.095),(y+.028,.15),(y,.15)],
                      .003,'gunmetal',.001,x=side*.060)
            k.rod('Shield screw',(side*.062,y+.014,.103),(side*.064,y+.014,.103),.003,'steel',8)
            k.box('Cooling notch',(side*.062,y+.014,.132),(.002,.007,.018),'black',0)
        for y in [.12,.15,.18,.21,.24]:
            k.box('Raised strap clasp',(side*.074,y,.13),(.004,.009,.017),'steel',.0005)
            k.box('Strap clasp recess',(side*.0762,y,.13),(.001,.004,.008),'black',0)
        # 圧力計と細い整備跡には、既存の材質を使う。
        k.rod('Pressure gauge bezel',(side*.060,-.02,.13),(side*.066,-.02,.13),.011,'steel',12)
        k.rod('Pressure gauge dial',(side*.066,-.02,.13),(side*.068,-.02,.13),.008,'black',12)
        k.rod('Pressure gauge needle',(side*.068,-.022,.127),(side*.068,-.018,.134),.001,'rust',6)
        for y in [-.125,-.095,-.075,-.045,.03,.055,.085]:
            k.box('Paint scuff',(side*.059,y,.142),(.001,.009,.0015),'gunmetal',0)
        k.rod('Side coolant pipe',(side*.044,-.12,.17),(side*.044,.085,.17),.003,'steel',8)
        for y in [-.08,.015,.07]:
            k.rod('Coolant clamp',(side*.04,y,.17),(side*.047,y,.17),.005,'gunmetal',8)
    # バンド間を段付き外装にする。留め具と識別インレイには重ねない。
    for side in [-1,1]:
        for y in [-.068,-.024,.020,.064,.112,.156,.200]:
            r=.070 if y>=.10 else .061
            k.profile('Segment armor base',[(y,.106),(y+.021,.106),(y+.027,.113),
                      (y+.027,.150),(y+.021,.157),(y,.157)],.003,'gunmetal',0,x=side*r)
            k.profile('Orange segment armor',[(y+.003,.110),(y+.019,.110),(y+.023,.116),
                      (y+.023,.147),(y+.019,.153),(y+.003,.153)],.002,'rust',0,x=side*(r+.003))
            for yy,zz in [(y+.005,.114),(y+.021,.149)]:
                k.rod('Segment armor fixing',(side*(r+.004),yy,zz),(side*(r+.006),yy,zz),.0018,'steel',6)
    # ケース上端で高さを抑えた持ち運びハンドル。
    for a,b in [((0,-.11,.184),(0,-.09,.202)),((0,-.09,.202),(0,.07,.202)),((0,.07,.202),(0,.085,.19))]:
        k.rod('Carry handle',a,b,.003,'steel',8)
    k.box('Handle grip',(0,-.01,.202),(.014,.07,.01),'black',.001)
    for y in [-.036,-.023,-.01,.003,.016]:
        k.box('Handle grip stripe',(0,y,.207),(.014,.003,.001),'steel',0)
