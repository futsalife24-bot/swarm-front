"""LZ-2 グリム（レーザー / スナイパー系統）。
目印: 前へ伸びる2本の叉（型番の 2）、上面の放熱フィン、後ろの丸い蓄電ドラム。
銃身は無い。2本の叉を銃身軸（Z=0.05）の上下対称に置き、先端の重心が軸に乗るようにする。
"""
import math

BORE = .05

SPEC = dict(
    kind='laser', code='LZ-2', name='LZ-2 グリム', family='sniper',
    bore_z=BORE,
    inlay=(.050, -.05, .045),  # 側面装甲の外側に識別インレイを置く
    # ネオン縁取り用の外形 [前, 上, 半幅]。後ろ上から時計回りに一周。
    neon_profile=[
        [-.34, .105, .032], [-.235, .121, .039], [-.165, .09, .028], [-.085, .177, .021],
        [-.02, .177, .021], [.0, .181, .028], [.157, .181, .028], [.2, .112, .016],
        [.4, .105, .016], [.66, .081, .016], [.66, .019, .016], [.4, -.005, .016],
        [.372, -.004, .025], [.362, -.036, .025], [.213, -.04, .025], [.142, -.012, .028],
        [.142, -.118, .028], [.088, -.118, .028], [.088, -.012, .03], [.022, -.012, .03],
        [.021, -.04, .024], [-.024, -.148, .024], [-.078, -.133, .024], [-.04, -.008, .03],
        [-.17, -.003, .028], [-.235, -.061, .039], [-.34, -.047, .032],
    ],
)


