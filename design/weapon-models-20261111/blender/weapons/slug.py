"""SG-7 スパイク: 真鍮帯7本、銃身下の大棘、レバーを持つスラッグ銃。"""

BORE = .054
SPEC = dict(
    kind='slug', code='SG-7', name='SG-7 スパイク', family='shotgun', bore_z=BORE,
    inlay=(.031, -.03, .047),
    neon_profile=[[-.38, -.02, .023], [-.13, .02, .023], [-.07, .05, .03],
                  [-.02, .08, .03], [.13, .08, .03], [.17, .092, .038],
                  [.57, .092, .038], [.61, .082, .028], [.66, .082, .028],
                  [.66, .026, .028], [.615, .026, .028], [.615, -.006, .018],
                  [.445, -.105, .018], [.42, -.04, .026], [.15, -.03, .024],
                  [.10, -.03, .01], [.085, -.137, .01], [-.045, -.137, .01],
                  [-.08, -.04, .023], [-.19, -.065, .023], [-.375, -.13, .023]],
)

def build(k):
    # 革巻きの曲銃床。独立した拳銃型の握りは設けない。
    k.profile('Curved stock', [(-.06, .045), (-.13, .02), (-.38, -.02), (-.375, -.13),
                               (-.19, -.065), (-.08, -.04), (-.05, -.005)], .046, 'leather', .004)
    k.profile('Stock butt plate', [(-.38, -.02), (-.365, -.018), (-.36, -.125), (-.375, -.13)], .05, 'steel', .002)
    k.profile('Receiver', [(-.07, 0), (.13, 0), (.13, .08), (-.02, .08), (-.07, .05)], .06, 'steel', .003)

    # 大きなレバーの輪。金具の継ぎ目と支点も見せる。
    loop = [(-.055, -.03), (.07, -.03), (.093, -.11), (.075, -.136), (-.045, -.136), (-.075, -.095)]
    for (y1, z1), (y2, z2) in zip(loop, loop[1:] + loop[:1]):
        k.rod('Oversized lever', (0, y1, z1), (0, y2, z2), .006, 'brass', 10)
    k.guard(.045, -.004, .052, .047, 'black')
    for s in [-1, 1]:
        k.rod('Lever hinge', (s * .03, .072, .013), (s * .033, .072, .013), .011, 'brass', 16)
        k.rod('Hinge screw', (s * .033, .072, .013), (s * .034, .072, .013), .004, 'black', 10)

    # 単銃身と七本の厚い真鍮帯。最後の3%は軸対称。
    k.rod('Single barrel', (0, .13, BORE), (0, .66, BORE), .028, 'steel', 24)
    for i in range(7):
        k.ring('Wide brass barrel band', .19 + i * .06, BORE, .038, .027, 'brass', .024, n=20)
        # 各帯を留める金具と芯の小ねじ。7本の帯自体は一続きの輪として保つ。
        y = .19 + i * .06
        for side in [-1, 1]:
            k.box('Band clasp', (side * .038, y, BORE), (.004, .016, .017), 'black', .001)
            k.rod('Band clasp screw', (side * .040, y, BORE), (side * .042, y, BORE), .0032, 'brass', 8)
    # 帯の間の冷却スリットと上部レールが、滑らかな銃身に機械的な層を作る。
    for i in range(6):
        y = .22 + i * .06
        for side in [-1, 1]:
            k.box('Barrel recessed panel', (side * .028, y, BORE), (.003, .022, .016), 'black', .001)
            k.box('Barrel vent highlight', (side * .030, y, BORE), (.002, .013, .004), 'polymer', .0005)
        k.box('Upper barrel bridge', (0, y, .081), (.018, .024, .007), 'polymer', .001)
        k.box('Bridge central seam', (0, y, .085), (.006, .014, .002), 'steel', .0005)
    k.ring('Muzzle lip', .654, BORE, .032, .021, 'black', .012, n=24)
    k.rod('Muzzle recess', (0, .659, BORE), (0, .66, BORE), .020, 'black', 24)
    k.rod('Underbarrel magazine', (0, .14, -.002), (0, .44, -.002), .023, 'black', 20)
    k.ring('Magazine collar', .43, -.002, .026, .022, 'brass', .018, n=20)
    k.profile('Large underslung spike', [(.435, -.016), (.445, -.095), (.615, -.006), (.445, .018)], .036, 'steel', .002)
    k.profile('Spike inset', [(.455, -.025), (.46, -.070), (.58, -.013)], .002, 'black', .001, x=.0185)
    k.profile('Spike inset', [(.455, -.025), (.46, -.070), (.58, -.013)], .002, 'black', .001, x=-.0185)
    for side in [-1, 1]:
        # 太い棘の内側に金属製の補強板と段差を重ね、単色の平板に見せない。
        k.profile('Spike brass inset', [(.466,-.030),(.471,-.056),(.553,-.021),(.540,-.021)],
                  .002,'brass',0,x=side*.020)
        k.profile('Spike raised central spine', [(.462,-.034),(.468,-.045),(.556,-.018),(.545,-.016)],
                  .002,'steel',0,x=side*.021)
        k.rod('Spike reinforcing edge', (side*.019,.46,-.064), (side*.019,.575,-.014), .002, 'brass', 8)
        for y,z in [(.45,-.024),(.46,-.078),(.51,-.043)]:
            k.rod('Spike retaining rivet', (side*.019,y,z), (side*.021,y,z), .003, 'brass', 8)

    # 引き金前は装填用の部品、左手位置には細めの支えを用意。
    k.profile('Fore support', [(.16, .003), (.38, .003), (.37, -.026), (.17, -.03)], .05, 'polymer', .003)
    for y in [.18, .22, .26, .30, .34]:
        k.box('Support rib', (0, y, -.029), (.052, .008, .005), 'steel', .001)
    k.profile('Loading gate', [(.02, .007), (.09, .007), (.09, .038), (.02, .038)], .002, 'brass', .001, x=.0305)
    for side in [-1, 1]:
        k.profile('Stock leather panel', [(-.34, -.035), (-.14, -.005), (-.15, -.025), (-.33, -.09)],
                  .002, 'polymer', .001, x=side * .0235)
        for y, z in [(-.33, -.05), (-.30, -.065), (-.16, -.015)]:
            k.rod('Stock rivets', (side*.024, y, z), (side*.026, y, z), .0035, 'brass', 10)
        # 銃床の革と接合金具に細い段差を入れ、握りの輪郭は変えない。
        k.profile('Stock inset rim', [(-.31,-.049),(-.17,-.019),(-.18,-.028),(-.30,-.066)],
                  .0015,'steel',0,x=side*.025)
        for y, z in [(-.28,-.051),(-.24,-.040),(-.20,-.030)]:
            k.box('Stock inlay seam', (side*.026,y,z), (.002,.008,.002), 'brass', 0)
        for y, z in [(-.06, .035), (.095, .06)]:
            k.rod('Receiver rivets', (side*.030, y, z), (side*.032, y, z), .0035, 'brass', 10)
        for i in range(5):
            y = -.10 - i * .014
            z = -.026 - i * .004
            k.rod('Leather wrap seam', (side * .023, y, z), (side * .023, y - .01, z - .02), .0015, 'brass', 6)
        for y in [.20, .25, .30, .35]:
            k.box('Fore-end fastener', (side * .0255, y, -.014), (.002, .006, .006), 'brass', .001)
        for y in [.05, .065, .08]:
            k.box('Receiver engraving', (side * .0305, y, .062), (.002, .007, .003), 'black', .0005)
        k.profile('Receiver side insert', [(-.005,.045),(.105,.045),(.112,.053),(.105,.075),(-.005,.075)],
                  .002,'polymer',.001,x=side*.0305)
        for y in [.015,.032,.049,.066,.083]:
            k.box('Receiver mechanical seam', (side*.032,y,.058), (.002,.007,.014), 'black', .0005)
        for y in [.005,.102]:
            k.rod('Receiver plate screw',(side*.032,y,.069),(side*.034,y,.069),.003,'brass',10)
        k.profile('Receiver lower housing', [(-.052,.010),(.006,.010),(.006,.030),(-.047,.030)],
                  .002,'polymer',0,x=side*.0305)
        for y in [-.042,-.021]:
            k.box('Receiver lower housing bolt', (side*.032,y,.020), (.002,.004,.004), 'brass', 0)
