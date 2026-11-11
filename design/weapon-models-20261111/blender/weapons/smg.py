"""SMG-3 ワスプ: 三節の腹、先端の針と二本の前傾弾倉を持つ短機関銃。"""

BORE = .045
SPEC = dict(
    kind='smg', code='SMG-3', name='SMG-3 ワスプ', family='rifle', bore_z=BORE,
    inlay=(.0305, -.045, .058),
    neon_profile=[[-.20, .073, .008], [-.09, .073, .028], [-.02, .100, .025],
                  [.15, .085, .03], [.18, .085, .035], [.23, .083, .035],
                  [.28, .079, .032], [.33, .072, .027], [.35, .055, .015],
                  [.42, .050, .005], [.42, .040, .005], [.35, .035, .015],
                  [.33, .018, .027], [.18, .006, .035], [.155, -.01, .022],
                  [.15, -.125, .019], [.12, -.125, .019], [.105, -.17, .019],
                  [.068, -.17, .019], [.03, -.01, .021], [-.025, -.145, .021],
                  [-.076, -.131, .021], [-.09, -.005, .028], [-.20, -.02, .008]],
)

def build(k):
    # 断面を段階的に細くした三節の銃身覆い。最後は細い軸対称の針。
    k.profile('Compact receiver', [(-.09, 0), (.16, 0), (.17, .025), (.15, .085),
                                   (-.07, .085), (-.09, .07)], .056, 'polymer', .004)
    for i, (a, b, radius) in enumerate([(.16, .226, .038), (.230, .286, .034), (.290, .339, .029)]):
        k.rod('Armored abdomen segment', (0, a, BORE), (0, b, BORE), radius, 'polymer', 24)
        k.ring('Abdomen yellow band', (a + b) / 2, BORE, radius + .001, radius - .002, 'hazard', .012, n=24)
        k.ring('Segment joint', b, BORE, radius + .001, radius - .003, 'steel', .004, n=24)
        # 各節に分割装甲、帯留め、短い冷却溝を設け、3本の黄帯は独立して見せる。
        midpoint = (a+b)/2
        for side in [-1,1]:
            k.box('Band latch', (side*(radius+.001),midpoint,BORE), (.003,.009,.014), 'black', .001)
            k.rod('Band latch screw', (side*(radius+.0025),midpoint,BORE),
                  (side*(radius+.004),midpoint,BORE),.0023,'steel',8)
            for y in [a+.012,b-.011]:
                k.box('Segment armor panel', (side*(radius-.001),y,BORE+.006),
                      (.003,.012,.014),'gunmetal',.001)
                k.box('Armor cutout', (side*(radius+.001),y,BORE+.006),
                      (.001,.007,.005),'black',.0005)
            k.rod('Segment seam screw', (side*(radius-.001),a+.011,BORE-.012),
                  (side*radius,a+.011,BORE-.012),.002,'steel',8)
        for y in [a+.013,b-.012]:
            k.box('Segment top inset', (0,y,BORE+radius-.001), (.018,.012,.003), 'gunmetal', .001)
    k.rod('Needle mount', (0, .339, BORE), (0, .366, BORE), .017, 'steel', 20, r2=.011)
    k.rod('Symmetric needle', (0, .366, BORE), (0, .42, BORE), .010, 'steel', 16, r2=.003)
    k.rod('Needle dark tip', (0, .415, BORE), (0, .42, BORE), .003, 'black', 12)
    k.profile('Front support', [(.18, .016), (.34, .016), (.33, -.015), (.19, -.018)], .043, 'polymer', .002)

    # 右手の握り、装填部、前傾する二本の箱型弾倉。
    k.profile('Pistol grip', [(-.035, 0), (.02, 0), (.019, -.039), (-.025, -.145), (-.076, -.131)], .042, 'polymer', .003)
    k.guard(.047, -.005, .053, .047, 'steel')
    k.profile('Primary magazine', [(.032, -.003), (.068, -.003), (.105, -.17), (.068, -.17)], .038, 'steel', .003)
    k.profile('Secondary magazine', [(.088, -.003), (.112, -.003), (.146, -.125), (.122, -.125)], .034, 'hazard', .003)
    k.profile('Magazine retaining frame', [(.028, .006), (.12, .006), (.123, -.014), (.035, -.014)], .048, 'black', .002)
    for side in [-1, 1]:
        k.profile('Magazine side inset', [(.041, -.022), (.06, -.022), (.088, -.142), (.074, -.142)],
                  .002, 'black', .001, x=side * .0195)
        for y,z in [(.052,-.04),(.063,-.08),(.074,-.12)]:
            k.rod('Magazine retaining rivet', (side*.020,y,z), (side*.021,y,z), .0025, 'hazard', 8)
        for i in range(4):
            y=-.047-i*.007; z=-.06-i*.017
            k.rod('Grip cross hatch', (side*.021,y,z), (side*.021,y+.027,z), .0016, 'steel', 6)

    # 針金銃床を二重の骨組みにして、接合部を立体的にする。
    for side in [-1,1]:
        x=side*.019
        pts=[(x,-.075,.066),(x,-.19,.066),(x,-.20,.052),(x,-.20,-.018),(x,-.18,-.027),(x,-.075,.012)]
        for a,b in zip(pts,pts[1:]): k.rod('Wire stock strut', a,b,.004,'steel',8)
        k.rod('Stock joint', (side*.027,-.07,.048),(side*.031,-.07,.048),.008,'hazard',12)
    k.box('Stock butt', (0,-.198,.019), (.047,.005,.078), 'black', .002)

    # 細部は色ごとの別部品として配置し、継ぎ目や機械の稼働箇所を見せる。
    k.box('Low sight rail', (0,.02,.089), (.034,.12,.012), 'steel', .002)
    for y in [-.02,.005,.03,.055]:
        k.box('Sight rail notch', (0,y,.096), (.032,.006,.004), 'black', .0005)
    for side in [-1,1]:
        k.profile('Receiver side armor', [(-.064,.019),(.125,.019),(.13,.072),(-.064,.072)],
                  .002,'gunmetal',.001,x=side*.0285)
        k.profile('Receiver armor upper edge', [(-.063,.066),(.13,.066),(.145,.079),(-.063,.079)],
                  .003,'steel',.001,x=side*.029)
        k.profile('Receiver lower edge', [(-.064,.012),(.13,.012),(.13,.022),(-.064,.022)],
                  .003,'steel',.001,x=side*.029)
        k.box('Recessed receiver panel', (side*.030,.035,.045), (.002,.11,.03), 'black', .001)
        for y in [-.012,.010,.032,.054,.076]:
            k.box('Receiver ventilation slot', (side*.031,y,.045), (.002,.008,.020), 'polymer', .0005)
        for y in [-.055,.108]:
            k.rod('Panel fastener', (side*.030,y,.065),(side*.032,y,.065),.003,'hazard',8)
        for y in [-.045,-.015,.015,.045,.075,.105]:
            k.rod('Lower armor fastener', (side*.031,y,.017),(side*.033,y,.017),.0025,'steel',8)
        k.profile('Side charging mechanism', [(.11,.030),(.145,.030),(.15,.047),(.11,.047)],
                  .003,'black',.001,x=side*.029)
        k.rod('Charging button', (side*.030,.13,.038),(side*.034,.13,.038),.006,'hazard',12)
        for y in [.19,.215,.245,.27,.305,.325]:
            k.box('Abdomen recess', (side*.028,y,.058), (.002,.009,.006), 'black', .0005)
        for y in [.21,.25,.29,.32]:
            k.rod('Support screw', (side*.022,y,-.005),(side*.023,y,-.005),.0025,'steel',8)
