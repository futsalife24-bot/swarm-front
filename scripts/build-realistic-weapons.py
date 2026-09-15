"""Photo-referenced exterior game meshes. Origin: trigger hand, +Y forward, +Z up.
No internal mechanisms; silhouettes adapted to existing animation sockets.
Run with Blender --background --python-exit-code 1 --python this_file.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/weapons/realism-v2'
SOURCE = ROOT / 'assets/blender/source/weapon-realism-v2'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)

def material(name, color, metal=0, rough=.5):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    return m

def finish(o,name,mat,bevel=0):
    o.name=name; o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Edge chamfer','BEVEL'); b.width=bevel; b.segments=2
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
    return o

def box(name,loc,size,mat,bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,bevel)

def rod(name,a,b,r,mat,n=24,r2=None):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object; o.rotation_mode='QUATERNION'; o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
    finish(o,name,mat)
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    return o

def profile(name,points,width,mat,bevel=.002,x=0):
    n=len(points); verts=[(x+s*width/2,y,z) for s in [-1,1] for y,z in points]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    # Consistent outward normals for both side panels and bevels.
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    return finish(o,name,mat,bevel)

def ring(name,y,z,outer,inner,mat,length=.012,x=0):
    n=32; verts=[]
    for yy,r in [(y-length/2,outer),(y+length/2,outer),(y-length/2,inner),(y+length/2,inner)]:
        verts.extend((x+math.cos(i*2*math.pi/n)*r,yy,z+math.sin(i*2*math.pi/n)*r) for i in range(n))
    faces=[]
    for a,b in [(0,n),(3*n,2*n),(2*n,0),(n,3*n)]:
        for i in range(n):j=(i+1)%n; faces.append((a+i,a+j,b+j,b+i))
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); finish(o,name,mat)
    return o

def guard(y,z,w=.08):
    # Open trigger guard, rather than a filled block.
    for a,b in [((0,y-w/2,z),(0,y-w/2,z-.04)),((0,y-w/2,z-.04),(0,y+w/2,z-.04)),((0,y+w/2,z-.04),(0,y+w/2,z))]:rod('Trigger guard',a,b,.004,steel,12)
    rod('Trigger',(0,y,z),(0,y-.007,z-.026),.003,steel,12)

def pins(positions,x=.035):
    for y,z in positions:
        for sign in [-1,1]:
            rod('Fastener',(sign*x,y,z),(sign*(x+.002),y,z),.0045,steel,12)
            box('Fastener slot',(sign*(x+.003),y,z),(.001,.005,.001),black,.0002)

def rail(a,b,z,width=.06):
    box('Rail spine',(0,(a+b)/2,z),(width*.65,b-a,.009),steel)
    for i in range(round((b-a)/.016)):
        box('Rail tooth',(0,a+i*.016,z+.006),(width,.009,.007),steel,.001)

def rifle():
    profile('SCAR upper', [(-.085,.012),(.37,.012),(.37,.081),(.31,.093),(-.085,.093)],.066,tan)
    profile('Lower receiver',[(-.085,.01),(-.065,-.035),(.033,-.042),(.05,-.058),(.14,-.052),(.15,.018)],.060,poly)
    profile('Angled pistol grip',[(-.025,-.025),(.019,-.039),(-.025,-.145),(-.076,-.131)],.042,poly,.004)
    profile('Folding stock',[(-.10,.078),(-.245,.084),(-.325,.064),(-.325,-.107),(-.291,-.104),(-.253,-.035),(-.12,-.028)],.06,poly,.005)
    box('Raised cheek rest',(0,-.19,.071),(.066,.158,.044),tan,.008)
    box('Stock hinge',(0,-.091,.023),(.074,.018,.113),tan,.003)
    profile('Rubber buttpad',[(-.337,.07),(-.322,.064),(-.322,-.107),(-.337,-.111)],.066,rubber)
    for z in [-.08,-.06,-.04,-.02,0,.02,.04]:box('Buttpad ribs',(0,-.339,z),(.063,.005,.004),black,.001)
    profile('Curved magazine',[(.052,-.043),(.116,-.04),(.12,-.13),(.149,-.225),(.083,-.239),(.058,-.14)],.038,mag,.003)
    for s in [-1,1]:
        for yy in [.071,.091,.110]:
            rod('Magazine flute',(s*.020,yy,-.075),(s*.020,yy+.009,-.15),.0025,tan,8)
            rod('Magazine flute',(s*.020,yy+.009,-.15),(s*.020,yy+.028,-.219),.0025,tan,8)
        for yy in [.24,.275,.31]:box('Cooling recess',(s*.0338,yy,.067),(.0015,.024,.008),black,.003)
        box('Charging channel',(s*.0339,.13,.072),(.002,.16,.009),black,.003)
        rod('Charging handle',(s*.034,.179,.073),(s*.061,.179,.073),.006,steel,16)
        box('Side rail',(s*.037,.292,.025),(.011,.135,.021),steel)
        for i in range(9):box('Side rail rib',(s*.044,.232+i*.015,.025),(.008,.006,.027),steel,.001)
        rod('Selector',(s*.034,-.025,-.015),(s*.042,-.025,-.015),.008,steel,16)
    box('Ejection port',(.034,.074,.025),(.002,.105,.015),black,.003)
    pins([(-.066,.024),(.02,.024),(.142,.024),(.354,.066)])
    rail(-.069,.36,.10)
    rod('Barrel',(0,.35,.043),(0,.615,.043),.012,steel,32)
    rod('Gas block',(0,.36,.043),(0,.394,.043),.023,steel)
    rod('Gas cylinder',(0,.357,.078),(0,.39,.078),.011,steel)
    ring('Flash hider',.639,.043,.019,.009,steel,.042)
    for s in [-1,1]:
        for y in [.63,.645]:box('Flash hider slot',(s*.018,y,.043),(.003,.008,.010),black,.001)
    for y in [-.058,.374]:
        box('Sight base',(0,y,.108),(.048,.031,.015),steel)
        ring('Aperture sight',y,.139,.013,.008,steel,.009)
        box('Sight stem',(0,y,.122),(.012,.01,.02),steel)
    guard(.012,-.034)

def shotgun():
    profile('590 receiver',[(-.06,.009),(.13,.009),(.13,.073),(-.026,.073),(-.07,.046)],.057,steel,.004)
    profile('590 swept stock',[(-.055,.043),(-.128,.012),(-.207,.018),(-.375,-.007),(-.366,-.127),(-.19,-.064),(-.11,-.04),(-.079,-.062),(-.052,-.007)],.055,rubber,.006)
    profile('Recoil pad',[(-.388,-.005),(-.374,-.007),(-.365,-.126),(-.379,-.13)],.06,black,.003)
    for s in [-1,1]:
        box('Stock shell recess',(s*.029,-.253,-.016),(.002,.08,.014),black,.003)
    rod('Heavy barrel',(0,.12,.052),(0,.651,.052),.0145,steel,32)
    ring('Open muzzle',.653,.052,.0145,.010,steel,.008)
    rod('Magazine tube',(0,.12,.016),(0,.638,.016),.013,steel,32)
    rod('Magazine cap',(0,.622,.016),(0,.645,.016),.018,steel,24)
    rod('Pump body',(0,.264,.016),(0,.458,.016),.025,rubber,32)
    for i in range(17):ring('Pump rib',.295+i*.008,.016,.028,.024,rubber,.0035)
    for s in [-1,1]:rod('Action bar',(s*.019,.115,.017),(s*.019,.281,.017),.0035,steel,10)
    box('Ejection port',(.029,.074,.048),(.002,.067,.02),black,.004)
    box('Bolt face',(.030,.079,.05),(.002,.052,.013),mag,.002)
    box('Tang safety',(0,-.025,.078),(.016,.019,.007),black)
    for y in [.512,.621]:box('Barrel tube clamp',(0,y,.033),(.036,.014,.059),steel,.004)
    box('Front sight',(0,.624,.073),(.024,.018,.026),steel)
    box('Sight bead',(0,.624,.088),(.004,.007,.006),ivory,.001)
    ring('Ghost ring',-.025,.089,.009,.0055,steel,.008)
    guard(-.005,.001,.059); pins([(-.03,.035),(.043,.024)],.029)

def rocket():
    rod('AT4 composite tube',(0,-.34,.09),(0,.59,.09),.074,olive,48)
    for y in [-.337,.581]:
        ring('Protective end collar',y,.09,.091,.067,rubber,.04)
        for i in range(12):
            a=i*math.pi/6
            o=box('End collar rib',(.088*math.cos(a),y,.09+.088*math.sin(a)),(.014,.043,.012),black,.002)
            o.rotation_euler.y=-a
    ring('Inner launch tube',.595,.09,.068,.061,steel,.016)
    rod('Dark interior',(0,.56,.09),(0,.561,.09),.061,black,48)
    for y in [-.25,.34]:ring('Tube clamp',y,.09,.077,.073,steel,.021)
    ring('Identification band',.44,.09,.0748,.073,ochre,.023)
    box('Shoulder rest',(0,-.16,-.003),(.092,.16,.026),rubber,.009)
    box('Firing housing',(.04,.018,.137),(.065,.22,.033),olive,.005)
    box('Safety marker',(.068,.036,.158),(.012,.045,.008),red)
    box('Sight bracket',(.086,.14,.13),(.028,.16,.021),steel)
    box('Sight housing',(.094,.12,.171),(.037,.09,.061),olive,.004)
    for y in [.085,.158]:ring('Sight eyepiece',y,.177,.017,.012,steel,.014,x=.094)
    box('Folded front support',(0,.26,-.009),(.043,.15,.031),rubber,.007)
    profile('Trigger grip',[(-.022,.006),(.025,.006),(.021,-.111),(-.02,-.117)],.043,rubber,.004)
    # Small generic painted inspection marks, no copied logos or texture photography.
    for side in [-1,1]:
        box('Inspection plate',(side*.0747,-.11,.091),(.001,.14,.034),olive,.001)
        for i in range(4):box('Inspection stencil',(side*.0755,-.13+i*.018,.09),(.001,.011,.0025),ivory,.0001)
    for y in [-.24,.36]:
        ring('Sling eye',y,.015,.013,.008,steel,.009,x=.059)

report=[]
for kind,build in [('rifle',rifle),('shotgun',shotgun),('rocket',rocket)]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    steel=material('Parkerized steel',(.065,.078,.084),.75,.42)
    black=material('Recess black',(.009,.014,.016),.1,.7)
    rubber=material('Textured polymer',(.032,.042,.042),0,.75)
    tan=material('Anodized FDE',(.43,.31,.14),.55,.42)
    poly=material('FDE polymer',(.32,.235,.12),0,.65)
    mag=material('Magazine metal',(.20,.19,.14),.65,.43)
    olive=material('Olive composite',(.16,.20,.10),.12,.64)
    ochre=material('Ochre band',(.58,.43,.12),.15,.5)
    ivory=material('Offwhite paint',(.65,.67,.52),0,.64)
    red=material('Safety red',(.5,.035,.015),0,.5)
    accent=material('Rarity identification',(.2,.26,.27),.45,.45)
    build()
    # Small identification inlays keep the reference silhouette intact across grades.
    for s in [-1,1]:
        box('Grade inlay',(s*(.035 if kind=='rifle' else .030 if kind=='shotgun' else .076),-.05 if kind!='rocket' else -.2,.045 if kind!='rocket' else .09),(.002,.014,.012),accent,.001)
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    bpy.ops.object.join(); obj=bpy.context.object; obj.name='Weapon_'+kind+'_realism_v2'
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    mesh=obj.data; mesh.calc_loop_triangles()
    bounds=[list(min(v.co[i] for v in mesh.vertices) for i in range(3)),list(max(v.co[i] for v in mesh.vertices) for i in range(3))]
    for grade,color in enumerate([(.2,.26,.27),(.08,.3,.15),(.08,.2,.45),(.3,.09,.39),(.55,.35,.065)]):
        accent.diffuse_color=(*color,1);accent.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
        path=OUT/f'{kind}_{grade}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
        report.append(dict(kind=kind,grade=grade,triangles=len(mesh.loop_triangles),vertices=len(mesh.vertices),bounds=bounds,bytes=path.stat().st_size))
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f'{kind}.blend'))
(OUT/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('WEAPON_REALISM_COMPLETE',json.dumps(report))
