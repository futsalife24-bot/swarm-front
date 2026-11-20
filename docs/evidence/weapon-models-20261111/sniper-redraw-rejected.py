"""SR-1 ソーン。骨色の細身と有機的な棘を持つ長距離ライフル。"""
import math
BORE = .046
SPEC = dict(
    kind='sniper', code='SR-1', name='SR-1 ソーン', family='sniper',
    bore_z=BORE, inlay=(.036, -.05, .05),
    neon_profile=[[-.39,.05,.024],[-.12,.065,.027],[-.09,.095,.027],
                  [-.055,.177,.038],[.20,.177,.038],[.215,.209,.071],
                  [.338,.209,.071],[.338,.067,.071],[.61,.056,.014],
                  [.70,.056,.012],[.70,.036,.012],[.667,.036,.014],
                  [.65,.008,.014],[.61,.036,.014],[.25,.026,.025],[.22,-.015,.025],
                  [.12,-.015,.025],[.11,-.075,.025],[.05,-.075,.025],[.03,-.01,.027],
                  [.02,-.04,.022],[-.025,-.145,.022],[-.075,-.13,.022],
                  [-.1,-.02,.027],[-.33,-.10,.024],[-.39,-.10,.024]],
)

def build(k):
    # Stock: load-bearing open triangular frame, rear pad and cheek plate.
    for a,b in [((0,-.10,.048),(0,-.37,.045)),((0,-.37,.045),(0,-.37,-.09)),
                ((0,-.37,-.09),(0,-.08,.005)),((0,-.32,-.075),(0,-.22,.042))]:
        k.rod('Stock structural beam',a,b,.012,'bone',10)
    k.box('Stock butt pad',(0,-.382,-.022),(.048,.018,.15),'polymer',.003)
    k.profile('Stock cheek plate',[(-.30,.058),(-.15,.058),(-.14,.081),(-.31,.081)],.042,'leather',.002)
    for y,z in [(-.365,.038),(-.365,-.082),(-.225,.038),(-.105,.038),(-.105,.004)]:
        k.rod('Stock joint pin',(-.015,y,z),(.015,y,z),.008,'steel',10)
        for side in (-1,1):
            k.rod('Stock pin cap',(side*.015,y,z),(side*.018,y,z),.004,'leather',8)

    # Receiver is built as a dark internal chassis between two white shells.
    k.profile('Receiver structural core',[(-.095,.004),(.205,.004),(.224,.024),
              (.210,.070),(.19,.078),(-.085,.078)],.050,'polymer',.002)
    k.profile('Pistol grip',[(-.035,0),(.02,0),(.019,-.04),(-.025,-.145),(-.075,-.13)],.042,'polymer',.003)
    k.guard(.045,-.004,.058,.05,'steel')
    k.profile('Removable magazine',[(.05,0),(.11,0),(.105,-.07),(.055,-.07)],.046,'polymer',.003)
    k.box('Magazine metal floor',(0,.08,-.069),(.05,.064,.008),'steel',.001)
    # Two real, independently separated panels on both sides of the chassis.
    for side in (-1,1):
        x=side*.027
        k.profile('Rear ivory receiver shell',[(-.094,.006),(-.012,.006),(.008,.020),(.008,.067),
                  (-.012,.078),(-.084,.078)],.006,'bone',.0015,x=x)
        k.profile('Forward ivory receiver shell',[(.020,.008),(.196,.008),(.213,.025),
                  (.200,.068),(.184,.078),(.020,.078)],.006,'bone',.0015,x=x)
        # Window is inset into a rim and positioned behind the outboard fasteners.
        k.profile('Rear instrument bezel',[(-.079,.019),(-.018,.019),(-.008,.030),
                  (-.008,.059),(-.019,.067),(-.079,.067)],.002,'steel',.001,x=side*.031)
        k.profile('Rear recessed instrument',[(-.073,.024),(-.023,.024),(-.014,.032),
                  (-.014,.055),(-.023,.062),(-.073,.062)],.002,'polymer',0,x=side*.032)
        # Broad red structural bulkhead rather than narrow decorative stripes.
        k.profile('Central red clamp',[(.011,.005),(.034,.005),(.038,.016),(.038,.071),
                  (.034,.081),(.011,.081),(.006,.071),(.006,.015)],.008,'leather',.001,x=side*.033)
        for y,z in ((.021,.018),(.021,.067)):
            k.rod('Central clamp bolt',(side*.037,y,z),(side*.040,y,z),.0035,'steel',8)
        # Separate ceramic forward plates have visible seams and metal fasteners.
        for y0,y1 in ((.048,.095),(.105,.150),(.160,.196)):
            k.profile('Ivory access block',[(y0,.014),(y1,.014),(y1+.004,.024),
                       (y1,.068),(y0,.068),(y0-.004,.055)],.004,'bone',.001,x=side*.031)
            for z in (.023,.059):
                k.rod('Access block pin',(side*.034,y0+.009,z),(side*.036,y0+.009,z),.0025,'steel',6)
        for y in (.093,.150):
            k.profile('Forward red saddle',[(y,.014),(y+.010,.014),(y+.010,.067),(y,.067)],
                      .004,'leather',.0005,x=side*.034)
        for i in range(4):
            k.rod('Grip cross rib',(side*.021,-.054+i*.007,-.09+i*.015),
                  (side*.021,-.027+i*.007,-.09+i*.015),.0018,'steel',6)
        k.profile('Magazine side armor',[(.056,-.006),(.104,-.006),(.100,-.058),(.060,-.058)],
                  .002,'steel',.001,x=side*.0235)

    # Precision barrel and the existing symmetric muzzle and underbarrel thorn.
    k.rod('Precision barrel',(0,.20,BORE),(0,.68,BORE),.012,'steel',20)
    k.ring('Muzzle brake',.69,BORE,.014,.009,'steel',.02,n=20)
    k.rod('Muzzle aperture',(0,.699,BORE),(0,.70,BORE),.008,'polymer',20)
    k.profile('Lower thorn',[(.60,.036),(.65,.008),(.665,.036)],.018,'leather',.001)
    k.profile('Underbarrel support',[(.18,.025),(.38,.025),(.36,-.014),(.20,-.017)],.042,'polymer',.003)
    k.profile('Forearm lower spine',[(.19,.027),(.46,.027),(.42,.001),(.21,.001)],.032,'steel',.002)
    # Three raised white shell segments around the forward support.
    for side in (-1,1):
        for a,b in ((.215,.274),(.285,.344),(.355,.414)):
            k.profile('Forward white armor',[(a,.032),(b,.032),(b+.012,.047),
                       (b,.081),(a,.081),(a-.005,.060)],.011,'bone',.0015,x=side*.023)
            k.profile('Forward red retainer',[(a+.010,.036),(a+.021,.036),(a+.021,.075),(a+.010,.075)],
                       .003,'leather',.0005,x=side*.029)
            for z in (.041,.069):
                k.rod('Forward retainer bolt',(side*.030,a+.0155,z),(side*.032,a+.0155,z),.0025,'steel',6)
        # Running pipe behind clamps, connected at each end to the receiver.
        path=[(side*.024,.10,.003),(side*.029,.14,-.015),(side*.029,.34,-.015),(side*.024,.38,.004)]
        for a,b in zip(path,path[1:]):k.rod('Brass service pipe',a,b,.005,'brass',8)
        for y in (.17,.255,.33):
            k.rod('Pipe anchor',(side*.020,y,-.015),(side*.034,y,-.015),.006,'steel',8)
    for y in (.45,.51,.57):k.ring('Barrel red collar',y,BORE,.015,.011,'leather',.006,n=16)

    # Two steel optic towers and brass saddle bolts physically mount the scope.
    for y in (.015,.17):
        k.box('Optic bridge',(0,y,.090),(.051,.035,.018),'steel',.002)
        for side in (-1,1):
            k.profile('Scope mounting tower',[(y-.014,.090),(y+.014,.090),(y+.010,.122),(y-.010,.122)],
                       .011,'steel',.001,x=side*.018)
            k.rod('Scope foot bolt',(side*.026,y,.093),(side*.029,y,.093),.003,'brass',8)
    # Rear focus tube, narrow seals, red locking rings and a larger conical hood.
    k.rod('Rear scope eyepiece',(0,-.063,.138),(0,-.035,.138),.037,'steel',20)
    k.rod('Rear optic tube',(0,-.035,.138),(0,.203,.138),.035,'bone',24)
    for y in (-.026,.160):k.ring('Optic red locking ring',y,.138,.040,.034,'leather',.012,n=16)
    for y in (-.019,.167):k.ring('Optic steel lock rim',y,.138,.041,.038,'steel',.004,n=16)

    # Hollow conical outer hood makes an actual shadowed recess around the lens.
    import bpy, bmesh
    n=24; verts=[]
    for y,r in ((.200,.042),(.325,.068),(.200,.034),(.325,.056)):
        verts.extend((r*math.cos(i*2*math.pi/n),y,.138+r*math.sin(i*2*math.pi/n)) for i in range(n))
    faces=[]
    for base_a,base_b in ((0,n),(3*n,2*n),(2*n,0),(n,3*n)):
        for i in range(n):
            j=(i+1)%n;faces.append((base_a+i,base_a+j,base_b+j,base_b+i))
    mesh=bpy.data.meshes.new('Hollow objective hood');mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
    ob=bpy.data.objects.new('Hollow objective hood',mesh);bpy.context.collection.objects.link(ob);k._finish(ob,'Hollow objective hood','bone')
    k.ring('Objective steel mouth',.326,.138,.071,.056,'steel',.010,n=24)
    k.ring('Objective brass inner rim',.321,.138,.056,.049,'brass',.004,n=20)
    k.rod('Recessed objective lens',(0,.308,.138),(0,.312,.138),.049,'polymer',24)
    for y,r in ((.230,.050),(.275,.060)):
        k.ring('Objective red reinforcement',y,.138,r,r-.004,'leather',.007,n=20)
    # Distinct central optic body, elevation and windage controls.
    k.rod('Scope central collar',(0,.065,.138),(0,.125,.138),.039,'steel',20)
    k.rod('Elevation tower',(0,.095,.166),(0,.095,.183),.011,'steel',12)
    k.rod('Elevation cap',(0,.095,.183),(0,.095,.188),.013,'leather',12)
    for side in (-1,1):
        k.rod('Windage tower',(side*.036,.095,.138),(side*.045,.095,.138),.012,'steel',12)
        k.rod('Windage cap',(side*.045,.095,.138),(side*.048,.095,.138),.009,'leather',12)
    k.rod('Bolt shaft',(.030,.025,.064),(.049,.025,.068),.0035,'steel',10)
    k.rod('Bolt handle',(.049,.025,.068),(.049,.008,.044),.004,'steel',10)
    k.rod('Bolt knob',(.047,.008,.044),(.053,.008,.044),.006,'leather',12)
