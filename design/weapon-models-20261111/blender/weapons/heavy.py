"""RL-9 メテオ。大径耐熱ドラムと九本の補強リブを備える重ロケット。"""
import math

BORE = .09
SPEC = dict(
    kind='heavy', code='RL-9', name='RL-9 メテオ', family='rocket',
    bore_z=BORE, inlay=(.059, -.09, .09),
    neon_profile=[[-.37,.165,.062],[-.30,.15,.05],[-.10,.15,.05],
                  [-.08,.192,.014],[.12,.192,.014],[.14,.15,.05],
                  [.39,.15,.05],[.41,.18,.075],[.56,.18,.095],[.62,.16,.07],
                  [.62,.02,.07],[.56,0,.095],[.41,0,.075],[.39,.025,.04],
                  [.26,.025,.035],[.24,-.10,.02],[.21,-.10,.02],[.19,.025,.04],
                  [.04,.025,.04],[.02,-.12,.022],[-.035,-.123,.022],
                  [-.06,.025,.04],[-.30,.025,.05],[-.37,.015,.062]],
)

def build(k):
    # 後部は厚い外套と独立した噴射口。銃口より短くする。
    k.rod('Armored launch tube', (0,-.30,BORE), (0,.40,BORE), .055, 'gunmetal', 24)
    k.rod('Exhaust housing', (0,-.37,BORE), (0,-.295,BORE), .067, 'steel', 24, r2=.053)
    k.ring('Exhaust rim', -.365, BORE, .069, .052, 'rust', .01, n=24)
    k.rod('Exhaust dark recess', (0,-.371,BORE), (0,-.369,BORE), .050, 'black', 24)
    k.ring('Exhaust inner glow', -.372, BORE, .035, .025, 'glow_heat', .002, n=20)
    for y in [-.265,-.15,.04,.18,.32]:
        k.ring('Tube clamp', y, BORE, .059, .054, 'steel', .014, n=24)
    # 正面ドラムは y=.40 より前。先端帯は左右・上下対称に保つ。
    k.rod('Heat drum', (0,.405,BORE), (0,.56,BORE), .092, 'gunmetal', 32)
    k.rod('Tapered muzzle', (0,.56,BORE), (0,.61,BORE), .092, 'rust', 32, r2=.070)
    k.ring('Muzzle armor', .612, BORE, .073, .053, 'steel', .016, n=32)
    k.ring('Muzzle liner', .619, BORE, .053, .038, 'black', .002, n=32)
    k.rod('Muzzle dark recess', (0,.619,BORE), (0,.620,BORE), .037, 'black', 32)
    for i in range(9):
        a = 2 * math.pi * i / 9
        x, z = .093 * math.cos(a), BORE + .093 * math.sin(a)
        k.rod('Heat drum longitudinal rib', (x,.416,z), (x,.552,z), .006, 'rust', 8)
        for y in [.432,.532]:
            k.rod('Rib rivet', (x*.995,y,BORE+(z-BORE)*.995),
                  (x*1.045,y,BORE+(z-BORE)*1.045), .003, 'steel', 8)
    for y in [.412,.555]:
        k.ring('Drum retaining collar', y, BORE, .096, .091, 'steel', .012, n=32)
    # 銃床の下部と両握りは既存の担ぎ動作用の座標に置く。
    k.profile('Pistol grip', [(-.035,.02),(.025,.02),(.02,-.045),(-.028,-.125),(-.075,-.108)], .042, 'black', .003)
    k.guard(.043,.01,.055,.05,'steel')
    k.profile('Front hand support', [(.19,.02),(.28,.02),(.26,-.025),(.24,-.10),(.21,-.10),(.20,-.025)], .038, 'black', .003)
    for side in [-1,1]:
        for i in range(4):
            k.rod('Grip rib', (side*.021,-.059+i*.007,-.085+i*.014),
                  (side*.021,-.028+i*.007,-.085+i*.014), .002, 'steel', 6)
        k.profile('Receiver armor panel', [(-.20,.063),(-.18,.04),(.14,.04),(.17,.065),(.17,.11),(-.20,.11)], .004, 'steel', .002, x=side*.052)
        for y in [-.18,-.12,-.03,.05,.13]:
            k.rod('Armor bolt', (side*.055,y,.075), (side*.057,y,.075), .004, 'rust', 8)
        for y in [.045,.075,.105]:
            k.box('Armor vent', (side*.056,y,.095), (.003,.014,.009), 'black', .001)
        # 複数の装甲区画と燃料配管を重ね、大きな筒の単調さを抑える。
        for y in [-.26, -.01, .24]:
            k.profile('Thermal shield', [(y,.075),(y+.035,.055),(y+.10,.055),
                      (y+.12,.073),(y+.12,.12),(y+.10,.135),(y+.025,.135),(y,.118)],
                      .005,'gunmetal',.002,x=side*.057)
            for yy in [y+.025,y+.095]:
                for zz in [.068,.12]:
                    k.rod('Shield locking bolt', (side*.059,yy,zz),(side*.063,yy,zz),.0035,'rust',8)
            for yy in [y+.045,y+.058,y+.071]:
                k.box('Shield louvre', (side*.061,yy,.095),(.003,.006,.028),'black',.001)
        for a,b in [((side*.045,-.28,.135),(side*.060,-.22,.148)),
                    ((side*.060,-.22,.148),(side*.060,.27,.148)),
                    ((side*.060,.27,.148),(side*.055,.37,.13))]:
            k.rod('Coolant pipe', a,b,.004,'rust',8)
        for y in [-.17,.08,.23]:
            k.rod('Pipe clamp', (side*.055,y,.148),(side*.064,y,.148),.007,'steel',8)
    # 運搬ハンドルは両側が抜けた構造。
    for a,b in [((0,-.10,.14),(0,-.08,.185)),((0,-.08,.185),(0,.12,.185)),((0,.12,.185),(0,.14,.14))]:
        k.rod('Carry handle', a,b,.006,'steel',10)
    k.box('Handle grip', (0,.02,.185), (.022,.09,.016), 'black', .003)
