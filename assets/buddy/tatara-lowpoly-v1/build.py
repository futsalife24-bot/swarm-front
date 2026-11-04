"""Blender --background --factory-startup --python build.py. タタラ外観試作。"""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector

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
shell=(.19,.175,.145,1); belly=(.34,.285,.205,1); joint=(.12,.105,.075,1)

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
rock('平たい頭',(0,-.25,.49),(.33,.23,.15),sub=2)
rock('下顎',(0,-.30,.39),(.29,.19,.095),color=belly,sub=2)
block('細い顔の継ぎ目',(0,-.459,.455),(.235,.009,.012),'body',(.065,.055,.04,1),.009)
for s,side in [(-1,'L'),(1,'R')]:
    rock('眉岩'+side,(s*.17,-.30,.59),(.19,.21,.055),sub=1)
    rock('肩'+side,(s*.36,-.01,.42),(.19,.25,.19),'arm_'+side,sub=2)
    rock('肘の芯'+side,(s*.45,-.12,.27),(.12,.13,.12),'arm_'+side,joint)
    rock('太い前腕'+side,(s*.49,-.21,.22),(.16,.23,.17),'hand_'+side,sub=2)
    block('平掌'+side,(s*.51,-.38,.105),(.165,.16,.064),'hand_'+side,shell,.055)
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
spec={'root':((0,0,0),None),'body':((0,0,.30),'root')}
for s,side in [(-1,'L'),(1,'R')]:
    spec['arm_'+side]=((s*.33,0,.43),'body')
    spec['hand_'+side]=((s*.45,-.14,.25),'arm_'+side)
    spec['foot_'+side]=((s*.25,.25,.2),'body')
for name,(pos,parent) in spec.items():
    b=arm.edit_bones.new(name); b.head=pos; b.tail=Vector(pos)+Vector((0,0,.1))
    if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
mesh.parent=rig
mod=mesh.modifiers.new('骨変形','ARMATURE'); mod.object=rig
rig.animation_data_create()
for name,length in [('Idle',60),('Follow',32),('Palm',48)]:
    action=bpy.data.actions.new(name); rig.animation_data.action=action
    for frame in range(1,length+2):
        t=(frame-1)/length; wave=math.sin(t*math.tau)
        for p in rig.pose.bones:
            p.rotation_mode='XYZ'; p.rotation_euler=(0,0,0); p.location=(0,0,0)
        if name=='Idle':
            rig.pose.bones['body'].location.y=.008*(1-math.cos(t*math.tau))
        elif name=='Follow':
            rig.pose.bones['body'].location.y=.012*abs(wave)
            rig.pose.bones['body'].rotation_euler.y=.035*wave
            for s,side in [(-1,'L'),(1,'R')]:
                rig.pose.bones['arm_'+side].rotation_euler.x=.16*wave*s
                rig.pose.bones['foot_'+side].rotation_euler.x=-.22*wave*s
        else:
            # 構える→掌を前へ→戻る。属性や当たり判定は含めない。
            a=math.sin(math.pi*min(1,max(0,(t-.12)/.76)))**2
            rig.pose.bones['arm_L'].rotation_euler.x=-.95*a
            rig.pose.bones['hand_L'].rotation_euler.x=.65*a
            rig.pose.bones['body'].rotation_euler.y=-.08*a
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