def build(k):
    # --- 本体 ---
    # Boxed violet-metal machine chamber, supported inside both hand zones.
    k.profile('Box machine housing', [(-.09,.010),(-.085,.105),(-.065,.132),
              (.145,.132),(.18,.112),(.18,.024),(.157,.010)], .082, 'gunmetal', .004)
    for s in [-1, 1]:
        # End-cap leaves the central window unobstructed and exposes the inlay.
        k.profile('Rear machine armor', [(-.078,.019),(-.008,.019),(.001,.030),
                  (.001,.105),(-.012,.122),(-.068,.122),(-.078,.108)],
                  .006,'gunmetal',.002,x=s*.044)
        k.profile('Inset for identification', [(-.069,.027),(-.016,.027),(-.010,.035),
                  (-.010,.091),(-.020,.111),(-.065,.111)], .002,'polymer',.001,x=s*.048)
        # Copper stepped window rim; black well exposes the coolant cylinder.
        k.profile('Copper inspection housing',[(.006,.025),(.156,.025),(.171,.039),
                  (.171,.104),(.157,.119),(.010,.119),(.001,.108),(.001,.038)],
                  .007,'copper',.001,x=s*.044)
        k.profile('Inspection dark well',[(.015,.034),(.151,.034),(.162,.044),
                  (.162,.099),(.151,.109),(.015,.109),(.010,.102),(.010,.043)],
                  .002,'polymer',.001,x=s*.049)
        k.rod('Window luminous core',(s*.051,.026,.071),(s*.051,.150,.071),.012,'glow_laser',12)
        for y in [.032,.071,.110,.146]:
            k.ring('Window copper clamp',y,.071,.016,.011,'copper',.007,x=s*.051,n=12)
        for y,z in [(.008,.030),(.008,.113),(.164,.030),(.164,.113)]:
            k.rod('Window retaining screw',(s*.048,y,z),(s*.050,y,z),.003,'gunmetal',6)
    k.profile('Pistol grip', [(-.035, 0), (.02, 0), (.019, -.039), (-.025, -.145), (-.076, -.131)],
              .042, 'polymer', .004)
    # 握りの凹凸と底板を独立した部品にし、手に持った時も単一の平面に見せない。
    for s in [-1, 1]:
        k.profile('Grip inset', [(-.043, -.042), (.006, -.042), (-.027, -.125), (-.062, -.116)],
                  .002, 'gunmetal', .001, x=s * .0215)
        for i in range(5):
            z = -.052 - i * .013
            y = -.035 - i * .005
            k.rod('Grip rib', (s * .023, y - .012, z), (s * .023, y + .015, z), .0016, 'copper', 8)
    k.profile('Grip heel', [(-.075, -.13), (-.025, -.145), (-.021, -.134), (-.069, -.119)],
              .044, 'gunmetal', .001)
    k.guard(.047, -.005, .057, .05, 'copper')

    # --- 給電セル（弾倉の位置。装填動作の手が届く場所に置く） ---
    k.rod('Power cell', (0, .115, -.005), (0, .115, -.10), .024, 'gunmetal', 16)
    k.rod('Cell charge band', (0, .115, -.042), (0, .115, -.062), .0255, 'glow_laser', 16)
    k.rod('Cell cap', (0, .115, -.10), (0, .115, -.115), .026, 'copper', 16)
    for y in [.098, .132]:
        k.rod('Cell rail', (0, y, -.02), (0, y, -.095), .003, 'copper', 8)

    # --- 後部: 銃床の代わりの蓄電ドラム（横向きの円盤） ---
    k.profile('Drum yoke', [(-.09, .075), (-.17, .07), (-.17, 0), (-.09, .005)], .05, 'gunmetal', .003)
    k.rod('Capacitor drum', (-.035, -.235, .03), (.035, -.235, .03), .085, 'gunmetal', 24)
    k.rod('Capacitor band', (-.012, -.235, .03), (.012, -.235, .03), .089, 'copper', 24)
    for s in [-1, 1]:
        # 内側の光る環は外周のレア度ネオンではなく、銅枠に囲まれた装置内部。
        k.rod('Capacitor outer copper casing',(s*.035,-.235,.03),(s*.045,-.235,.03),.082,'copper',24)
        k.rod('Capacitor recessed well',(s*.045,-.235,.03),(s*.046,-.235,.03),.068,'polymer',20)
        k.rod('Capacitor pale cyan annulus',(s*.046,-.235,.03),(s*.048,-.235,.03),.057,'glow_laser',20)
        k.rod('Capacitor inner rotor',(s*.048,-.235,.03),(s*.050,-.235,.03),.044,'gunmetal',20)
        k.rod('Capacitor inner bearing',(s*.050,-.235,.03),(s*.052,-.235,.03),.016,'copper',16)
        k.rod('Capacitor center glow',(s*.052,-.235,.03),(s*.053,-.235,.03),.009,'glow_laser',12)
        for i in range(8):
            a=i*math.pi/4
            y0,z0=-.235,.03
            wedge=[(y0+r*math.cos(a+t),z0+r*math.sin(a+t))
                   for r,t in [(.068,-.14),(.081,-.14),(.081,.14),(.068,.14)]]
            k.profile('Capacitor radial gear plate',wedge,.005,'gunmetal',0,x=s*.047)
            y,z=y0+.074*math.cos(a),z0+.074*math.sin(a)
            k.rod('Gear plate retaining bolt',(s*.050,y,z),(s*.052,y,z),.003,'copper',6)
        for z in [.018,.030,.042]:
            k.rod('Rotor cooling vane',(s*.051,-.256,z),(s*.051,-.214,z),.0015,'copper',6)
        # 参考画像の独立した銅管と支持金具を、既存の蓄電ドラムへ接続する。
        for a,b in [((s*.037,-.180,.080),(s*.037,-.155,.105)),
                    ((s*.037,-.155,.105),(s*.034,-.110,.105)),
                    ((s*.034,-.110,.105),(s*.034,-.090,.090))]:
            k.rod('Capacitor service conduit', a,b,.0025,'copper',6)
        for y in [-.145,-.115]:
            k.box('Conduit bracket', (s*.034,y,.105), (.005,.006,.008), 'polymer', 0)
    k.box('Butt pad', (0, -.331, .03), (.06, .018, .15), 'polymer', .004)

    # --- 上面: 放熱フィン7枚と小型プリズム照準 ---
    # 後ろから見たときに白い板に見えないよう、フィンは本体より狭くする。
    k.box('Fin spine', (0, .077, .134), (.03, .16, .012), 'copper', .002)
    for i in range(7):
        k.box('Heat fin', (0, .005 + i * .024, .153), (.05, .008, .05), 'bone', .0015)
        k.box('Fin root', (0, .005 + i * .024, .135), (.054, .010, .009), 'gunmetal', .001)
    k.box('Prism sight', (0, -.052, .147), (.036, .06, .044), 'gunmetal', .004)
    for y in [-.083, -.021]:
        k.rod('Sight lens', (0, y - .001, .149), (0, y + .001, .149), .013, 'polymer', 12)
    for s in [-1, 1]:
        k.profile('Sight side plate', [(-.077, .135), (-.028, .135), (-.024, .145),
                  (-.029, .162), (-.075, .162)], .002, 'copper', .001, x=s * .0185)
        k.box('Sight aperture', (s * .020, -.051, .149), (.001, .027, .010), 'polymer', .001)
        for y in [-.070, -.032]:
            k.rod('Sight screw', (s * .019, y, .149), (s * .021, y, .149), .0025, 'gunmetal', 8)

    # --- 発振部: 光る結晶棒を銅コイルで囲む ---
    k.rod('Focus crystal', (0, .20, BORE), (0, .335, BORE), .015, 'glow_laser', 12)
    for y in [.225, .262, .30]:
        k.ring('Induction coil', y, BORE, .034, .024, 'copper', .016)
        k.ring('Coil insulator', y, BORE, .027, .020, 'polymer', .018, n=16)
    k.ring('Emitter collar', .336, BORE, .03, .012, 'gunmetal', .012)

    # --- 叉（上下2本、軸に対して対称） ---
    upper = [(.19, .108), (.40, .102), (.66, .079), (.66, .068), (.40, .078), (.19, .080)]
    k.profile('Upper prong', upper, .026, 'gunmetal', .002)
    k.profile('Lower prong', [(y, 2 * BORE - z) for y, z in upper], .026, 'gunmetal', .002)
    for s in [-1, 1]:
        for z in [BORE + .042, BORE - .042]:
            k.box('Prong slot', (s * .0135, .295, z), (.002, .08, .008), 'polymer', .001)
            for y in [.27, .31, .35]:
                k.rod('Prong fastener', (s * .014, y, z), (s * .016, y, z), .003, 'copper', 8)
    k.ring('Focus ring', .40, BORE, .036, .026, 'copper', .014)
    k.ring('Focus ring small', .53, BORE, .028, .019, 'copper', .012)
    for z in [BORE + .0165, BORE - .0165]:
        k.box('Tip node', (0, .62, z), (.02, .05, .006), 'glow_laser', .001)

    # --- 左手の支え ---
    k.profile('Handguard', [(.20, -.004), (.37, -.002), (.36, -.032), (.215, -.036)], .044, 'polymer', .004)
    for s in [-1, 1]:
        for y in [.245, .295, .345]:
            k.box('Handguard cooling flute', (s * .0225, y, -.02), (.002, .014, .006), 'gunmetal', .0005)
        for y in [.22, .36]:
            k.rod('Handguard captive screw', (s * .023, y, -.018), (s * .025, y, -.018), .003, 'copper', 8)

    # --- 給電ケーブル（右側面） ---
    path = [(.036, -.20, .085), (.040, -.10, .113), (.039, .0, .108), (.034, .17, .062)]
    for a, b in zip(path, path[1:]):
        k.rod('Power cable', a, b, .005, 'copper', 8)
