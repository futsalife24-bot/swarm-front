"""SMG-3 ワスプ。厚い３機構と黄黒装甲を持つ短機関銃。"""
import math
BORE=.095
SPEC=dict(kind='smg',code='SMG-3',name='SMG-3 ワスプ',family='rifle',bore_z=BORE,
    inlay=(.080,-.04,.121),
    neon_profile=[[-.255,.13,.025],[-.18,.155,.06],[-.16,.16,.065],[-.08,.16,.065],
      [-.065,.17,.065],[-.055,.19,.017],[.08,.19,.017],[.105,.17,.06],
      [.205,.16,.06],[.23,.15,.055],[.25,.13,.04],[.29,.115,.025],
      [.36,.105,.008],[.44,.102,.003],[.44,.088,.003],[.36,.085,.008],
      [.29,.08,.025],[.245,.035,.032],[.23,-.02,.022],[.20,-.02,.022],
      [.16,.015,.03],[.13,.015,.03],[.15,-.125,.02],[.12,-.125,.02],
      [.105,-.17,.02],[.068,-.17,.02],[.03,-.01,.021],[-.025,-.145,.021],
      [-.076,-.131,.021],[-.09,.02,.025],[-.18,.025,.055],[-.255,.035,.025]])

def build(k):
    # Three large, dark, mechanical housings, each separated by nested collars.
    chambers=[(-.165,-.070,.058),(-.066,.064,.066),(.068,.205,.059)]
    for idx,(a,b,r) in enumerate(chambers):
        k.rod('Mechanical chamber', (0,a,BORE),(0,b,BORE),r,'gunmetal',24)
        k.rod('Raised center housing',(0,a+.016,BORE),(0,b-.015,BORE),r+.001,'polymer',24)
        for y in (a+.005,b-.005):
            k.ring('Layered steel collar',y,BORE,r+.006,r-.003,'steel',.010,n=20)
            k.ring('Collar recessed seam',y+.003,BORE,r+.007,r+.004,'black',.002,n=20)
        for y in (a+.022,b-.022):
            k.ring('Wide yellow mechanical strap',y,BORE,r+.004,r+.001,'hazard',.012,n=20)
        # Each housing has separate rails, clamps, recesses and circular fasteners.
        for side in (-1,1):
            sx=side*(r+.003)
            k.profile('Layered armor frame',[(a+.016,.067),(b-.016,.067),(b-.011,.075),
                      (b-.011,.122),(b-.025,.134),(a+.020,.134),(a+.012,.124),(a+.012,.075)],
                      .003,'steel',.0007,x=sx)
            k.profile('Recessed dark face',[(a+.021,.075),(b-.020,.075),(b-.016,.080),
                      (b-.016,.117),(b-.029,.128),(a+.025,.128),(a+.019,.120)],
                      .002,'black',0,x=side*(r+.0055))
            # The large yellow plates frame but do not obscure the central face.
            for z0,z1 in ((.072,.084),(.119,.130)):
                k.profile('Yellow armored rim',[(a+.018,z0),(b-.024,z0),(b-.016,z1),
                          (a+.023,z1)],.002,'hazard',0,x=side*(r+.007))
            # Four visible edge bolts each side, plus a service hatch and fastener.
            for y,z in ((a+.027,.081),(b-.029,.081),(a+.027,.121),(b-.029,.121)):
                k.rod('Service rim fastener',(side*(r+.008),y,z),
                      (side*(r+.010),y,z),.0025,'steel',6)
            if idx != 1:
                mid=(a+b)/2
                k.rod('Round service port',(side*(r+.007),mid,.103),
                      (side*(r+.010),mid,.103),.011,'gunmetal',12)
                k.rod('Port center pin',(side*(r+.010),mid,.103),
                      (side*(r+.012),mid,.103),.004,'steel',8)
                k.box('Lower panel recess',(side*(r+.008),mid,.088),(.003,.018,.006),'gunmetal',0)
        # Dark vents and upper rail read as real recesses and housings.
        for y in (a+.033,b-.033):
            k.box('Top service block',(0,y,BORE+r+.003),(.034,.014,.006),'steel',.001)
            k.box('Top inset',(0,y,BORE+r+.007),(.025,.008,.002),'black',0)
    # Short needle stays axisymmetric in the muzzle calculation region.
    k.rod('Needle adapter',(0,.205,BORE),(0,.235,BORE),.040,'steel',20,r2=.027)
    k.ring('Front containment ring',.226,BORE,.043,.036,'hazard',.008,n=20)
    k.rod('Three stage needle',(0,.235,BORE),(0,.330,BORE),.018,'gunmetal',16,r2=.011)
    k.rod('Fine symmetric tip',(0,.330,BORE),(0,.44,BORE),.011,'steel',16,r2=.002)
    k.rod('Dark needle point',(0,.435,BORE),(0,.44,BORE),.002,'black',12)
    # The original pose coordinates: pistol grip, a pair of slanted magazines,
    # and a slim forward support in the left-hand region.
    k.profile('Pistol grip',[(-.035,.028),(.02,.028),(.019,-.039),(-.025,-.145),(-.076,-.131)],.042,'polymer',.003)
    k.guard(.047,-.005,.053,.047,'steel')
    k.profile('Primary magazine',[(.032,-.003),(.068,-.003),(.105,-.17),(.068,-.17)],.038,'steel',.003)
    k.profile('Secondary magazine',[(.088,-.003),(.112,-.003),(.146,-.125),(.122,-.125)],.034,'hazard',.003)
    k.profile('Magazine carrier',[(.025,.014),(.12,.014),(.126,-.014),(.035,-.014)],.048,'black',.002)
    k.profile('Slim forward support',[(.18,.02),(.305,.02),(.295,-.015),(.19,-.018)],.040,'polymer',.002)
    k.box('Forward support coupling',(0,.195,.029),(.032,.018,.033),'gunmetal',.001)
    for side in (-1,1):
        k.profile('Primary magazine inset',[(.041,-.022),(.06,-.022),(.088,-.142),(.074,-.142)],.002,'black',0,x=side*.0195)
        k.profile('Secondary dark inset',[(.097,-.026),(.108,-.026),(.13,-.105),(.123,-.105)],.002,'black',0,x=side*.0176)
        for y,z in ((.052,-.04),(.063,-.08),(.074,-.12)):
            k.rod('Magazine rivet',(side*.020,y,z),(side*.022,y,z),.0023,'hazard',6)
        for i in range(4):
            y=-.047-i*.007;z=-.06-i*.017
            k.rod('Grip rib',(side*.021,y,z),(side*.021,y+.027,z),.0016,'steel',6)
        for y in (.205,.24,.275):
            k.rod('Forward support screw',(side*.020,y,0),(side*.022,y,0),.0024,'steel',6)
    # Compact frame behind the first chamber gives a shoulder brace but does not
    # recreate the old long rectangular receiver or sacrifice the thick chambers.
    for side in (-1,1):
        x=side*.018
        points=[(x,-.162,.14),(x,-.245,.14),(x,-.255,.13),(x,-.255,.045),(x,-.165,.045)]
        for a,b in zip(points,points[1:]):k.rod('Brace beam',a,b,.004,'steel',8)
    k.box('Brace butt',(0,-.253,.088),(.042,.006,.09),'black',.002)
    # Carry handle is unmistakable in silhouette and has two metal mounting feet.
    for x in (-.012,.012):
        pts=[(x,-.062,.159),(x,-.045,.185),(x,.075,.185),(x,.10,.158)]
        for a,b in zip(pts,pts[1:]):k.rod('Handle structure',a,b,.004,'steel',8)
    k.box('Handle wrapped grip',(0,.014,.186),(.032,.088,.012),'black',.001)
    for y in (-.02,.005,.03,.055):k.box('Handle grip ring',(0,y,.192),(.033,.003,.002),'steel',0)
    # Heavy pipes arc across both flanks and terminate at bolted collars.
    for side in (-1,1):
        x=side*.052
        path=[(x,-.15,.145),(x,-.13,.160),(x,-.085,.165),(x,-.055,.160),
              (x,.035,.160),(x,.072,.153),(x,.13,.148),(x,.175,.138)]
        for a,b in zip(path,path[1:]):k.rod('Exposed side conduit',a,b,.0038,'steel',8)
        for y,z in ((-.13,.16),(-.055,.16),(.072,.153),(.175,.138)):
            k.rod('Pipe clamp',(x-side*.004,y,z),(x+side*.004,y,z),.005,'black',8)
        k.box('Identification bezel',(side*.078,-.04,.121),(.002,.020,.018),'black',.0005)
        for y in (-.13,-.11,.10,.12,.14,.16):
            k.box('Outer maintenance vent',(side*.060,y,.11),(.003,.009,.004),'steel',0)
