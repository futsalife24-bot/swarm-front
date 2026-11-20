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
    # Three distinct mechanisms replace the repeated panels.  The bounds,
    # stock, muzzle axis, handles, support and identification insert are kept.
    import bpy
    def segment(name, a, b, inner, outer, center, span, mat):
        # A true curved shell with end caps and open gaps between its neighbours.
        angles = [center-span/2 + span*i/3 for i in range(4)]
        vertices = []
        for y,r in ((a,inner),(a,outer),(b,inner),(b,outer)):
            vertices += [(r*math.cos(t),y,BORE+r*math.sin(t)) for t in angles]
        faces=[]
        for i in range(3):
            j=i+1
            faces.extend([(i,j,4+j,4+i),(8+i,12+i,12+j,8+j),
                          (i,8+i,8+j,j),(4+i,4+j,12+j,12+i)])
        faces.extend([(0,4,12,8),(3,11,15,7)])
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata(vertices,[],faces); mesh.update()
        ob=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(ob)
        k._finish(ob,name,mat,.0008)

    # Front: small core visible through the gaps of six separated yellow plates.
    k.rod('Front mechanical core',(0,.070,BORE),(0,.203,BORE),.047,'polymer',20)
    for y in (.080,.192):
        k.ring('Front dark structural collar',y,BORE,.056,.045,'gunmetal',.012,n=20)
    for i in range(6):
        theta=2*math.pi*i/6
        segment('Separated front armor',.087,.185,.051,.061,theta,.68,'hazard')
        for y in (.094,.178):
            r=.062
            k.rod('Front armor stud',(r*math.cos(theta),y,BORE+r*math.sin(theta)),
                  ((r+.002)*math.cos(theta),y,BORE+(r+.002)*math.sin(theta)),.002,'steel',6)
    # Visible stepped front edge and short longitudinal clamp rails.
    k.ring('Front mechanical bulkhead',.204,BORE,.061,.042,'steel',.012,n=20)
    for side in (-1,1):
        for z in (.073,.117):
            k.rod('Front clamp rail',(side*.050,.077,z),(side*.050,.195,z),.0025,'steel',6)

    # Central chamber: broad dark connector and narrow recessed segment seams.
    k.rod('Central mechanical chamber',(0,-.066,BORE),(0,.064,BORE),.066,'gunmetal',20)
    k.rod('Central inset hub',(0,-.050,BORE),(0,.049,BORE),.067,'polymer',20)
    for y in (-.061,.058):
        k.ring('Central bulkhead',y,BORE,.072,.063,'steel',.010,n=20)
    for y in (-.037,.035):
        k.ring('Central dark seam',y,BORE,.070,.066,'black',.005,n=20)
    for side in (-1,1):
        for z0,z1 in ((.071,.082),(.120,.131)):
            k.profile('Central segmented yellow rail',[(-.044,z0),(.041,z0),(.036,z1),(-.039,z1)],.003,'hazard',.0005,x=side*.071)
        k.profile('Central angled maintenance face',[(-.034,.083),(.030,.083),(.038,.095),(.030,.113),(-.034,.113),(-.041,.102)],.003,'black',.0005,x=side*.071)
        for y in (-.028,.026):
            k.rod('Central port screw',(side*.073,y,.098),(side*.075,y,.098),.0024,'steel',6)

    # Rear: a smaller service cylinder, two short asymmetrical covers and ports.
    k.rod('Rear mechanical core',(0,-.165,BORE),(0,-.070,BORE),.054,'gunmetal',20)
    for y in (-.160,-.075):
        k.ring('Rear connector collar',y,BORE,.062,.052,'steel',.009,n=20)
    for side in (-1,1):
        k.profile('Rear yellow access cover',[(-.149,.071),(-.103,.071),(-.095,.080),(-.102,.116),(-.145,.123),(-.153,.115)],.006,'hazard',.001,x=side*.057)
        k.profile('Rear angled dark inspection well',[(-.141,.080),(-.110,.080),(-.106,.089),(-.110,.107),(-.139,.112),(-.145,.106)],.002,'black',0,x=side*.0605)
        k.rod('Rear service port',(side*.061,-.127,.098),(side*.064,-.127,.098),.010,'gunmetal',12)
        k.rod('Rear service cap',(side*.064,-.127,.098),(side*.066,-.127,.098),.004,'steel',8)
        for y,z in ((-.144,.078),(-.105,.078),(-.144,.114),(-.105,.114)):
            k.rod('Rear cover screw',(side*.061,y,z),(side*.063,y,z),.002,'steel',6)
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
