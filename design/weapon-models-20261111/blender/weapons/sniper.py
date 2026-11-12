"""SR-1 ソーン。骨色の細身と有機的な棘を持つ長距離ライフル。"""
import math
BORE = .046
SPEC = dict(
    kind='sniper', code='SR-1', name='SR-1 ソーン', family='sniper',
    bore_z=BORE, inlay=(.036, -.05, .05),
    neon_profile=[[-.39,.05,.024],[-.12,.065,.027],[-.09,.095,.027],
                  [-.055,.17,.028],[.20,.17,.028],[.225,.20,.06],
                  [.317,.20,.06],[.317,.08,.035],[.61,.056,.014],
                  [.70,.056,.012],[.70,.036,.012],[.667,.036,.014],
                  [.65,.008,.014],[.61,.036,.014],[.25,.026,.025],[.22,-.015,.025],
                  [.12,-.015,.025],[.11,-.075,.025],[.05,-.075,.025],[.03,-.01,.027],
                  [.02,-.04,.022],[-.025,-.145,.022],[-.075,-.13,.022],
                  [-.1,-.02,.027],[-.33,-.10,.024],[-.39,-.10,.024]],
)

def build(k):
    # 骨組み銃床は複数の梁を組み、間を抜いて軽快に見せる。
    for a,b in [((0,-.10,.048),(0,-.37,.045)),((0,-.37,.045),(0,-.37,-.09)),
                ((0,-.37,-.09),(0,-.08,.005)),((0,-.32,-.075),(0,-.22,.042))]:
        k.rod('Stock structural spar',a,b,.012,'bone',10)
    k.box('Stock butt pad',(0,-.382,-.022),(.048,.018,.15),'polymer',.003)
    k.profile('Stock cheek rest',[(-.30,.058),(-.15,.058),(-.14,.081),(-.31,.081)],.042,'leather',.002)
    # 銃床の支柱は鋳物風の接合部・固定具・革の段差を持たせる。
    for y,z in [(-.365,.038),(-.365,-.082),(-.225,.038),(-.105,.038),(-.105,.004)]:
        k.rod('Stock joint pin',(-.015,y,z),(.015,y,z),.008,'steel',12)
        for side in [-1,1]:
            k.rod('Stock joint cap',(side*.015,y,z),(side*.017,y,z),.004,'polymer',6)
    for y in [-.285,-.225,-.165]:
        k.box('Cheek rest stitch',(0,y,.081),(.034,.002,.002),'steel',.0005)
    for side in [-1,1]:
        k.rod('Cheek rest support',(side*.016,-.28,.048),(side*.016,-.28,.060),.004,'steel',8)
        k.rod('Cheek rest support',(side*.016,-.17,.048),(side*.016,-.17,.060),.004,'steel',8)
    k.profile('Receiver',[(-.095,0),(.20,0),(.215,.025),(.20,.078),(-.085,.078)],.06,'bone',.003)
    k.profile('Pistol grip',[(-.035,0),(.02,0),(.019,-.04),(-.025,-.145),(-.075,-.13)],.042,'polymer',.003)
    k.guard(.045,-.004,.058,.05,'steel')
    k.profile('Magazine',[(.05,0),(.11,0),(.105,-.07),(.055,-.07)],.046,'polymer',.003)
    k.box('Magazine floor',(0,.08,-.069),(.05,.064,.008),'steel',.001)
    for side in [-1,1]:
        k.profile('Magazine side plate',[(.056,-.006),(.104,-.006),(.100,-.058),(.060,-.058)],
                  .002,'steel',.001,x=side*.0235)
        for y in [.066,.094]:
            k.rod('Magazine fastener',(side*.025,y,-.049),(side*.027,y,-.049),.0025,'leather',8)
        for z in [-.018,-.028,-.038]:
            k.box('Magazine witness notch',(side*.025,.080,z),(.002,.020,.003),'polymer',0)
    # 銃身と銃口の棘。先端3%以内は対称な円筒のみ。
    k.rod('Precision barrel',(0,.20,BORE),(0,.68,BORE),.012,'steel',20)
    k.ring('Muzzle brake',.69,BORE,.014,.009,'steel',.02,n=20)
    k.rod('Muzzle aperture',(0,.699,BORE),(0,.70,BORE),.008,'polymer',20)
    k.profile('Lower thorn',[(.60,.036),(.65,.008),(.665,.036)],.018,'leather',.001)
    k.profile('Underbarrel support',[(.18,.025),(.38,.025),(.36,-.014),(.20,-.017)],.042,'polymer',.003)
    k.profile('Forearm rib',[(.235,.03),(.49,.028),(.34,.007),(.235,.007)],.024,'bone',.002)
    for y in [.45,.51,.57]:
        k.ring('Barrel collar',y,BORE,.015,.011,'leather',.006,n=16)
    # 細い銃身の面に排熱用のフルートと固定リブを配置する。
    for side in [-1,1]:
        for z in [.040,.052]:
            k.rod('Barrel flute rail',(side*.010,.275,z),(side*.010,.585,z),.0014,'bone',6)
        for y in [.29,.41,.53]:
            k.rod('Barrel collar screw',(side*.013,y,.046),(side*.017,y,.046),.0025,'steel',8)
    for y in [.47,.56]:
        k.ring('Barrel thermal sleeve',y,BORE,.014,.012,'polymer',.012,n=10)
    # スコープの前玉を太くし、架台・ダイヤル・レンズを別形状に。
    for y in [.015,.17]:
        k.box('Optic mount',(0,y,.097),(.036,.02,.06),'steel',.002)
    k.rod('Scope tube',(0,-.055,.138),(0,.23,.138),.027,'polymer',24)
    k.rod('Scope objective',(0,.225,.138),(0,.305,.138),.045,'bone',24,r2=.058)
    k.ring('Objective rim',.307,.138,.061,.048,'steel',.012,n=24)
    k.rod('Objective lens',(0,.313,.138),(0,.314,.138),.047,'polymer',24)
    k.ring('Objective internal focus ring',.314,.138,.043,.039,'brass',.002,n=16)
    k.rod('Objective central lens',(0,.315,.138),(0,.317,.138),.030,'polymer',20)
    k.ring('Eyepiece',-.058,.138,.032,.021,'steel',.018,n=20)
    for y in [.01,.19]:
        k.ring('Scope focus ring',y,.138,.030,.026,'steel',.008,n=12)
    for y in [.018,.030,.182]:
        k.ring('Scope grip ring',y,.138,.029,.026,'bone',.002,n=8)
    for y,radius in [(.246,.048),(.282,.054)]:
        k.ring('Objective focus rib',y,.138,radius,radius-.003,'leather',.006,n=12)
    # 参照画像の大きな光学系を、白い外套の細い操作溝で立体的にする。
    for i in range(6):
        a=2*math.pi*i/6
        x,z=.050*math.cos(a),.138+.050*math.sin(a)
        k.rod('Objective axial grip',(x,.252,z),(x,.269,z),.0014,'polymer',6)
    k.rod('Scope elevation dial',(0,.10,.160),(0,.10,.177),.014,'steel',16)
    k.rod('Dial cap',(0,.10,.177),(0,.10,.179),.011,'leather',16)
    for side in [-1,1]:
        k.rod('Scope windage dial',(side*.027,.105,.138),(side*.037,.105,.138),.012,'steel',16)
        k.rod('Windage dial cap',(side*.037,.105,.138),(side*.039,.105,.138),.009,'leather',12)
        for y in [.035,.075,.145,.185]:
            k.box('Scope adjustment mark',(side*.0265,y,.138),(.002,.003,.010),'bone',0)
    for side in [-1,1]:
        k.profile('Receiver side armor',[(-.08,.012),(.045,.012),(.075,.028),(.075,.062),
                  (.045,.073),(-.08,.073)],.003,'steel',.001,x=side*.031)
        k.profile('Receiver inset',[(-.067,.02),(.025,.02),(.050,.031),(.050,.055),
                  (.025,.065),(-.067,.065)],.002,'polymer',.001,x=side*.033)
        for y in [-.065,.038]:
            for z in [.026,.059]:
                k.rod('Receiver rivet',(side*.034,y,z),(side*.036,y,z),.003,'leather',8)
        k.profile('Forward ceramic armor',[(.08,.014),(.17,.014),(.19,.026),(.18,.065),(.08,.065)],
                  .003,'bone',.001,x=side*.031)
        # 白い整備外装に赤茶の補強帯と小さな金属の固定具を配置する。
        for y in [.102,.152]:
            k.profile('Ceramic access clamp',[(y,.016),(y+.011,.016),(y+.011,.060),(y,.060)],
                      .0015,'leather',0,x=side*.0335)
            for z in [.023,.054]:
                k.rod('Access clamp bolt',(side*.034,y+.005,z),(side*.036,y+.005,z),.002,'steel',6)
        k.profile('Ceramic lower service seam',[(.082,.013),(.17,.013),(.17,.017),(.082,.017)],
                  .0015,'polymer',0,x=side*.033)
        for y,z,length in [(.088,.020,.008),(.120,.029,.012),(.143,.054,.008),(.168,.037,.010)]:
            k.box('Ceramic exposed seam',(side*.0335,y,z),(.001,length,.0015),'polymer',0)
        for y in [.095,.11,.125,.14,.155]:
            k.box('Receiver cooling slit',(side*.033,y,.04),(.002,.006,.024),'polymer',0)
        for y in [.09,.17]:
            k.rod('Fore receiver bolt',(side*.033,y,.06),(side*.035,y,.06),.003,'leather',8)
        for i in range(4):
            k.rod('Grip texture',(side*.021,-.054+i*.007,-.09+i*.015),
                  (side*.021,-.027+i*.007,-.09+i*.015),.0018,'steel',6)
        for y in [.23,.27,.31,.35]:
            k.box('Forearm cooling port',(side*.022,y,.003),(.002,.014,.006),'steel',0)
        # レシーバーの継ぎ目、操作桿、固定具で機関部の構造を読めるようにする。
        k.rod('Receiver upper seam',(side*.032,-.075,.075),(side*.032,.18,.075),.0015,'polymer',6)
        for y in [-.075,.005,.055,.18]:
            k.rod('Receiver frame pin',(side*.032,y,.011),(side*.035,y,.011),.0027,'leather',8)
        for y in [.205,.245,.285,.325,.365]:
            k.box('Forearm serration',(side*.022,y,-.009),(.002,.004,.010),'bone',0)
    k.rod('Bolt action shaft',(.032,.025,.062),(.051,.025,.068),.0035,'steel',10)
    k.rod('Bolt action handle',(.051,.025,.068),(.051,.008,.044),.004,'steel',10)
    k.rod('Bolt knob',(.049,.008,.044),(.053,.008,.044),.006,'leather',12)
    # 骨組みの接合部に、厚みを持つ補強具を重ねる。
    for side in [-1,1]:
        for y,z in [(-.355,-.070),(-.345,.041),(-.225,.037)]:
            k.rod('Stock reinforced hub',(side*.015,y,z),(side*.022,y,z),.010,'leather',10)
            k.rod('Stock steel fastener',(side*.022,y,z),(side*.024,y,z),.004,'steel',8)
        k.profile('Rear skeletal joint',[(-.365,-.05),(-.30,-.05),(-.275,-.026),(-.32,-.020)],
                  .004,'bone',.001,x=side*.013)
        # 前部に段違いの白い装甲を積層し、細身の平板を機構に見せる。
        for y0,y1 in [(.078,.115),(.122,.16),(.167,.193)]:
            k.profile('Segmented ivory armor',[(y0,.018),(y1,.018),(y1+.005,.03),
                      (y1,.067),(y0,.067),(y0-.004,.05)],.006,'bone',.001,x=side*.033)
            k.profile('Dark red segment strap',[(y0+.006,.022),(y0+.013,.022),
                      (y0+.013,.063),(y0+.006,.063)],.002,'leather',0,x=side*.0365)
            for z in [.026,.059]:
                k.rod('Segment strap lock',(side*.037,y0+.0095,z),(side*.039,y0+.0095,z),.0025,'steel',6)
        for y0,y1 in [(.205,.275),(.285,.355),(.365,.435)]:
            k.profile('Forward white armor',[(y0,.031),(y1,.031),(y1+.015,.043),
                      (y1,.069),(y0,.069),(y0-.006,.05)],.006,'bone',.001,x=side*.017)
            k.profile('Forward red brace',[(y0+.012,.033),(y0+.020,.033),
                      (y0+.020,.066),(y0+.012,.066)],.002,'leather',0,x=side*.0205)
            for z in [.037,.062]:
                k.rod('Forward brace rivet',(side*.021,y0+.016,z),(side*.023,y0+.016,z),.002,'steel',5)
        # 既存の握り範囲に収まる金色の送液管と固定金具。
        for a,b in [((side*.025,.10,-.003),(side*.025,.15,-.014)),
                    ((side*.025,.15,-.014),(side*.025,.34,-.014)),
                    ((side*.025,.34,-.014),(side*.025,.37,.006))]:
            k.rod('Gold service pipe',a,b,.003,'brass',8)
        for y in [.17,.255,.33]:
            k.rod('Pipe clamp',(side*.022,y,-.014),(side*.030,y,-.014),.0045,'steel',8)
