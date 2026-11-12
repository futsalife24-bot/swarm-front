"""GL-6 ホロウ: 六つの円形機構と短い大口径銃身を備える擲弾銃。"""
import math

BORE = .053
SPEC = dict(
    kind='grenade', code='GL-6', name='GL-6 ホロウ', family='grenade',
    bore_z=BORE, inlay=(.031, -.055, .045),
    neon_profile=[[-.27, .01, .025], [-.27, .09, .025], [-.07, .09, .025], [-.07, .07, .03],
                  [.005, .07, .03], [.005, .175, .085], [.22, .175, .085],
                  [.235, .15, .085], [.235, .088, .035],
                  [.30, .088, .035], [.30, .165, .01], [.315, .165, .01],
                  [.315, .088, .035], [.50, .088, .035], [.50, .018, .035],
                  [.37, .018, .03], [.35, -.10, .022], [.32, -.10, .022],
                  [.30, -.015, .03], [.24, -.055, .035], [.06, -.055, .035],
                  [.02, -.04, .021], [-.025, -.145, .021], [-.076, -.13, .021],
                  [-.09, -.02, .028], [-.19, -.035, .025]],
)

def build(k):
    # 肩の上を通る短い後部機構。下がった小銃風銃床は首・肩に重なるため設けない。
    k.profile('Shoulder receiver shell', [(-.27,.01),(-.27,.09),(-.10,.09),(-.065,.07),(-.075,.005),(-.19,-.035)], .05, 'olive', .003)
    k.box('Rear shock pad', (0,-.269,.05), (.052,.012,.075), 'polymer', .002)
    k.rod('Rear mechanism barrel', (0,-.26,.06), (0,-.095,.06), .027, 'steel', 20)
    for y in [-.235,-.190,-.145]:
        k.ring('Rear mechanism collar', y, .06, .030, .026, 'brass', .007, n=16)
    k.profile('Receiver', [(-.08, 0), (.08, 0), (.095, .07), (-.07, .07)], .06, 'olive', .003)
    k.profile('Grip', [(-.035, 0), (.02, 0), (.019, -.039), (-.025, -.145), (-.076, -.131)], .042, 'polymer', .003)
    k.guard(.046, -.005, .055, .048, 'steel')
    # Enlarged raised six-mechanism bank. Kept above the prescribed forward-hand clearance.
    k.profile('Deep olive apparatus',[(-.013,.040),(.005,.032),(.213,.032),(.232,.051),
              (.232,.156),(.212,.175),(.004,.175),(-.013,.158)],.084,'olive',.003)
    for side in [-1,1]:
        k.profile('Dark armored gasket',[(0,.038),(.214,.038),(.226,.051),(.226,.154),
                  (.21,.169),(.007,.169),(-.007,.155),(-.007,.052)],.002,'black',0,x=side*.043)
        k.profile('Raised olive armor face',[(.006,.043),(.208,.043),(.22,.054),(.22,.151),
                  (.205,.163),(.011,.163),(-.001,.151),(-.001,.055)],.003,'olive',.001,x=side*.0445)
        for y in [.027,.101,.175]:
            for z in [.066,.137]:
                k.rod('Mechanism outer steel flange',(side*.046,y,z),(side*.050,y,z),.033,'steel',12)
                k.rod('Mechanism thick brass housing',(side*.050,y,z),(side*.058,y,z),.030,'brass',12)
                k.rod('Mechanism dark recess',(side*.058,y,z),(side*.061,y,z),.025,'black',8)
                k.rod('Mechanism inner steel ring',(side*.061,y,z),(side*.068,y,z),.021,'steel',8)
                k.rod('Mechanism dark hub',(side*.068,y,z),(side*.071,y,z),.016,'polymer',8)
                k.rod('Mechanism brass central spindle',(side*.071,y,z),(side*.079,y,z),.010,'brass',8)
                k.box('Mechanism spindle key',(side*.080,y,z),(.002,.010,.003),'black',0)
        # Wide outer rails and corner fixings bind the apparatus into one housing.
        for z in [.036,.171]:
            k.rod('External armor rail',(side*.047,.011,z),(side*.047,.210,z),.003,'brass',8)
        for y in [.008,.213]:
            k.rod('External vertical rail',(side*.047,y,.048),(side*.047,y,.158),.003,'brass',8)
        for y,z in [(.008,.049),(.213,.049),(.008,.157),(.213,.157)]:
            k.rod('Armor corner lock',(side*.047,y,z),(side*.051,y,z),.004,'steel',8)
        # External brass pipe and saddles connect the box to the rear receiver.
        pipe=[(side*.049,-.05,.084),(side*.049,-.018,.084),(side*.049,-.008,.096),
              (side*.049,-.008,.153),(side*.049,.006,.174),(side*.049,.21,.174)]
        for start,end in zip(pipe,pipe[1:]):
            k.rod('Apparatus external conduit',start,end,.0035,'brass',8)
        for y,z in [(-.032,.084),(-.008,.11),(.02,.174),(.19,.174)]:
            k.box('Conduit clamp',(side*.049,y,z),(.009,.008,.008),'steel',0)

    # 分割された装甲、締結具、摺動部。表面に凹凸を設け、磨耗跡を控えめに入れる。
    k.profile('Receiver upper rail', [(-.06,.075),(.07,.075),(.06,.083),(-.055,.083)], .025, 'steel', .001)
    for side in [-1, 1]:
        k.profile('Shoulder shell side inset', [(-.252,.016),(-.252,.046),(-.105,.046),(-.105,.009),(-.19,-.018)],
                  .002, 'polymer', .001, x=side * .0255)
        for y, z in [(-.24,.026),(-.205,.008),(-.14,.016),(-.06,.055),(.035,.055)]:
            k.rod('Fastener', (side * .030, y, z), (side * .032, y, z), .0045, 'brass', 10)
        for y in [-.23,-.19,-.15]:
            k.rod('Shell seam', (side*.027,y,.025), (side*.027,y+.022,.025), .0015,'steel',6)
        for i in range(4):
            y = -.047 - i * .007
            z = -.06 - i * .017
            k.rod('Grip texture', (side * .021, y, z), (side * .021, y + .027, z), .002, 'steel', 6)
        for y in [-.235, -.215, -.195, -.175]:
            k.box('Shoulder plate cooling cut', (side*.027,y,.006), (.003,.007,.014), 'steel', .0005)
        k.profile('Shoulder service plate', [(-.252,.052),(-.12,.052),(-.12,.062),(-.252,.062)],
                  .002,'black',0,x=side*.026)
        for y in [-.24,-.22,-.20,-.18,-.16,-.14]:
            k.box('Shoulder service plate screw', (side*.028,y,.057), (.002,.003,.003), 'brass', 0)
        for y in [-.045,-.015,.015,.045]:
            k.box('Rail tooth', (side*.014,y,.085), (.006,.008,.004), 'black', .0005)
        k.box('Receiver side panel', (side * .0305, -.025, .031), (.002, .07, .026), 'steel', .001)
        for y in [-.047, -.035, -.023, -.011]:
            k.box('Receiver vent', (side * .032, y, .031), (.002, .006, .015), 'black', .0005)

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
        for y in [.28,.36,.44]:
            k.profile('Barrel side armor', [(y-.014,.029),(y+.014,.029),(y+.010,.041),(y-.010,.041)],
                      .002,'steel',0,x=side*.035)
        for y, z in [(.265, -.004), (.292, -.004), (.34, -.005)]:
            k.rod('Fore-end screw', (side * .026, y, z), (side * .027, y, z), .0035, 'brass', 8)
    k.profile('Front support', [(.245, .016), (.37, .016), (.35, -.032), (.26, -.035)], .052, 'polymer', .003)
    k.profile('Fore grip', [(.31, .0), (.36, .0), (.35, -.10), (.32, -.10)], .038, 'olive', .003)
    k.box('Sight upright', (0, .307, .124), (.016, .014, .082), 'steel', .002)
    k.box('Sight crossbar', (0, .307, .16), (.034, .014, .01), 'brass', .001)
    # Side-facing pressure dial and index, attached to the existing upright.
    k.rod('Pressure gauge rim',(-.012,.307,.142),(.012,.307,.142),.014,'brass',12)
    for side in [-1,1]:
        k.rod('Pressure gauge face',(side*.012,.307,.142),(side*.014,.307,.142),.010,'black',10)
        k.rod('Pressure gauge pointer',(side*.014,.304,.139),(side*.014,.310,.147),.001,'steel',6)
    for z in [.11, .127, .144]:
        k.box('Sight notch', (.009, .307, z), (.003, .016, .003), 'black', 0)
