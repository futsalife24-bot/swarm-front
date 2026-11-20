"""MD-4 ブルーム: 薬液カプセルと四弁の先端を持つ支援医療銃。"""
import math

BORE = .045
SPEC = dict(
    kind='medic', code='MD-4', name='MD-4 ブルーム', family='special', bore_z=BORE,
    inlay=(.073, -.075, .05),
    neon_profile=[[-.33, .06, .008], [-.12, .07, .045], [-.10, .115, .065],
                  [-.075, .13, .035], [-.075, .198, .008], [.14, .198, .008],
                  [.14, .16, .033], [.15, .12, .035], [.17, .08, .04], [.34, .07, .025],
                  [.38, .11, .012], [.42, .145, .012], [.46, .145, .012],
                  [.50, .12, .012], [.50, -.03, .012], [.46, -.055, .012],
                  [.42, -.055, .012], [.34, .02, .025],
                  [.18, .01, .025], [.14, -.12, .022], [.08, -.12, .022],
                  [.03, -.04, .021], [-.025, -.145, .021], [-.076, -.131, .021],
                  [-.12, -.005, .04], [-.33, -.07, .008]],
)

def build(k):
    # 白い円筒を重ねた本体と、薬液残量が見える上部カプセル。
    # 中央を太く、前後をわずかに絞った独立した陶製の胴。
    k.rod('Rear rounded ceramic housing',(0,-.12,BORE),(0,-.10,BORE),.065,'white',24,r2=.070)
    k.rod('Main ceramic housing',(0,-.10,BORE),(0,.15,BORE),.070,'white',24)
    k.rod('Front rounded ceramic housing',(0,.15,BORE),(0,.17,BORE),.070,'white',24,r2=.065)
    for y in [-.115, .165]:
        k.ring('Ceramic housing rim', y, BORE, .072, .064, 'brass', .012, n=24)
    # 陶製の胴を周方向に分割し、上肩には曲面の接線に沿う点検蓋を載せる。
    for y in [-.097, .140]:
        k.ring('Ceramic housing service seam', y, BORE, .0708, .0692, 'teal', .0025, n=12)
    # 交換・点検できる筒として、離れた位置に独立した締結リングを設ける。
    for y in [-.052, .105]:
        k.ring('Housing service collar', y, BORE, .0725, .0700, 'teal', .006, n=16)
        k.ring('Housing collar edge', y+.004, BORE, .0727, .0708, 'brass', .004, n=16)
    angle = math.pi / 4
    for side in [-1, 1]:
        normal = (side * math.cos(angle), 0, math.sin(angle))
        def service_plate(name, y, radius, size, material):
            o = k.box(name, (normal[0] * radius, y, BORE + normal[2] * radius), size, material, 0)
            o.rotation_euler[1] = -side * angle
        service_plate('Curved service hatch gasket', .062, .0710, (.002, .092, .018), 'teal')
        service_plate('Curved service hatch cover', .062, .0721, (.001, .084, .012), 'white')
        for y in [.033, .051, .069, .087]:
            service_plate('Hatch ventilation slot', y, .0729, (.001, .005, .008), 'teal')
        for y in [.022, .102]:
            a = (normal[0] * .072, y, BORE + normal[2] * .072)
            b = (normal[0] * .074, y, BORE + normal[2] * .074)
            k.rod('Service hatch fastener', a, b, .002, 'teal', 6)
    # 背面は暗い機器パネルを重ね、三人称視点で大きな白い板にしない。
    k.rod('Rear instrument panel', (0,-.126,BORE),(0,-.120,BORE),.053,'teal',24)
    k.ring('Rear panel seal',-.127,BORE,.049,.045,'teal',.004,n=24)
    k.rod('Rear status lamp',(0,-.130,BORE+.018),(0,-.126,BORE+.018),.006,'vial',12)
    k.rod('Vial body', (0, -.05, .128), (0, .12, .128), .033, 'vial', 24)
    for y in [-.052, .122]:
        k.ring('Vial clamp', y, .128, .035, .031, 'brass', .012, n=16)
        k.rod('Vial cap', (0, y-.006, .128), (0, y+.006, .128), .030, 'teal', 20)
    for y in [-.015, .02, .055, .09]:
        k.ring('Dosage graduations', y, .128, .0337, .032, 'white', .003, n=16)
    k.box('Vial cradle', (0, .035, .112), (.055, .20, .014), 'teal', .002)
    # 上部槽の上をまたぐ真鍮の取っ手。頂点は高さ制限0.21mの内側。
    for a,b in [((0,-.075,.132),(0,-.075,.193)),((0,-.075,.193),(0,.14,.193)),
                ((0,.14,.193),(0,.14,.132))]:
        k.rod('Brass carry handle',a,b,.005,'brass',8)
    k.box('Handle teal grip',(0,.0325,.193),(.016,.11,.012),'teal',.001)
    for side in [-1,1]:
        k.box('Vial measurement strip', (side*.033,.034,.128), (.002,.125,.008), 'teal', .001)
        for y in [-.01,.01,.03,.05,.07,.09]:
            k.box('Vial measurement mark', (side*.0345,y,.128), (.001,.003,.012), 'white', 0)
        for y in [-.053,.123]:
            k.rod('Vial clamp screw', (side*.034,y,.128),(side*.037,y,.128),.003,'teal',8)

    # 曲線状の骨組み銃床と右手の握り。給薬セルは装填動作の位置に置く。
    for side in [-1, 1]:
        x=side*.021
        points=[(x,-.11,.06),(x,-.30,.055),(x,-.33,.04),(x,-.33,-.06),(x,-.30,-.07),(x,-.11,-.005)]
        for a,b in zip(points,points[1:]): k.rod('Skeleton stock', a,b,.006,'white',10)
        k.rod('Stock pivot', (side*.070,-.105,.045),(side*.075,-.105,.045),.010,'teal',16)
    k.box('Stock end cap', (0,-.325,-.005), (.05,.012,.11), 'teal', .003)
    k.profile('Pistol grip', [(-.035,0),(.02,0),(.019,-.039),(-.025,-.145),(-.076,-.131)], .042, 'teal', .003)
    k.guard(.047,-.005,.052,.047,'teal')
    k.profile('Dose cartridge', [(.077,-.004),(.13,-.004),(.139,-.10),(.13,-.12),(.08,-.12)], .04,'white',.003)
    k.box('Dose cartridge window', (.021,.107,-.055), (.002,.035,.06), 'vial', .001)
    k.box('Dose cartridge window', (-.021,.107,-.055), (.002,.035,.06), 'vial', .001)
    k.rod('Cartridge base', (0,.107,-.112),(0,.107,-.119),.023,'teal',16)

    # 細い先台と中心の発光面。先端3%は四弁が軸対称にそろう。
    k.rod('Delivery neck', (0,.17,BORE),(0,.36,BORE),.021,'teal',24)
    for y in [.20,.25,.30,.34]:
        k.ring('Neck retaining band',y,BORE,.025,.020,'brass',.009,n=16)
    k.profile('Underhand support', [(.18,.015),(.35,.015),(.34,-.025),(.19,-.026)],.045,'teal',.003)
    k.rod('Healing emitter', (0,.34,BORE),(0,.47,BORE),.015,'glow_heal',20)
    k.ring('Emitter collar',.36,BORE,.032,.020,'teal',.018,n=24)

    # 最上の花弁を90度ずつ回転して4枚にする。頂点も銃身軸周りで対称。
    points=[(.34,.061),(.37,.108),(.40,.132),(.43,.145),(.46,.145),
            (.49,.135),(.50,.120),(.495,.095),(.48,.075),(.46,.060),
            (.43,.045),(.39,.045),(.35,.055)]
    for turn in range(4):
        o=k.profile('Emitter petal',points,.024,'white',.002)
        for v in o.data.vertices:
            x=v.co.x; z=v.co.z-BORE
            if turn==1: v.co.x=-z; v.co.z=BORE+x
            elif turn==2: v.co.x=-x; v.co.z=BORE-z
            elif turn==3: v.co.x=z; v.co.z=BORE-x
        # 小さな着色インセットは先端3%の手前で終わらせる。
        for side in [-1,1]:
            p=k.profile('Petal inset', [(.38,.074),(.40,.090),(.44,.120),
                                        (.47,.125),(.46,.105),(.42,.077)],
                        .002,'teal',0,x=side*.0125)
            for v in p.data.vertices:
                x=v.co.x; z=v.co.z-BORE
                if turn==1: v.co.x=-z; v.co.z=BORE+x
                elif turn==2: v.co.x=-x; v.co.z=BORE-z
                elif turn==3: v.co.x=z; v.co.z=BORE-x
        # 先端3%より後ろに、4枚それぞれの対称な蝶番を設ける。
        def rotate_point(x,y,z):
            z-=BORE
            if turn==1: x,z=-z,x
            elif turn==2: x,z=-x,-z
            elif turn==3: x,z=z,-x
            return (x,y,BORE+z)
        k.rod('Petal hinge',rotate_point(-.012,.425,.095),rotate_point(.012,.425,.095),
              .006,'brass',8)
        k.rod('Petal hinge pin',rotate_point(-.014,.425,.095),rotate_point(.014,.425,.095),
              .0025,'teal',8)

    # 外装の分割・通気・留め具と握りの滑り止め。
    for side in [-1,1]:
        k.profile('Ceramic side panel', [(-.085,.012),(.12,.012),(.145,.045),(.12,.079),(-.085,.079)],
                  .004,'teal',.002,x=side*.069)
        k.profile('Side panel inset', [(-.065,.022),(.10,.022),(.12,.046),(.10,.070),(-.065,.070)],
                  .003,'white',.001,x=side*.072)
        for y in [-.065,.09]:
            k.rod('Housing fastener',(side*.072,y,.047),(side*.074,y,.047),.003,'teal',10)
        for y in [-.04,-.02,0,.02,.04]:
            k.box('Instrument mark',(side*.074,y,.046),(.002,.006,.012),'teal',0)
        # パネル上に触診用の表示、医療マーク、取付ねじを別レイヤーで置く。
        k.box('Medical cross horizontal',(side*.074,.095,.046),(.002,.020,.006),'teal',.0005)
        k.box('Medical cross vertical',(side*.074,.095,.046),(.002,.006,.020),'teal',.0005)
        for y in [-.055,.06]:
            k.rod('Control plate screw',(side*.074,y,.035),(side*.076,y,.035),.0025,'teal',8)
        for y in [-.04,-.02,0,.02,.04]:
            k.box('Control marker backing',(side*.0735,y,.065),(.002,.007,.004),'teal',0)
        k.profile('Cartridge holder edge', [(.076,-.012),(.136,-.012),(.139,-.025),(.076,-.025)],
                  .002,'teal',.001,x=side*.0205)
        for y in [.09,.125]:
            k.rod('Cartridge latch screw',(side*.021,y,-.02),(side*.023,y,-.02),.002,'teal',8)
        for i in range(4):
            y=-.047-i*.007; z=-.06-i*.017
            k.rod('Grip texture',(side*.021,y,z),(side*.021,y+.027,z),.0015,'teal',6)
        for y in [.21,.25,.29,.33]:
            k.rod('Support fastening',(side*.022,y,-.005),(side*.023,y,-.005),.0025,'white',8)

        # 薬液カプセルと送液部を立体的な配管で結び、白い胴に整備用の層を作る。
        tube=[(side*.030,.105,.110),(side*.044,.130,.100),
              (side*.047,.154,.078),(side*.039,.177,.056),
              (side*.025,.198,.045)]
        for a,b in zip(tube,tube[1:]):
            k.rod('Dose transfer conduit',a,b,.0035,'teal',6)
        rear_tube=[(side*.026,-.050,.121),(side*.037,-.070,.113),
                   (side*.045,-.084,.096),(side*.047,-.094,.078)]
        for a,b in zip(rear_tube,rear_tube[1:]):
            k.rod('Return conduit',a,b,.003,'teal',6)

        # 識別インレイに重ならない範囲で、薬液量を示す暗い窓と段付きの枠を配置。
        k.profile('Dose readout surround', [(-.055,.010),(.115,.010),(.130,.026),
                                            (.130,.065),(.115,.080),(-.055,.080)],
                  .004,'teal',0,x=side*.075)
        k.profile('Dose readout glass', [(-.048,.018),(.107,.018),(.120,.030),
                                        (.120,.061),(.107,.072),(-.048,.072)],
                  .002,'vial',0,x=side*.078)
        # 透明な画像素材を使わず、既存材質の細いフレームで窓と留め具を表現する。
        for z in [.014,.076]:
            k.rod('Readout guard rail',(side*.080,-.050,z),(side*.080,.120,z),.0025,'brass',6)
        for y in [-.050,.120]:
            k.rod('Readout guard clasp',(side*.080,y,.014),(side*.080,y,.076),.0025,'brass',6)
            k.rod('Readout guard bolt',(side*.080,y,.047),(side*.083,y,.047),.0025,'teal',6)
        for y in [-.020,0,.020,.040,.060,.080,.100]:
            k.box('Dose readout tick',(side*.0795,y,.046),(.001,.002,.020),'white',0)

        # 投与セルのつかみ位置に複数の段差を設け、交換式部品として読めるようにする。
        for z in [-.038,-.067,-.096]:
            k.box('Cartridge grip band',(side*.022,.107,z),(.003,.031,.004),'teal',0)
        k.profile('Cartridge lower latch',[(.083,-.103),(.13,-.103),(.129,-.116),(.084,-.116)],
                  .003,'teal',0,x=side*.021)
