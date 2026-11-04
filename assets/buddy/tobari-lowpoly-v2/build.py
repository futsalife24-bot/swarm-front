"""Blender --background --factory-startup --python build.py. トバリ外観試作。"""
import bpy, bmesh, math, random, json
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

OUT = Path(__file__).resolve().parent
random.seed(33)
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
shell=(.09,.16,.23,1); belly=(.20,.30,.38,1); joint=(.018,.026,.033,1)

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


# 浮遊する青灰の外套。ひび割れや内部機械は省略。
rock('暗い内身',(0,.025,.52),(.12,.095,.24),'body',joint,3)
rock('上部の丸い折れ',(0,.015,.80),(.175,.13,.115),'head',shell,2)
# 顔板を外套の前縁より奥に置く。細い横スリットは色面のみ。
plate('炭色の顔板',[(-.12,-.132,.81),(.12,-.132,.81),(.10,-.137,.715),(-.09,-.137,.70)],'head',joint,.018)
plate('琥珀の細いスリット',[(-.105,-.139,.786),(.108,-.139,.786),(.100,-.140,.771),(-.101,-.140,.770)],'head',(.85,.42,.035,1),.003)
plate('スリットの上縁',[(-.15,-.15,.82),(.15,-.15,.82),(.12,-.153,.791),(-.12,-.153,.791)],'head',shell,.018)
# 外套は4mmの薄い面と6mmの浅い折れ。裾を広げる。
def leaf(name,rows,bone,color):
    verts=[]
    for back in [False,True]:
        for cx,y,z,width in rows:
            for k in range(5):
                u=k/4*2-1
                verts.append((cx+u*width,y-.006*(1-abs(u))+( .004 if back else 0),z))
    n=len(rows)*5;faces=[]
    for layer in [0,1]:
        for j in range(len(rows)-1):
            for k in range(4):
                a=layer*n+j*5+k
                faces.append((a,a+1,a+6,a+5) if layer==0 else (a+5,a+6,a+1,a))
    edge=list(range(5))+[j*5+4 for j in range(1,len(rows))]+list(range(n-2,n-6,-1))+[j*5 for j in range(len(rows)-2,0,-1)]
    faces += [(a,edge[(i+1)%len(edge)],edge[(i+1)%len(edge)]+n,a+n) for i,a in enumerate(edge)]
    return poly(name,verts,faces,bone,color)
for s,side in [(-1,'L'),(1,'R')]:
    leaf('外側の長い襞'+side,[(s*.115,-.025,.83,.025),(s*.16,-.040,.76,.070),(s*.19,-.045,.65,.105),(s*.21,-.035,.53,.140),(s*.23,-.015,.42,.165),(s*.23,.005,.30,.180),(s*.22,.015,.21 if s<0 else .24,.165)],'cloak_'+side,shell)
    leaf('後ろの襞'+side,[(s*.08,.07,.78,.045),(s*.12,.10,.68,.090),(s*.16,.12,.57,.130),(s*.18,.14,.47,.155),(s*.19,.15,.37,.175),(s*.19,.16,.26,.180),(s*.18,.17,.18,.165)],'rear_'+side,(.065,.105,.15,1))
    leaf('前襟の折れ'+side,[(s*.13,-.11,.81,.025),(s*.12,-.15,.76,.045),(s*.10,-.16,.70,.065),(s*.09,-.17,.65,.065),(s*.08,-.16,.60,.052),(s*.07,-.15,.55,.03),(s*.06,-.14,.51,.003)],'cloak_'+side,belly if s<0 else shell)
# 前と後に二本線。装甲の細かな積層や模様は追加しない。
for j in range(2):
    block('白い識別線'+str(j),(-.185,-.055,.66-j*.028),(.026,.006,.006),'cloak_L',(.88,.86,.77,1),.002)
    block('後方識別線'+str(j),(0,.143,.64-j*.028),(.029,.006,.006),'body',(.88,.86,.77,1),.002)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
mesh=bpy.context.object;mesh.name='Tobari_Surface'
tri=mesh.modifiers.new('三角形化','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
arm=bpy.data.armatures.new('Tobari_Rig');rig=bpy.data.objects.new('Tobari',arm);bpy.context.collection.objects.link(rig)
mesh.select_set(False);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')

spec={'root':((0,0,0),None),'body':((0,0,.55),'root'),'head':((0,0,.76),'body'),
'cloak_L':((-.12,0,.77),'body'),'cloak_R':((.12,0,.77),'body'),
'rear_L':((-.08,.07,.72),'body'),'rear_R':((.08,.07,.72),'body')}
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
        shift=Vector((.012*w if name=='Follow' else 0,-.035*a,.015*w+.025*a))
        q=Quaternion((1,0,0),.17 if name=='Follow' else -.07*a)@Quaternion((0,1,0),.025*w)
        pose('root',rest['root'],Quaternion());pose('body',rest['body']+shift,q)
        hp=rest['body']+shift+q@(rest['head']-rest['body'])
        pose('head',hp,Quaternion((0,0,1),.13*w if name=='Idle' else -.18*a))
        for s,side in [(-1,'L'),(1,'R')]:
            for part in ['cloak','rear']:
                n=part+'_'+side;pivot=rest['body']+shift+q@(rest[n]-rest['body'])
                flutter=.065*math.sin(t*math.tau-.7+(s*.3))
                spread=-s*(.55*a if part=='cloak' else .22*a)
                pose(n,pivot,q@Quaternion((0,1,0),spread+flutter)@Quaternion((1,0,0),-.12 if name=='Follow' else .035*w))
        for p in rig.pose.bones:
            p.keyframe_insert('location',frame=f,group=p.name);p.keyframe_insert('rotation_euler',frame=f,group=p.name)
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
rig.animation_data.action=None
for p in rig.pose.bones:p.location=(0,0,0);p.rotation_euler=(0,0,0)
scene=bpy.context.scene;scene.render.fps=30;scene.frame_end=91;scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'tobari.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS')
stats={'triangles':len(mesh.data.polygons),'materials':1,'bones':len(arm.bones),'textures':0,'height_m':round(mesh.dimensions.z,4),'width_m':round(mesh.dimensions.x,4),'clips':['Idle','Follow','Display'],'blender':bpy.app.version_string}
(OUT/'model-stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
rig.animation_data.action=bpy.data.actions['Idle'];bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'tobari.blend'))
print('BUDDY_STATS',json.dumps(stats))
