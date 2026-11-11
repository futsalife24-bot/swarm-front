"""GL-6 ホロウ: 六連回転弾倉と短い大口径銃身を備える擲弾銃。"""
import math

BORE = .053
SPEC = dict(
    kind='grenade', code='GL-6', name='GL-6 ホロウ', family='grenade',
    bore_z=BORE, inlay=(.031, -.055, .045),
    neon_profile=[[-.36, .0, .025], [-.07, .05, .025], [-.07, .07, .03],
                  [.075, .07, .03], [.10, .095, .035], [.15, .108, .035],
                  [.20, .095, .035], [.228, .07, .035], [.23, .088, .035],
                  [.30, .088, .035], [.30, .165, .01], [.315, .165, .01],
                  [.315, .088, .035], [.50, .088, .035], [.50, .018, .035],
                  [.37, .018, .03], [.35, -.10, .022], [.32, -.10, .022],
                  [.30, -.015, .03], [.24, -.055, .035], [.06, -.055, .035],
                  [.02, -.04, .021], [-.025, -.145, .021], [-.076, -.13, .021],
                  [-.09, -.02, .028], [-.30, -.12, .025], [-.355, -.12, .025]],
)

def build(k):
    # 肩当てと機関部。回転弾倉は6つの薬室を外から見せる。
    k.profile('Stock', [(-.07, .05), (-.36, 0), (-.355, -.12), (-.30, -.12), (-.09, -.02)], .05, 'olive', .003)
    k.box('Stock pad', (0, -.351, -.06), (.052, .018, .12), 'polymer', .003)
    k.profile('Receiver', [(-.08, 0), (.08, 0), (.095, .07), (-.07, .07)], .06, 'olive', .003)
    k.profile('Grip', [(-.035, 0), (.02, 0), (.019, -.039), (-.025, -.145), (-.076, -.131)], .042, 'polymer', .003)
    k.guard(.046, -.005, .055, .048, 'steel')
    k.rod('Cylinder axle', (-.034, .15, .03), (.034, .15, .03), .078, 'steel', 24)
    for i in range(6):
        angle = 2 * math.pi * i / 6
        y = .15 + .053 * math.cos(angle)
        z = .03 + .053 * math.sin(angle)
        k.rod('Cartridge chamber', (-.037, y, z), (.037, y, z), .021, 'brass', 16)
        for side in [-1, 1]:
            k.rod('Chamber cap', (side * .037, y, z), (side * .039, y, z), .013, 'black', 12)
    k.rod('Cylinder central pin', (-.04, .15, .03), (.04, .15, .03), .012, 'polymer', 12)

    # 分割された装甲、締結具、摺動部。表面に凹凸を設け、磨耗跡を控えめに入れる。
    for side in [-1, 1]:
        k.profile('Stock side inset', [(-.33, -.018), (-.115, .018), (-.13, -.012), (-.30, -.084), (-.33, -.084)],
                  .002, 'polymer', .001, x=side * .0255)
        for y, z in [(-.32, -.034), (-.30, -.067), (-.15, -.008), (-.06, .055), (.035, .055)]:
            k.rod('Fastener', (side * .030, y, z), (side * .032, y, z), .0045, 'brass', 10)
        for y in [-.29, -.25, -.21]:
            k.rod('Stock seam', (side * .027, y, -.052), (side * .027, y + .025, -.045), .0015, 'steel', 6)
        for i in range(4):
            y = -.047 - i * .007
            z = -.06 - i * .017
            k.rod('Grip texture', (side * .021, y, z), (side * .021, y + .027, z), .002, 'steel', 6)
        k.box('Receiver side panel', (side * .0305, -.025, .031), (.002, .07, .026), 'steel', .001)
        for y in [-.047, -.035, -.023, -.011]:
            k.box('Receiver vent', (side * .032, y, .031), (.002, .006, .015), 'black', .0005)
        k.rod('Cylinder pivot', (side * .04, .15, .03), (side * .042, .15, .03), .008, 'brass', 12)

    # 先端は銃身軸に対称。照尺や前握りは銃口から離す。
    k.rod('Short barrel', (0, .23, BORE), (0, .48, BORE), .035, 'olive', 24)
    k.ring('Muzzle collar', .49, BORE, .043, .029, 'steel', .02, n=24)
    k.ring('Muzzle bore', .499, BORE, .029, .022, 'black', .002, n=24)
    k.rod('Muzzle recess', (0, .499, BORE), (0, .5, BORE), .021, 'black', 24)
    for y in [.27, .39, .455]:
        k.ring('Barrel reinforcement band', y, BORE, .037, .033, 'steel', .009, n=24)
    for side in [-1, 1]:
        for y in [.295, .325, .355, .385, .415]:
            k.box('Barrel cooling slot', (side * .0345, y, .065), (.002, .015, .006), 'black', .001)
        for y, z in [(.265, -.004), (.292, -.004), (.34, -.005)]:
            k.rod('Fore-end screw', (side * .026, y, z), (side * .027, y, z), .0035, 'brass', 8)
    k.profile('Front support', [(.245, .016), (.37, .016), (.35, -.032), (.26, -.035)], .052, 'polymer', .003)
    k.profile('Fore grip', [(.31, .0), (.36, .0), (.35, -.10), (.32, -.10)], .038, 'olive', .003)
    k.box('Sight upright', (0, .307, .124), (.016, .014, .082), 'steel', .002)
    k.box('Sight crossbar', (0, .307, .16), (.034, .014, .01), 'brass', .001)
    for z in [.11, .127, .144]:
        k.box('Sight notch', (.009, .307, z), (.003, .016, .003), 'black', 0)
