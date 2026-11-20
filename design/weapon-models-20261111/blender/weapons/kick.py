"""KB-6 ケストレル。後退噴射と左右の翼を備えた離脱用装置。"""
BORE = .0475
SPEC = dict(
    kind='kick',code='KB-6',name='KB-6 ケストレル',family='special',
    # 発光排気口と重ならない本体上部にレア度インレイを置く。
    bore_z=BORE,inlay=(.050,.155,.115),
    neon_profile=[[-.36,.11,.06],[-.25,.075,.045],[-.19,.075,.035],
                  [-.19,.17,.018],[-.12,.17,.018],[.12,.135,.045],[.20,.10,.035],
                  [.40,.075,.03],[.52,.125,.078],[.52,-.03,.078],[.40,.02,.03],
                  [.30,.02,.03],[.27,-.085,.02],[.24,-.085,.02],[.22,.02,.03],
                  [.03,.01,.025],[.02,-.04,.021],[-.025,-.145,.021],
                  [-.075,-.13,.021],[-.10,.02,.035],[-.25,.025,.045],[-.36,-.015,.06]],
)

def build(k):
    k.profile('Main engine housing',[(-.10,0),(.20,0),(.22,.02),(.20,.085),(-.10,.085)],.064,'slate',.004)
    # A deep aircraft-like engine nacelle with a faceted, two-tone outer shell.
    k.profile('Faceted engine nacelle',[(-.15,.040),(-.135,.100),(-.095,.132),
              (.12,.132),(.18,.108),(.185,.055),(.15,.035),(-.11,.035)],.084,'slate',.003)
    for side in [-1,1]:
        k.profile('Raised russet upper armor',[(-.13,.100),(-.10,.128),(.105,.128),
                  (.155,.107),(.13,.100),(-.095,.100)],.004,'russet',.001,x=side*.043)
        k.profile('Nacelle leading cheek',[(.125,.042),(.17,.053),(.17,.102),(.13,.113)],
                  .006,'slate',.001,x=side*.044)
        k.profile('Nacelle rear cheek',[(-.14,.047),(-.13,.095),(-.102,.12),(-.092,.04)],
                  .006,'slate',.001,x=side*.044)
        k.rod('Nacelle upper rail',(side*.046,-.10,.13),(side*.046,.10,.13),.0025,'steel',8)
        k.rod('Nacelle lower rail',(side*.046,-.115,.039),(side*.046,.125,.039),.0025,'steel',8)
        for y in [-.11,.12]:
            k.rod('Armor seam',(side*.047,y,.043),(side*.047,y,.10),.002,'black',6)
        # A 3 x 2 set of large framed and recessed vent louvers.
        for y in [-.076,.005,.086]:
            for z in [.088,.115]:
                frame=[(y-.034,z-.012),(y-.026,z+.012),(y+.034,z+.012),(y+.026,z-.012)]
                inside=[(y-.028,z-.008),(y-.023,z+.008),(y+.028,z+.008),(y+.023,z-.008)]
                k.profile('Vent raised steel frame',frame,.003,'steel',.001,x=side*.044)
                k.profile('Vent deep recess',inside,.002,'black',.0005,x=side*.046)
                k.rod('Vent internal vane',(side*.047,y-.020,z),(side*.047,y+.020,z),.0016,'slate',6)
        for y in [-.12,-.08,-.04,0,.04,.08,.12]:
            k.rod('Nacelle upper fastener',(side*.046,y,.119),(side*.049,y,.119),.002,'steel',6)
        # Pad for the identification inlay, set above the vent row.
        k.box('Identification panel',(side*.046,.155,.115),(.006,.024,.020),'slate',.001)
    k.profile('Pistol grip',[(-.035,0),(.02,0),(.019,-.039),(-.025,-.145),(-.076,-.131)],.042,'black',.004)
    k.guard(.047,-.005,.057,.05,'steel')
    k.profile('Front support',[(.20,.02),(.30,.02),(.27,-.085),(.24,-.085)],.038,'black',.003)
    k.rod('Forward venturi',(0,.20,BORE),(0,.41,BORE),.026,'steel',24)
    k.rod('Forward bell',(0,.41,BORE),(0,.512,BORE),.03,'slate',24,r2=.073)
    k.ring('Forward nozzle rim',.514,BORE,.077,.057,'steel',.012,n=24)
    k.ring('Forward nozzle liner',.519,BORE,.057,.039,'russet',.002,n=24)
    k.rod('Forward nozzle recess',(0,.519,BORE),(0,.52,BORE),.038,'black',24)
    for y, radius in [(.425,.039),(.45,.049),(.475,.060),(.49,.067)]:
        k.ring('Forward bell reinforcing hoop',y,BORE,radius+.002,radius-.001,'steel',.004,n=16)
    # 先端3%より手前に縦の冷却リブ。ノズル中心と軸対称を保つ。
    import math
    for i in range(8):
        a=2*math.pi*i/8
        c,s=math.cos(a),math.sin(a)
        k.rod('Forward bell longitudinal rib',(.039*c,.43,BORE+.039*s),
              (.062*c,.485,BORE+.062*s),.0022,'steel',8)
    k.rod('Rear tapered jet',(0,-.36,BORE),(0,-.10,BORE),.061,'russet',24,r2=.031)
    k.ring('Rear jet rim',-.358,BORE,.064,.047,'steel',.01,n=24)
    k.ring('Rear jet hot liner',-.363,BORE,.047,.034,'glow_heat',.002,n=24)
    k.rod('Rear jet recess',(0,-.364,BORE),(0,-.362,BORE),.032,'black',24)
    for y, radius in [(-.34,.059),(-.29,.052),(-.24,.046),(-.19,.040),(-.14,.034)]:
        k.ring('Rear jet heat rib',y,BORE,radius+.002,radius-.002,'steel',.005,n=16)
    for i in range(8):
        a=2*math.pi*i/8
        c,s=math.cos(a),math.sin(a)
        k.rod('Rear nozzle reinforcing rail',(.058*c,-.34,BORE+.058*s),
              (.035*c,-.135,BORE+.035*s),.0025,'steel',8)
        for y,r in [(-.32,.056),(-.16,.038)]:
            k.rod('Rear nozzle fastening pin',(.98*r*c,y,BORE+.98*r*s),
                  (1.09*r*c,y,BORE+1.09*r*s),.0025,'black',8)
    # 大きな背びれと左右翼。翼端は機体より外側に開き後方へ掃く。
    k.profile('Dorsal swept fin',[(-.04,.085),(.12,.085),(-.12,.17),(-.19,.17)],.018,'russet',.002)
    for side in [-1,1]:
        k.profile('Dorsal fin layered panel',[(-.165,.158),(-.125,.158),(.075,.092),(.025,.092)],
                  .0015,'steel',.0005,x=side*.010)
        k.rod('Dorsal fin spar',(side*.011,-.135,.157),(side*.011,.055,.094),.002,'black',8)
        for y,z in [(-.15,.156),(-.10,.142),(-.05,.125),(0,.108)]:
            k.rod('Dorsal fin captive fastener',(side*.011,y,z),(side*.013,y,z),.0025,'black',8)
        k.profile('Side swept wing',[(-.22,.042),(-.08,.075),(.11,.07),(.15,.055),(-.12,.036)],
                  .009,'slate',.002,x=side*.068)
        k.rod('Wing spar',(side*.035,-.06,.067),(side*.073,-.17,.055),.005,'steel',10)
        k.profile('Wing dark inset',[(-.17,.048),(-.07,.067),(.07,.065),(-.08,.046)],
                  .002,'black',.001,x=side*.073)
        # 青灰の翼の上に赤茶の分割外板を重ね、参考画像の積層感を出す。
        k.profile('Wing russet overlay',[(-.16,.060),(-.07,.071),(.035,.069),(.065,.065),(-.08,.062)],
                  .0015,'russet',0,x=side*.075)
        for y,z in [(-.14,.062),(-.08,.067),(-.02,.067),(.035,.066)]:
            k.rod('Overlay fastening pin',(side*.076,y,z),(side*.078,y,z),.002,'steel',6)
        for y,z in [(-.13,.063),(-.09,.067),(-.04,.066),(.01,.066)]:
            k.box('Wing overlay panel joint',(side*.076,y,z),(.001,.004,.005),'black',0)
        for y,z in [(-.14,.054),(-.09,.057),(-.04,.059),(.01,.061)]:
            k.rod('Wing surface rivet',(side*.074,y,z),(side*.076,y,z),.0025,'russet',8)
        k.rod('Wing inner frame',(side*.074,-.17,.048),(side*.074,.08,.064),.0018,'steel',8)
        for y in [-.12,-.05,.02]:
            k.box('Wing vent notch',(side*.075,y,.052),(.002,.012,.004),'black',.0005)
        k.profile('Engine armor',[(-.085,.014),(.16,.014),(.19,.03),(.18,.071),(-.085,.071)],
                  .003,'russet',.001,x=side*.033)
        # 後端寄りと前端寄りに、外板の継ぎ目と保守用の小パネルを設ける。
        for y in [-.079,.159]:
            k.profile('Engine panel edge',[(y,.042),(y+.012,.042),(y+.012,.062),(y,.062)],
                      .002,'slate',0,x=side*.035)
            k.rod('Engine panel edge lock',(side*.036,y+.006,.052),(side*.038,y+.006,.052),.002,'steel',6)
        for y in [-.08,.17]:
            k.rod('Engine lock',(side*.035,y,.068),(side*.038,y,.068),.004,'russet',8)
        k.rod('Control unit upper seam',(side*.032,-.07,.081),(side*.032,.125,.081),.0015,'steel',8)
        for i in range(4):
            k.rod('Grip texture',(side*.021,-.05+i*.007,-.09+i*.015),
                  (side*.021,-.022+i*.007,-.09+i*.015),.002,'steel',6)
        k.rod('Wing conduit',(side*.040,-.10,.08),(side*.068,-.18,.065),.003,'russet',8)
    for y in [.23,.28,.33,.38]:
        k.ring('Forward pressure collar',y,BORE,.030,.026,'russet',.007,n=20)
