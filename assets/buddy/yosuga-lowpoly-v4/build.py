"""Blender --background --factory-startup --python build.py. ヨスガ外観試作。"""
import bpy, bmesh, math, random, json
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

OUT = Path(__file__).resolve().parent
random.seed(24)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
mat = bpy.data.materials.new('板殻・頂点色')
mat.use_nodes = True
mat.use_backface_culling = True
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Roughness'].default_value = .9
col = mat.node_tree.nodes.new('ShaderNodeVertexColor')
col.layer_name = 'Color'
mat.node_tree.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
parts = []
shell=(.19,.075,.025,1); belly=(.47,.22,.055,1); joint=(.035,.018,.012,1)

def finish(o, name, bone, color):
    o.name=name
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    attr=o.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for p in o.data.polygons:
        f=random.uniform(.88,1.12)
        for i in p.loop_indices:
            attr.data[i].color=tuple(min(1,c*f) for c in color[:3])+(1,)
    o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))),1,'REPLACE')
    parts.append(o)
    return o

def rock(name, pos, scale, bone='body', color=shell, sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1, location=pos)
    o=bpy.context.object
    # 切り出した岩のような広い面。対称輪郭を崩しすぎない。
    for v in o.data.vertices:
        v.co *= random.uniform(.95,1.05)
    o.scale=scale
    return finish(o,name,bone,color)

