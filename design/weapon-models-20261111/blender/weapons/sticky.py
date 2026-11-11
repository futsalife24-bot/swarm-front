"""ST-3 リンバー: 三連薬液ボンベを備える肩掛け式の粘着剤射出器。"""
import math

BORE = .045
SPEC = dict(
    kind='sticky', code='ST-3', name='ST-3 リンバー', family='grenade',
    bore_z=BORE, inlay=(.037, -.055, .045),
    neon_profile=[[-.34,.105,.046],[-.27,.105,.043],[-.18,.09,.038],
      [-.12,.09,.036],[-.09,.08,.035],[-.04,.08,.035],[-.034,.175,.027],
      [-.017,.195,.027],[.008,.195,.027],[.025,.175,.027],[.025,.085,.035],
      [.050,.085,.035],[.051,.175,.027],[.068,.195,.027],[.093,.195,.027],
      [.11,.175,.027],[.11,.085,.035],[.135,.085,.035],[.136,.175,.027],
      [.153,.195,.027],[.178,.195,.027],[.195,.175,.027],[.195,.09,.035],
      [.26,.09,.04],[.33,.085,.038],[.41,.07,.035],[.44,.075,.035],
      [.56,.115,.07],[.56,-.025,.07],[.44,.015,.035],[.33,.015,.035],
      [.30,-.10,.02],[.26,-.10,.02],[.24,.015,.035],[.19,.015,.035],
      [.17,-.105,.025],[.11,-.105,.025],[.09,.005,.035],[.025,.005,.035],
      [.02,-.035,.021],[-.026,-.13,.021],[-.075,-.112,.021],[-.06,.005,.035],
      [-.18,.005,.035],[-.30,.02,.043],[-.34,.02,.046]],
)


