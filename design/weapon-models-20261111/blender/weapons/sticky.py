"""ST-3 リンバー: 三連薬液ボンベを備える肩掛け式の粘着剤射出器。"""
import math

BORE = .045
SPEC = dict(
    kind='sticky', code='ST-3', name='ST-3 リンバー', family='grenade',
    bore_z=BORE, inlay=(.042, -.22, .065),
    neon_profile=[[-.34,.105,.046],[-.27,.105,.043],[-.18,.09,.038],
      [-.12,.09,.036],[-.108,.153,.064],[-.106,.184,.064],[-.086,.205,.064],
      [-.06,.209,.064],[-.034,.205,.064],[-.014,.184,.064],[-.012,.153,.064],
      [.018,.153,.064],[.020,.184,.064],[.044,.205,.064],[.070,.209,.064],
      [.096,.205,.064],[.120,.184,.064],[.122,.153,.064],
      [.148,.153,.064],[.150,.184,.064],[.174,.205,.064],[.20,.209,.064],
      [.226,.205,.064],[.25,.184,.064],[.252,.153,.064],[.252,.09,.05],
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
    for angle in range(4):
        a=2*math.pi*angle/4
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
    # 三本それぞれに金属の蓋・薬液の窓・抱持器具を置く。
    for tank_index, y in enumerate([-.06,.07,.20]):
        # 横幅と高さを大きく取り、三槽それぞれの薬液を本体側面から見せる。
        k.rod('Chemical cylinder', (0,y,.035), (0,y,.104), .048, 'goo', 20)
        k.rod('Cylinder dark upper chamber', (0,y,.104), (0,y,.158), .048, 'polymer', 20)
        k.rod('Cylinder bottom collar', (0,y,.035), (0,y,.047), .050, 'steel', 20)
        k.rod('Cylinder upper collar', (0,y,.150), (0,y,.163), .050, 'steel', 20)
        k.rod('Cylinder liquid level band', (0,y,.102), (0,y,.106), .049, 'steel', 16)
        k.rod('Cylinder valve', (0,y,.163), (0,y,.170), .013, 'polymer', 16)
        k.rod('Cylinder valve pin', (0,y,.170), (0,y,.175), .006, 'steel', 12)
        # 外枠と目盛りは槽の端に置き、ピンクの面積を確保する。
        for side in [-1,1]:
            k.box('Cylinder upper glass glint',(side*.043,y+.020,.127),(.002,.003,.025),'steel',0)
            for z in [.075,.095,.115,.135]:
                k.box('Cylinder level graduation', (side*.048,y+.014,z), (.002,.008,.002), 'steel', 0)
            for dy in [-.040,.040]:
                k.rod('Cylinder cage upright', (side*.049,y+dy,.047),
                      (side*.049,y+dy,.150),.003,'polymer',6)
            for z in [.049,.149]:
                k.rod('Cylinder cage bridge', (side*.049,y-.04,z),
                      (side*.049,y+.04,z),.003,'steel',6)
        # 各液槽の上に蛇腹管を１本ずつ這わせる。最高点は設計枠 .21 m 内。
        arch = [(-.048,.151),(-.046,.168),(-.040,.183),(-.026,.195),
                (0,.198),(.026,.195),(.040,.183),(.046,.168),(.048,.151)]
        for i in range(len(arch)-1):
            y0,z0=arch[i]
            y1,z1=arch[i+1]
            a,b=(0,y+y0,z0),(0,y+y1,z1)
            k.rod('Tank arched hose',a,b,.010,'polymer',6)
            if i in [1,2,3,4,5,6]:
                k.rod('Tank hose rib',
                      (0,y+y0*.60+y1*.40,z0*.60+z1*.40),
                      (0,y+y0*.40+y1*.60,z0*.40+z1*.60),.010,'steel',6)
    # 橙の上下レールと仕切りが、三槽を別々の点検区画として保持する。
    for side in [-1,1]:
        for z in [.043,.160]:
            k.box('Industrial frame longitudinal rail',(side*.056,.07,z),(.014,.37,.014),'hazmat',.001)
        for y in [-.125,.005,.135,.25]:
            k.box('Industrial frame vertical brace',(side*.056,y,.101),(.014,.020,.130),'hazmat',.002)
            for z in [.047,.15]:
                k.rod('Industrial frame pin',(side*.064,y,z),(side*.068,y,z),.004,'steel',6)
    # 外装の隅は黒い縁・橙の重なり・太い固定具で構成し、札サイズでも３槽の枠を分ける。
    for side in [-1,1]:
        for y in [-.125,.005,.135,.25]:
            k.profile('Outer frame dark edge',[(y-.013,.052),(y+.013,.052),(y+.013,.150),
                      (y+.008,.160),(y-.008,.160),(y-.013,.150)],.004,'polymer',0,x=side*.064)
            k.profile('Outer frame orange armor',[(y-.008,.058),(y+.008,.058),(y+.008,.148),
                      (y+.005,.154),(y-.005,.154),(y-.008,.148)],.003,'hazmat',0,x=side*.068)
            for z in [.067,.144]:
                k.rod('Armor clamp bolt',(side*.070,y,z),(side*.073,y,z),.0035,'steel',6)
    # 供給管はボンベから射出口までつながり、蛇腹と固定バンドを分ける。
    for side in [-1,1]:
        for a,b in [((side*.024,.185,.154),(side*.039,.225,.148)),
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
        for y in [-.12,.135]:
            for z in [.033,.061]:
                k.rod('Receiver screw', (side*.035,y,z), (side*.038,y,z), .003,'steel',8)
        for i in range(2):
            z=-.05-i*.032
            y=-.037-i*.012
            k.rod('Grip texture', (side*.021,y-.011,z), (side*.021,y+.014,z), .0018,'steel',6)
        for z in [-.035,-.069]:
            k.rod('Foregrip texture', (side*.019,.266,z), (side*.019,.288,z), .0018,'steel',6)
        for y in [.335,.36,.385,.41]:
            k.box('Neck cooling flute', (side*.030,y,.052), (.003,.012,.016), 'polymer', .001)
