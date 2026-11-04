"""Blender --background --factory-startup --python build.py. オリハ外観試作。"""
import bpy, bmesh, math, random, json
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

OUT = Path(__file__).resolve().parent
random.seed(41)
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
shell=(.61,.59,.50,1); belly=(.045,.16,.17,1); joint=(.018,.026,.028,1)

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



# 短いS字の節と、骨灰・青緑の色分け。
points=[Vector(p) for p in [(0,-.28,.67),(0,-.13,.43),(0,.07,.39),(0,.26,.46),(0,.43,.47),(0,.55,.43)]]
def spindle(name,start,end,width,depth,bone,color):
    axis=(end-start).normalized();right=Vector((1,0,0));up=right.cross(axis).normalized()
    verts=[];rings=[(0,.55),(.18,.92),(.5,1),(.82,.83),(1,.45)]
    if name=='扁平な頭':rings=[(0,.035),(.18,.65),(.5,1),(.82,.83),(1,.45)]
    for t,r in rings:
        center=start+(end-start)*t
        for k in range(12):
            a=math.tau*k/12
            verts.append(tuple(center+right*(math.cos(a)*width*r)+up*(math.sin(a)*depth*r)))
    faces=[tuple(range(11,-1,-1)),tuple(range(48,60))]
    faces += [(j*12+k,j*12+(k+1)%12,(j+1)*12+(k+1)%12,(j+1)*12+k) for j in range(4) for k in range(12)]
    o=poly(name,verts,faces,bone,color)
    return o
for i in range(5):
    start,end=points[i],points[i+1];axis=(end-start).normalized()
    spindle('扁平な節'+str(i),start+axis*.014,end-axis*.012,.068-i*.006,.049-i*.004,'seg'+str(i),shell)
    # 節の付根に青緑の短い帯。
    spindle('青緑の節帯'+str(i),start+axis*.014,start+axis*.052,.071-i*.006,.052-i*.004,'seg'+str(i),belly)
    rock('暗い継ぎ目'+str(i),start,(.045-i*.003,.044-i*.003,.044-i*.003),'seg'+str(i),joint,2)
# 扁平な尖り頭。顔を動物の顎や角へ変えず、元絵の流線形を残す。
spindle('扁平な頭',Vector((0,-.43,.685)),Vector((0,-.235,.69)),.10,.054,'head',shell)
plate('頭の青緑後端',[(-.085,-.26,.724),(.085,-.26,.724),(.055,-.20,.702),(-.055,-.20,.702)],'head',belly,.009,(0,0,-1))
for s,side in [(-1,'L'),(1,'R')]:
    plate('横長の暗い観測孔'+side,[(s*.092,-.35,.706),(s*.103,-.285,.705),(s*.103,-.285,.684),(s*.092,-.35,.688)],'head',joint,.003,(s,0,0))
    rock('観測レンズ'+side,(s*.104,-.30,.695),(.004,.010,.009),'head',(.10,.28,.30,1),2)
    plate('短い襟ひれ'+side,[(s*.055,-.255,.65),(s*.14,-.17,.60),(s*.095,-.20,.515),(s*.035,-.26,.61)],'fin_'+side,belly,.006,(s,0,0))
# 尾は一枚の扁平な葉形。
plate('一枚の尾',[(-.018,.53,.43),(-.082,.65,.425),(-.062,.77,.40),(0,.83,.395),(.062,.77,.40),(.082,.65,.425),(.018,.53,.43)],'tail',belly,.007,(0,0,-1))
for j in range(2):
    block('白い二本線'+str(j),(-.096,-.228,.602-j*.023),(.023,.005,.005),'fin_L',(.9,.89,.81,1),.002)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
mesh=bpy.context.object;mesh.name='Oriha_Surface'
tri=mesh.modifiers.new('三角形化','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
arm=bpy.data.armatures.new('Oriha_Rig');rig=bpy.data.objects.new('Oriha',arm);bpy.context.collection.objects.link(rig)
mesh.select_set(False);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')


spec={'root':((0,0,0),None)}
for i in range(5):spec['seg'+str(i)]=(points[i],'root' if i==0 else 'seg'+str(i-1))
spec['head']=(points[0],'seg0');spec['tail']=(points[-1],'seg4')
for s,side in [(-1,'L'),(1,'R')]:spec['fin_'+side]=((s*.045,-.25,.64),'head')
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
        current=[points[0]+Vector((.008*w,0,.012*w))]
        rotations=[]
        for i in range(5):
            original=points[i+1]-points[i]
            direction=original.normalized()*(1-a)+Vector((0,1,-.04))*a
            direction.x+=(.17 if name=='Follow' else .08)*math.sin(t*math.tau-i*.8)*(1-.85*a)
            direction.z+=.05*math.sin(t*math.tau-i*.65)*(1-a)
            step=direction.normalized()*original.length
            current.append(current[-1]+step);rotations.append(original.rotation_difference(step))
        pose('root',rest['root'],Quaternion())
        for i in range(5):pose('seg'+str(i),current[i],rotations[i])
        hq=Quaternion((0,0,1),.08*w*(1-a))
        pose('head',current[0],hq)
        pose('tail',current[-1],rotations[-1]@Quaternion((0,1,0),.16*math.sin(t*math.tau-2)*(1-a)))
        for s,side in [(-1,'L'),(1,'R')]:
            n='fin_'+side;pivot=current[0]+hq@(rest[n]-points[0])
            pose(n,pivot,hq@Quaternion((0,1,0),s*(.12*w+.30*a)))
        for p in rig.pose.bones:
            p.keyframe_insert('location',frame=f,group=p.name);p.keyframe_insert('rotation_euler',frame=f,group=p.name)
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
rig.animation_data.action=None
for p in rig.pose.bones:p.location=(0,0,0);p.rotation_euler=(0,0,0)
scene=bpy.context.scene;scene.render.fps=30;scene.frame_end=91;scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'oriha.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS')
stats={'triangles':len(mesh.data.polygons),'materials':1,'bones':len(arm.bones),'textures':0,'height_m':round(mesh.dimensions.z,4),'width_m':round(mesh.dimensions.x,4),'clips':['Idle','Follow','Display'],'blender':bpy.app.version_string}
(OUT/'model-stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
rig.animation_data.action=bpy.data.actions['Idle'];bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'oriha.blend'))
print('BUDDY_STATS',json.dumps(stats))
