"""SMG-3 ワスプ: 三節の腹、先端の針と二本の前傾弾倉を持つ短機関銃。"""

BORE = .045
SPEC = dict(
    kind='smg', code='SMG-3', name='SMG-3 ワスプ', family='rifle', bore_z=BORE,
    inlay=(.038, -.045, .058),
    neon_profile=[[-.20, .073, .008], [-.09, .114, .039], [-.075, .151, .025], [-.045, .153, .025], [.065, .153, .025], [.102, .151, .025], [.13, .11, .035],
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
        k.rod('Armored abdomen segment', (0, a, BORE), (0, b, BORE), radius, 'polymer', 20)
        k.ring('Abdomen yellow band', (a + b) / 2, BORE, radius + .001, radius - .002, 'hazard', .012, n=16)
        k.ring('Segment joint', b, BORE, radius + .001, radius - .003, 'steel', .004, n=16)
        # 各節に分割装甲、帯留め、短い冷却溝を設け、3本の黄帯は独立して見せる。
        midpoint = (a+b)/2
        for side in [-1,1]:
            k.box('Band latch', (side*(radius+.001),midpoint,BORE), (.003,.009,.014), 'black', 0)
            k.rod('Band latch screw', (side*(radius+.0025),midpoint,BORE),
                  (side*(radius+.004),midpoint,BORE),.0023,'steel',8)
            for y in [a+.012,b-.011]:
                k.box('Segment armor panel', (side*(radius-.001),y,BORE+.006),
                      (.003,.012,.014),'gunmetal',0)
                k.box('Armor cutout', (side*(radius+.001),y,BORE+.006),
                      (.001,.007,.005),'black',0)
            k.rod('Segment seam screw', (side*(radius-.001),a+.011,BORE-.012),
                  (side*radius,a+.011,BORE-.012),.002,'steel',8)
        for y in [a+.013,b-.012]:
            k.box('Segment top inset', (0,y,BORE+radius-.001), (.018,.012,.003), 'gunmetal', 0)
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

        # 前方の支持具を別体のヒートシールドに見せる。節・黄帯を隠さない。
        k.profile('Support shield inset', [(.197,.006),(.319,.006),(.311,-.008),(.204,-.011)],
                  .002,'gunmetal',0,x=side*.0225)
        k.profile('Support shield lower rib', [(.206,-.012),(.310,-.009),(.307,-.014),(.207,-.017)],
                  .002,'steel',0,x=side*.0225)
        for y in [.22,.25,.28,.30]:
            k.box('Shield cooling notch',(side*.024,y,-.001),(.002,.010,.004),'black',0)

        # 黄い副弾倉に外装継ぎ目と確認窓を設け、単色の板に見えないようにする。
        k.profile('Auxiliary magazine frame',[(.096,-.024),(.112,-.024),(.137,-.108),(.124,-.108)],
                  .0015,'black',0,x=side*.0175)
        k.profile('Auxiliary magazine insert',[(.100,-.031),(.108,-.031),(.128,-.100),(.124,-.100)],
                  .0015,'gunmetal',0,x=side*.0185)
        for y,z in [(.104,-.041),(.111,-.063),(.118,-.085)]:
            k.box('Auxiliary magazine marker',(side*.0195,y,z),(.001,.005,.003),'hazard',0)
        k.rod('Auxiliary magazine retaining pin',(side*.018,.127,-.101),
              (side*.020,.127,-.101),.002,'steel',8)

        # 上部レールの前後で照準器の支えと狭い照準溝を立てる。
        for y in [-.027,.060]:
            k.box('Sight mount foot',(side*.010,y,.095),(.009,.010,.004),'gunmetal',0)
            k.box('Sight mount tooth',(side*.010,y,.098),(.004,.006,.003),'steel',0)

        # 銃床と機関部の接合部を、着脱できる固定ラグとして浮き上がらせる。
        k.profile('Stock mount lug',[(-.085,.024),(-.067,.024),(-.063,.036),(-.084,.039)],
                  .003,'gunmetal',0,x=side*.0285)
        k.rod('Stock mount lug pin',(side*.030,-.075,.031),(side*.032,-.075,.031),
              .003,'steel',8)
        k.profile('Grip heel reinforcement',[(-.075,-.128),(-.026,-.141),(-.029,-.145),(-.076,-.133)],
                  .002,'gunmetal',0,x=side*.022)

        # 参考画像の工業装甲を、インレイを避けた着脱式の黄黒パネルに置き換える。
        k.profile('Rear yellow armor', [(-.088,.020),(-.088,.071),(-.069,.080),
                  (-.059,.073),(-.059,.024),(-.068,.016)], .002, 'hazard', 0, x=side*.030)
        k.profile('Rear dark armor insert', [(-.084,.027),(-.084,.064),(-.071,.071),
                  (-.065,.067),(-.065,.027)], .001, 'gunmetal', 0, x=side*.0315)
        k.profile('Forward yellow armor', [(.082,.066),(.130,.066),(.142,.076),
                  (.132,.081),(.082,.081)], .002, 'hazard', 0, x=side*.030)
        k.profile('Forward yellow lower armor', [(.079,.011),(.135,.011),(.140,.020),
                  (.130,.024),(.079,.024)], .002, 'hazard', 0, x=side*.030)
        for y in [.087,.102,.117]:
            k.box('Armor locking tooth',(side*.0315,y,.074),(.002,.006,.004),'black',0)
        for y in [-.078,.084,.130]:
            k.rod('Armor locking rivet',(side*.031,y,.020),(side*.033,y,.020),.0025,'steel',8)
        # 外装下に短い金属の作動軸と固定クランプを見せる。
        k.rod('Visible receiver actuator',(side*.031,-.015,.028),(side*.031,.070,.028),.0032,'steel',10)
        for y in [-.010,.038,.065]:
            k.box('Actuator retaining clamp',(side*.032,y,.028),(.004,.005,.010),'black',.0005)
        for y in [.180,.242,.301]:
            k.profile('Abdomen hazard shield',[(y,.060),(y+.014,.060),(y+.020,.069),
                      (y+.016,.075),(y+.002,.075)], .002,'hazard',0,x=side*.030)
            k.box('Shield identification slot',(side*.0315,y+.010,.068),(.001,.008,.003),'black',0)

        # 片面の独立した整備口と横軸。面取りを使わず小部品の負荷を抑える。
        k.profile('Service port metal surround',[(.070,.028),(.112,.028),(.122,.037),
                  (.118,.059),(.070,.059)], .002,'steel',0,x=side*.032)
        k.profile('Service port dark inset',[(.074,.032),(.109,.032),(.116,.039),
                  (.113,.055),(.074,.055)], .001,'black',0,x=side*.0335)
        k.rod('Service port spindle',(side*.034,.095,.044),(side*.036,.095,.044),.008,'gunmetal',12)
        k.rod('Spindle retaining pin',(side*.036,.095,.044),(side*.037,.095,.044),.003,'hazard',8)
        for y in [.078,.111]:
            k.rod('Service port fastener',(side*.034,y,.035),(side*.036,y,.035),.002,'steel',6)
        for y in [.020,.040,.060]:
            k.box('Receiver metallic seam',(side*.032,y,.071),(.001,.011,.002),'steel',0)

    # 隔離試作: 大きな整備パネル・取っ手・段差を設けた工業的な外装。
    # 両側の等級インレイが見える領域は開放し、握り範囲を避ける。
    for side in [-1,1]:
        x=side*.036
        k.profile('Industrial rear cheek', [(-.094,.028),(-.062,.028),(-.060,.097),(-.083,.108),(-.094,.091)],
                  .006,'hazard',0,x=x)
        k.profile('Industrial front cheek', [(-.028,.028),(.106,.028),(.130,.047),(.130,.093),(.113,.111),(-.028,.106)],
                  .006,'gunmetal',0,x=x)
        k.profile('Upper yellow armor slab', [(-.028,.083),(.090,.083),(.11,.096),(.105,.109),(-.028,.103)],
                  .004,'hazard',0,x=side*.040)
        k.profile('Lower yellow armor slab', [(-.026,.027),(.086,.027),(.099,.037),(.091,.047),(-.026,.046)],
                  .004,'hazard',0,x=side*.040)
        k.profile('Black vent recess', [(-.015,.051),(.065,.051),(.081,.060),(.065,.079),(-.015,.079)],
                  .003,'black',0,x=side*.040)
        for y in [-.006,.026,.058]:
            k.box('Raised vent rib',(side*.042,y,.065),(.004,.006,.022),'steel',0)
        for y,z in [(-.087,.035),(-.087,.091),(.079,.036),(.096,.097)]:
            k.rod('Structural side bolt',(side*.041,y,z),(side*.044,y,z),.0035,'steel',6)
        # 接続リングの上半分に厚みの異なる装甲を重ねる。
        for y in [.178,.235,.294]:
            k.profile('Segment upper shoulder', [(y,.076),(y+.030,.076),(y+.034,.092),(y+.020,.104),(y,.101)],
                      .005,'gunmetal',0,x=side*.032)
            k.profile('Segment painted flange', [(y+.003,.091),(y+.027,.091),(y+.021,.099),(y+.005,.097)],
                      .003,'hazard',0,x=side*.035)
    # 取っ手の斜め支柱と太い横桟。銃身の中心線と先端には干渉させない。
    for side in [-1,1]:
        x=side*.019
        k.rod('Carry handle foot',(x,-.065,.097),(x,-.050,.148),.0055,'steel',8)
        k.rod('Carry handle rail',(x,-.050,.148),(x,.067,.148),.006,'steel',8)
        k.rod('Carry handle front foot',(x,.067,.148),(x,.090,.099),.0055,'steel',8)
    k.rod('Carry handle rear bridge',(-.019,-.050,.148),(.019,-.050,.148),.0055,'steel',8)
    k.rod('Carry handle front bridge',(-.019,.067,.148),(.019,.067,.148),.0055,'steel',8)