def build(k):
    # 担ぎ姿勢用の後部筒と肩当て。小銃風の長い銃床は設けない。
    k.rod('Rear pressure housing', (0,-.33,.065), (0,-.145,.065), .040, 'steel', 24)
    k.rod('Rear sealed cap', (0,-.340,.065), (0,-.328,.065), .043, 'polymer', 24)
    for y in [-.30,-.24,-.18]:
        k.ring('Rear pressure collar', y, .065, .043, .039, 'hazmat', .008, n=20)
    for angle in range(8):
        a=2*math.pi*angle/8
        x,z=.0405*math.cos(a),.065+.0405*math.sin(a)
        k.rod('Rear pressure seam', (x,-.285,z),(x,-.255,z),.002,'polymer',6)
        k.rod('Rear end fastener',(x,-.334,z),(x,-.338,z),.003,'steel',8)
    k.profile('Shoulder saddle', [(-.31,.027),(-.16,.027),(-.145,.012),(-.16,-.012),(-.28,-.012)],
              .052, 'polymer', .003)
    # 中央機関部と前後握りは現行ロケット動作の座標を尊重する。
    k.profile('Pressure receiver', [(-.15,.008),(.21,.008),(.255,.025),(.255,.075),
              (.20,.09),(-.12,.09),(-.15,.075)], .070, 'hazmat', .003)
    k.profile('Pistol grip', [(-.035,.008),(.02,.008),(.019,-.039),(-.025,-.132),(-.076,-.116)],
              .042, 'polymer', .003)
    k.guard(.045,.006,.055,.048,'steel')
    k.profile('Front hand support', [(.205,.02),(.30,.02),(.30,-.025),(.29,-.10),(.26,-.10),(.25,-.025)],
              .038,'polymer',.003)
    # 換装可能な薬液バルブ。装填時の手の近くに接続部を設ける。
    k.rod('Feed coupling', (0,.13,.009), (0,.13,-.080), .022, 'steel', 16)
    k.rod('Feed cartridge', (0,.13,-.080), (0,.13,-.103), .023, 'goo', 16)
    k.rod('Cartridge base', (0,.13,-.103), (0,.13,-.109), .024, 'polymer', 16)
    # 軸から対称のラッパ形射出口。先端3%は軸対称形のみ。
    k.rod('Delivery neck', (0,.255,BORE), (0,.44,BORE), .030, 'steel', 24)
    k.rod('Flared nozzle', (0,.44,BORE), (0,.545,BORE), .031, 'hazmat', 28, r2=.064)
    k.ring('Nozzle rim', .548, BORE, .070, .052, 'steel', .016, n=28)
    k.ring('Nozzle luminous inner ring', .556, BORE, .051, .038, 'glow_acid', .003, n=24)
    k.rod('Nozzle central recess', (0,.556,BORE), (0,.557,BORE), .037, 'polymer', 24)
    # 銃口を覆う8枚の冷却リブは先端3%より後ろで止める。
    for i in range(8):
        a=2*math.pi*i/8
        k.rod('Nozzle protective fin', (.039*math.cos(a),.47,BORE+.039*math.sin(a)),
              (.058*math.cos(a),.525,BORE+.058*math.sin(a)), .0035,'steel',8)
        if i % 2 == 0:
            k.rod('Nozzle fin bolt', (.058*math.cos(a),.520,BORE+.058*math.sin(a)),
                  (.061*math.cos(a),.520,BORE+.061*math.sin(a)), .0025,'polymer',6)
    # 三本それぞれに金属の蓋・薬液の窓・抱持器具を置く。
    for tank_index, y in enumerate([-.005,.08,.165]):
        k.rod('Chemical cylinder', (0,y,.088), (0,y,.177), .028, 'goo', 20)
        k.rod('Cylinder bottom collar', (0,y,.087), (0,y,.101), .030, 'steel', 20)
        k.rod('Cylinder upper collar', (0,y,.169), (0,y,.18), .030, 'steel', 20)
        k.rod('Cylinder valve', (0,y,.18), (0,y,.193), .013, 'polymer', 16)
        k.rod('Cylinder valve pin', (0,y,.193), (0,y,.198), .006, 'steel', 12)
        for side in [-1,1]:
            k.box('Cylinder viewing slot', (side*.0275,y,.135), (.003,.016,.042), 'glow_acid', .001)
            for z in [.104,.166]:
                k.rod('Cylinder clamp rivet', (side*.028,y,z), (side*.032,y,z), .003, 'polymer', 8)
        for yoff in [-.022,.022]:
            k.rod('Cylinder protective upright', (0,y+yoff,.100), (0,y+yoff,.166), .0025, 'steel', 8)
        # 薬液の残量目盛りと保守ラッチを各ボンベへ独立して設ける。
        for side in [-1,1]:
            for z in [.114,.134,.154]:
                k.box('Cylinder level graduation', (side*.030,y+.013,z), (.002,.009,.002), 'steel', 0)
            k.box('Cylinder latch', (side*.031,y-.014,.163), (.004,.008,.010), 'polymer', .001)
            k.rod('Latch pin', (side*.033,y-.014,.163),(side*.035,y-.014,.163),.002,'steel',8)
    # 供給管はボンベから射出口までつながり、蛇腹と固定バンドを分ける。
    for side in [-1,1]:
        for a,b in [((side*.024,.185,.17),(side*.039,.225,.148)),
                    ((side*.039,.225,.148),(side*.043,.28,.10)),
                    ((side*.043,.28,.10),(side*.038,.315,.075))]:
            k.rod('Chemical hose', a,b,.006,'polymer',10)
        for i in range(6):
            t=i/5
            y=.225+.055*t
            z=.148-.048*t
            k.rod('Corrugated hose rib', (side*.036,y,z), (side*.050,y,z), .007,'steel',8)
        # 識別片の周りを避けて、別々の装甲・螺子・放熱孔を配置する。
        k.profile('Receiver upper armor', [(-.135,.069),(.20,.069),(.22,.079),(.20,.087),(-.13,.087)],
                  .003,'steel',.001,x=side*.036)
        k.profile('Receiver lower armor', [(-.13,.015),(.19,.015),(.21,.025),(-.13,.025)],
                  .003,'polymer',.001,x=side*.036)
        for y in [.002,.054,.106,.158]:
            k.profile('Segmented service plate', [(y,.028),(y+.038,.028),(y+.044,.034),
                      (y+.044,.061),(y+.038,.067),(y,.067)],
                      .002,'steel',0,x=side*.037)
            k.profile('Recessed inspection pad', [(y+.004,.033),(y+.035,.033),(y+.039,.037),
                      (y+.039,.057),(y+.035,.062),(y+.004,.062)],
                      .001,'polymer',0,x=side*.0385)
            for yy,z in [(y+.007,.035),(y+.033,.060)]:
                k.rod('Plate fastener', (side*.039,yy,z), (side*.041,yy,z), .0025,'steel',6)
            k.box('Access indicator', (side*.0395,y+.022,.048), (.002,.009,.012), 'goo', .0005)
        for y in [-.12,.025,.105,.19]:
            for z in [.033,.061]:
                k.rod('Receiver screw', (side*.035,y,z), (side*.038,y,z), .003,'steel',8)
        for y in [.025,.045,.065,.085,.105]:
            k.box('Pressure vent', (side*.0365,y,.047), (.003,.009,.018), 'polymer', .001)
        for i in range(4):
            z=-.05-i*.016
            y=-.037-i*.006
            k.rod('Grip texture', (side*.021,y-.011,z), (side*.021,y+.014,z), .0018,'steel',6)
        for z in [-.035,-.052,-.069,-.086]:
            k.rod('Foregrip texture', (side*.019,.266,z), (side*.019,.288,z), .0018,'steel',6)
        for y in [.335,.36,.385,.41]:
            k.box('Neck cooling flute', (side*.030,y,.052), (.003,.012,.016), 'polymer', .001)
