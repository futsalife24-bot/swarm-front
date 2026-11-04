"""Blender --background --factory-startup --python build.py. タタラ外観試作。"""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

OUT = Path(__file__).resolve().parent
random.seed(24)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
mat = bpy.data.materials.new('岩殻・頂点色')
mat.use_nodes = True
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Roughness'].default_value = .9
col = mat.node_tree.nodes.new('ShaderNodeVertexColor')
col.layer_name = 'Color'
mat.node_tree.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
parts = []
shell=(.14,.075,.255,1); belly=(.95,.63,.012,1); joint=(.045,.008,.095,1)

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

# Blenderでは -Y が正面。背丈約0.65m、全幅約1.2m。
rock('腹の一枚岩',(0,0,.33),(.34,.35,.25),color=belly,sub=2)
rock('背の大岩',(0,.13,.48),(.40,.37,.19),sub=2)
rock('平たい頭',(0,-.25,.49),(.33,.23,.15),'head',sub=2)
rock('下顎',(0,-.30,.39),(.29,.19,.095),'head',color=belly,sub=2)
block('細い顔の継ぎ目',(0,-.459,.455),(.235,.009,.012),'head',(.065,.015,.01,1),.009)
for s,side in [(-1,'L'),(1,'R')]:
    rock('眉岩'+side,(s*.17,-.30,.59),(.19,.21,.055),'head',sub=1)
    rock('肩'+side,(s*.36,-.01,.42),(.19,.25,.19),'arm_'+side,sub=2)
    rock('肘の芯'+side,(s*.53,-.02,.22),(.12,.13,.12),'forearm_'+side,joint)
    rock('太い前腕'+side,(s*.51,-.17,.18),(.16,.23,.17),'forearm_'+side,sub=2)
    rock('手首'+side,(s*.51,-.31,.12),(.09,.085,.075),'hand_'+side,joint)
    block('平掌'+side,(s*.51,-.38,.105),(.165,.16,.064),'hand_'+side,shell,.055)
    block('掌の面'+side,(s*.51,-.40,.038),(.12,.105,.009),'hand_'+side,(1,.78,.018,1),.008)
    for j in range(3):
        block('掌の指'+side+str(j),(s*.51+(j-1)*.103,-.54,.074),(.047,.11,.049),'hand_'+side,shell,.025)
    rock('親指'+side,(s*.345,-.40,.09),(.085,.11,.065),'hand_'+side,sub=1)
    rock('後脚'+side,(s*.27,.28,.19),(.16,.19,.15),'foot_'+side,sub=2)
    block('後足'+side,(s*.29,.20,.065),(.14,.17,.05),'foot_'+side,shell,.035)
    for j in range(2):
        # 上・斜め前から読める識別線を肩の上面に置く。
        block('白い二本線'+side+str(j),(s*(.31+j*.065),-.08,.588),(.018,.085,.006),'arm_'+side,(.83,.84,.76,1),.003)
    rock('背の板'+side,(s*.20,.18,.615),(.21,.25,.045),sub=1)
    for j in range(2):
        block('背面識別'+side+str(j),(s*.19,.379,.475+j*.045),(.065,.006,.012),'body',(.83,.84,.76,1),.003)

bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.join()
mesh=bpy.context.object; mesh.name='Tatara_Surface'
tri=mesh.modifiers.new('三角形化','TRIANGULATE')
bpy.ops.object.modifier_apply(modifier=tri.name)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)

arm=bpy.data.armatures.new('Tatara_Rig')
rig=bpy.data.objects.new('Tatara',arm); bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig; mesh.select_set(False); rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
spec={'root':((0,0,0),None),'body':((0,0,.30),'root'),'head':((0,-.12,.46),'body')}
for s,side in [(-1,'L'),(1,'R')]:
    spec['arm_'+side]=((s*.36,0,.42),'body')
    spec['forearm_'+side]=((s*.53,-.02,.22),'arm_'+side)
    spec['hand_'+side]=((s*.51,-.31,.12),'forearm_'+side)
    spec['foot_'+side]=((s*.25,.25,.2),'body')
for name,(pos,parent) in spec.items():
    b=arm.edit_bones.new(name); b.head=pos; b.tail=Vector(pos)+Vector((0,0,.1))
    if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
mesh.parent=rig
mod=mesh.modifiers.new('骨変形','ARMATURE'); mod.object=rig
rig.animation_data_create()
rest={n:Vector(p) for n,(p,_) in spec.items()}
worlds={}
def pose_world(n, pivot, rotation):
    p=rig.pose.bones[n]
    target=Matrix.Translation(pivot) @ rotation.to_matrix().to_4x4() @ Matrix.Translation(-rest[n]) @ arm.bones[n].matrix_local
    parent=spec[n][1]
    local=arm.bones[parent].matrix_local.inverted() @ arm.bones[n].matrix_local if parent else arm.bones[n].matrix_local
    p.matrix_basis=local.inverted() @ (worlds[parent].inverted() @ target if parent else target)
    worlds[n]=target
def smooth(a):
    a=max(0,min(1,a));return a*a*(3-2*a)
def envelope(t,points):
    for (a,x),(b,y) in zip(points,points[1:]):
        if t<=b:return x+(y-x)*smooth((t-a)/(b-a))
    return points[-1][1]