def block(name,pos,scale,bone,color,bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=2, location=pos)
    o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('大きな面取り','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,bone,color)

def poly(name,verts,faces,bone,color):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    return finish(o,name,bone,color)

def plate(name,outline,bone,color,thick=.014,axis=(0,1,0)):
    # 横から見て厚みを持つ板。outlineは表面の輪郭、裏面はY方向へ。
    n=len(outline);verts=outline+[(x+axis[0]*thick,y+axis[1]*thick,z+axis[2]*thick) for x,y,z in outline]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return poly(name,verts,faces,bone,color)

# 横長の台形頭。耳・毛・提灯は追加しない。
head=poly('横長の台形頭',[(-.30,-.10,.70),(.30,-.10,.70),(.19,-.15,.54),(-.19,-.15,.54),
     (-.28,.065,.70),(.28,.065,.70),(.15,.08,.55),(-.15,.08,.55),(0,-.195,.56),(0,-.14,.70)],
     [(0,9,8,3),(9,1,2,8),(3,8,2),(0,4,5,1,9),(4,7,6,5),(0,3,7,4),(1,5,6,2),(3,2,6,7)],'head',shell)
# 旧版の両目が消費した乱数を保持し、後続の胴・尾の形と色を変えない。
eye_rng=random.getstate()
for _ in range(2*(42+80+12+20)):random.random()
after_eyes_rng=random.getstate();random.setstate(eye_rng)
surface=head.copy();surface.data=head.data.copy();bpy.context.collection.objects.link(surface)
bpy.context.view_layer.update()
def face_y(x,z):
    hit,p,normal,index=surface.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
    assert hit,('outside head',x,z)
    return p.y
insets=[]
def eye_disc(name,cx,cz,radius,color,inset):
    n=16;xz=[(cx,cz)]+[(cx+radius*math.cos(i*math.tau/n),cz+radius*math.sin(i*math.tau/n)) for i in range(n)]+[(cx,cz)]
    verts=[(x,face_y(x,z)+inset+(0.002 if i==n+1 else 0),z) for i,(x,z) in enumerate(xz)]
    insets.extend(y-face_y(x,z) for x,y,z in verts)
    faces=[(0,1+i,1+(i+1)%n) for i in range(n)]+[(n+1,1+(i+1)%n,1+i) for i in range(n)]
    return poly(name,verts,faces,'head',color)
for s,side in [(-1,'L'),(1,'R')]:
    cx=s*.112
    # 頭の表面に開口を切り、目の全面を元の顔面より内側へ置く。
    outline=[(s*.068,.581),(s*.158,.604),(s*.161,.577),(s*.132,.556),(s*.095,.558),(s*.067,.571)]
    n=len(outline);verts=[(x,-.4,z) for x,z in outline]+[(x,face_y(x,z)+.035,z) for x,z in outline]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    cutter=poly('眼窩の切抜き'+side,verts,faces,'head',joint)
    bpy.context.view_layer.objects.active=head
    mod=head.modifiers.new('眼窩のくぼみ'+side,'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
    backing=[(x,face_y(x,z)+.026,z) for x,z in outline]
    insets.extend(y+offset-face_y(x,z) for x,y,z in backing for offset in (0,.002))
    plate('眼窩の奥'+side,backing,'head',(.014,.006,.003,1),.002)
    eye_disc('内側の琥珀虹彩'+side,cx,.583,.025,(.95,.40,.018,1),.014)
    eye_disc('内側の丸い瞳孔'+side,cx-s*.002,.583,.011,(.005,.003,.002,1),.011)
    eye_disc('内側の反射'+side,cx-s*.006,.590,.003,(.96,.88,.63,1),.009)
bpy.data.objects.remove(surface,do_unlink=True)
head.vertex_groups['head'].add(list(range(len(head.data.vertices))),1,'REPLACE')
assert min(insets)>.0089
(OUT/'eye-inset-check.json').write_text(json.dumps({'minimum_inset_m':min(insets),'maximum_inset_m':max(insets),'eye_vertices_checked':len(insets),'method':'全ての眼窩奥・虹彩・瞳孔・反射の頂点を元の顔面レイ交差位置と比較。正値は頭の内側。'},ensure_ascii=False,indent=2),encoding='utf-8')
random.setstate(after_eyes_rng)
rock('首',(0,.015,.49),(.065,.07,.07),'head',joint,2)
rock('小さな二足の胴',(0,.025,.32),(.14,.125,.18),'body',shell,2)
rock('胸の内側',(0,-.055,.35),(.105,.09,.13),'body',belly,2)
plate('中央の胸板',[(-.07,-.12,.47),(.07,-.12,.47),(.085,-.15,.29),(0,-.17,.24),(-.085,-.15,.29)],'body',belly)
for s,side in [(-1,'L'),(1,'R')]:
    plate('外套の大きな面'+side,[(s*.035,-.02,.48),(s*.16,.025,.44),(s*.245,-.015,.20),(s*.13,-.07,.22),(s*.035,-.105,.35)],'cloak_'+side,shell,.024)
    for j in range(2):
        z=.41-j*.09
        plate('外套の節'+side+str(j),[(s*.07,-.075,z+.035),(s*.15,-.035,z+.01),(s*.21,-.045,z-.095),(s*.10,-.12,z-.025)],'cloak_'+side,belly if j==0 else shell)
    rock('腿'+side,(s*.09,.02,.20),(.075,.075,.09),'thigh_'+side,shell,2)
    rock('脛'+side,(s*.09,-.025,.10),(.038,.045,.07),'shin_'+side,belly,2)
    block('足'+side,(s*.09,-.06,.037),(.068,.08,.025),'foot_'+side,shell,.02)
    for j in range(3):
        block('趾'+side+str(j),(s*.09+(j-1)*.044,-.125,.025),(.020,.05,.018),'foot_'+side,belly,.012)
    # 付根から後上方へ伸びる二枚の板尾。
    yz=[(.13,.25),(.22,.50),(.49,.68),(.46,.38),(.28,.25)] if side=='L' else [(.13,.25),(.25,.41),(.55,.55),(.50,.30),(.29,.23)]
    outline=[(s*(.075+.40*(y-.13)),y,z) for y,z in yz]
    plate('二枚の板尾'+side,outline,'tail_'+side,shell,.022,(s,0,0))
    tip=outline[2];before=outline[1]
    edge=[(before[0]+s*.024,before[1],before[2]),(tip[0]+s*.024,tip[1],tip[2]),(tip[0]+s*.024,tip[1]-.012,tip[2]-.038),(before[0]+s*.024,before[1]+.015,before[2]-.035)]
    plate('尾の明るい縁'+side,edge,'tail_'+side,belly,.004,(s,0,0))
    if side=='R':
        slit=[(.31,.36),(.44,.445),(.45,.435),(.32,.35)]
        plate('琥珀色の尾スリット',[(.075+.40*(y-.13)+.025,y,z) for y,z in slit],'tail_R',(.95,.40,.015,1),.004,(1,0,0))
for j in range(2):
    block('白い識別線'+str(j),(0,-.142-j*.007,.383-j*.035),(.036,.005,.008),'body',(.88,.86,.77,1),.003)

bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
mesh=bpy.context.object;mesh.name='Yosuga_Surface'
tri=mesh.modifiers.new('三角形化','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
arm=bpy.data.armatures.new('Yosuga_Rig');rig=bpy.data.objects.new('Yosuga',arm);bpy.context.collection.objects.link(rig)
mesh.select_set(False);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
spec={'root':((0,0,0),None),'body':((0,0,.30),'root'),'head':((0,.01,.49),'body')}
for s,side in [(-1,'L'),(1,'R')]:
    spec['cloak_'+side]=((s*.075,.01,.45),'body')
    spec['tail_'+side]=((s*.085,.13,.25),'body')
    spec['thigh_'+side]=((s*.09,.015,.24),'body')
    spec['shin_'+side]=((s*.09,-.055,.13),'thigh_'+side)
    spec['foot_'+side]=((s*.09,-.015,.055),'shin_'+side)
for n,(pos,parent) in spec.items():
    b=arm.edit_bones.new(n);b.head=pos;b.tail=Vector(pos)+Vector((0,0,.06))
    if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');mesh.parent=rig
mod=mesh.modifiers.new('骨変形','ARMATURE');mod.object=rig
rest={n:Vector(p) for n,(p,_) in spec.items()};worlds={}
def pose(n,pivot,rot):
    target=Matrix.Translation(pivot)@rot.to_matrix().to_4x4()@Matrix.Translation(-rest[n])@arm.bones[n].matrix_local
    parent=spec[n][1];local=arm.bones[parent].matrix_local.inverted()@arm.bones[n].matrix_local if parent else arm.bones[n].matrix_local
    rig.pose.bones[n].matrix_basis=local.inverted()@(worlds[parent].inverted()@target if parent else target)
    worlds[n]=target
def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)
def envelope(t):
    return smooth((t-.12)/.22)*(1-smooth((t-.68)/.22))
rig.animation_data_create()
for name,length in [('Idle',90),('Follow',36),('Display',84)]:
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for f in range(1,length+2):
        t=(f-1)/length;w=math.sin(t*math.tau);a=envelope(t) if name=='Display' else 0
        for p in rig.pose.bones:p.rotation_mode='XYZ';p.location=(0,0,0);p.rotation_euler=(0,0,0)
        bob=.006*(1-math.cos(t*math.tau)) if name=='Idle' else .009*(1-math.cos(t*math.tau*2)) if name=='Follow' else -.020*a
        shift=Vector((.012*w if name=='Follow' else 0,0,bob))
        q=Quaternion((0,1,0),.035*w if name=='Follow' else -.04*a)
        pose('root',rest['root'],Quaternion());pose('body',rest['body']+shift,q)
        hp=rest['body']+shift+q@(rest['head']-rest['body'])
        pose('head',hp,q@Quaternion((0,0,1),.18*w if name=='Idle' else -.30*a)@Quaternion((0,1,0),.055*w if name=='Idle' else .12*a))
        for s,side in [(-1,'L'),(1,'R')]:
            for part in ['tail','cloak']:
                n=part+'_'+side;pivot=rest['body']+shift+q@(rest[n]-rest['body'])
                rz=(-s*.65*a+.075*math.sin(t*math.tau+.5*s)) if part=='tail' else s*.28*a+.055*w
                pose(n,pivot,q@Quaternion((0,0,1),rz)@Quaternion((1,0,0),-.12*a if part=='tail' else -.07*a))
            hip=rest['body']+shift+q@(rest['thigh_'+side]-rest['body']);foot=rest['foot_'+side].copy();angle=0
            if name=='Follow':
                phase=(t+(0 if side=='L' else .5))%1;swing=phase<.45;u=phase/.45 if swing else (phase-.45)/.55
                foot.y+=(.045-.09*smooth(u)) if swing else (-.045+.09*smooth(u))
                foot.z+=.065*math.sin(math.pi*u) if swing else 0
                angle=-.18*math.sin(math.pi*u) if swing else 0
            rhip=rest['thigh_'+side];rknee=rest['shin_'+side];rf=rest['foot_'+side]
            l1=(rknee-rhip).length;l2=(rf-rknee).length;v=foot-hip;d=v.length;axis=v.normalized();assert d<l1+l2+.001,(name,f,d,l1+l2)
            along=(l1*l1-l2*l2+d*d)/(2*d);bend=Vector((0,-1,0));bend=(bend-axis*bend.dot(axis)).normalized()
            knee=hip+axis*along+bend*math.sqrt(max(0,l1*l1-along*along))
            pose('thigh_'+side,hip,(rknee-rhip).rotation_difference(knee-hip))
            pose('shin_'+side,knee,(rf-rknee).rotation_difference(foot-knee))
            pose('foot_'+side,foot,Quaternion((1,0,0),angle))
        for p in rig.pose.bones:
            p.keyframe_insert('location',frame=f,group=p.name);p.keyframe_insert('rotation_euler',frame=f,group=p.name)
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
rig.animation_data.action=None
for p in rig.pose.bones:p.location=(0,0,0);p.rotation_euler=(0,0,0)
scene=bpy.context.scene;scene.render.fps=30;scene.frame_end=91;scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'yosuga.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS')
stats={'triangles':len(mesh.data.polygons),'materials':1,'bones':len(arm.bones),'textures':0,'height_m':round(mesh.dimensions.z,4),'width_m':round(mesh.dimensions.x,4),'clips':['Idle','Follow','Display'],'blender':bpy.app.version_string}
(OUT/'model-stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
rig.animation_data.action=bpy.data.actions['Idle'];bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'yosuga.blend'))
print('BUDDY_STATS',json.dumps(stats))