def limb(side, shoulder, wrist, palm_angle):
    a=rest['arm_'+side];e=rest['forearm_'+side];h=rest['hand_'+side]
    l1=(e-a).length;l2=(h-e).length;v=wrist-shoulder;d=v.length;axis=v.normalized()
    assert d<l1+l2+.001,('reach',side,d,l1+l2)
    along=(l1*l1-l2*l2+d*d)/(2*d)
    bend=Vector((-1 if side=='L' else 1,0,.05));bend=(bend-axis*bend.dot(axis)).normalized()
    elbow=shoulder+axis*along+bend*math.sqrt(max(0,l1*l1-along*along))
    pose_world('arm_'+side,shoulder,(e-a).rotation_difference(elbow-shoulder))
    pose_world('forearm_'+side,elbow,(h-e).rotation_difference(wrist-elbow))
    pose_world('hand_'+side,wrist,Quaternion((1,0,0),palm_angle))
for name,length in [('Idle',90),('Follow',42),('Palm',84)]:
    action=bpy.data.actions.new(name); rig.animation_data.action=action
    for frame in range(1,length+2):
        t=(frame-1)/length; wave=math.sin(t*math.tau)
        for p in rig.pose.bones:
            p.rotation_mode='XYZ'; p.rotation_euler=(0,0,0); p.location=(0,0,0)
        shift=Vector((0,0,0));body_angle=0;raise_hand=0;turn=0;thrust=0
        if name=='Idle':
            shift=Vector((.014*wave,0,.012*(1-math.cos(t*math.tau))))
            body_angle=.025*wave
        elif name=='Follow':
            shift=Vector((.035*wave,0,.022*(1-math.cos(t*math.tau*2))))
            body_angle=.055*wave
        else:
            # 腰を落とす→手を離す→手首を返す→正面へ押し出す→戻す。
            prepare=envelope(t,[(0,0),(.16,1),(.38,0),(1,0)])
            raise_hand=envelope(t,[(0,0),(.15,0),(.36,1),(.68,1),(.93,0),(1,0)])
            turn=envelope(t,[(0,0),(.23,0),(.40,1),(.70,1),(.88,0),(1,0)])
            thrust=envelope(t,[(0,0),(.39,0),(.49,1),(.65,1),(.84,0),(1,0)])
            shift=Vector((.055*raise_hand,.035*prepare-.045*thrust,-.045*prepare+.018*raise_hand))
            body_angle=-.055*thrust
        q=Quaternion((0,1,0),body_angle)
        pose_world('root',rest['root'],Quaternion())
        pose_world('body',rest['body']+shift,q)
        head_p=rest['body']+shift+q@(rest['head']-rest['body'])
        look=Quaternion((0,0,1),.10*wave if name=='Idle' else -.08*thrust)
        pose_world('head',head_p,q@look)
        for s,side in [(-1,'L'),(1,'R')]:
            shoulder=rest['body']+shift+q@(rest['arm_'+side]-rest['body'])
            wrist=rest['hand_'+side].copy();angle=0
            foot=rest['foot_'+side].copy();foot_angle=0
            if name=='Follow':
                phase=(t+(0 if side=='L' else .5))%1
                swing=phase<.42
                u=phase/.42 if swing else (phase-.42)/.58
                wrist.y+=(-.085+.17*smooth(u)) if not swing else (.085-.17*smooth(u))
                wrist.z+=.10*math.sin(math.pi*u) if swing else 0
                angle=-.35*math.sin(math.pi*u) if swing else 0
                foot.y-=wrist.y-rest['hand_'+side].y
                foot.z+=0 if swing else .075*math.sin(math.pi*u)
                foot_angle=.20*math.sin(math.pi*u) if not swing else 0
            if name=='Palm' and side=='L':
                wrist+=Vector((-.02*raise_hand,.09*raise_hand-.22*thrust,.30*raise_hand))
                angle=-math.pi/2*turn
            limb(side,shoulder,wrist,angle)
            pose_world('foot_'+side,foot,Quaternion((1,0,0),foot_angle))
        for p in rig.pose.bones:
            p.keyframe_insert('location',frame=frame,group=p.name)
            p.keyframe_insert('rotation_euler',frame=frame,group=p.name)
    track=rig.animation_data.nla_tracks.new(); track.name=name
    track.strips.new(name,1,action)
    track.mute=True
rig.animation_data.action=None
for p in rig.pose.bones:p.location=(0,0,0); p.rotation_euler=(0,0,0)
scene=bpy.context.scene; scene.render.fps=30; scene.frame_end=61
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); mesh.select_set(True)
bpy.context.view_layer.objects.active=rig
props=bpy.ops.export_scene.gltf.get_rna_type().properties
opts=dict(filepath=str(OUT/'tatara.glb'),use_selection=True,export_format='GLB',export_animations=True)
if 'export_animation_mode' in props:opts['export_animation_mode']='ACTIONS'
bpy.ops.export_scene.gltf(**opts)
stats={'triangles':len(mesh.data.polygons),'materials':len(mesh.data.materials),'bones':len(arm.bones),'textures':0,'height_m':round(mesh.dimensions.z,4),'width_m':round(mesh.dimensions.x,4),'clips':['Idle','Follow','Palm'],'blender':bpy.app.version_string}
(OUT/'model-stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
# 編集用ファイルは待機アクションを選んで保存。GLBには3アクションを収録。
rig.animation_data.action=bpy.data.actions['Idle']
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'tatara.blend'))
print('BUDDY_STATS',json.dumps(stats))
