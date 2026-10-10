"""Render actual historical models together; no generative image replacement."""
import bpy,math,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
root=Path.cwd(); out=root/'evidence/soldier-motion-20261009/comparison';out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=2400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.28,.28,.28);scene.view_settings.view_transform='AgX'
sources=[('初期兵士','最初の簡易図形',root/'test-results/soldier-comparison/initial.glb'),('現行兵士','今回の変更前 · v10',root/'public/assets/characters/standard_trooper_v10.glb'),('最新兵士（今回）','参照画像から制作した兵士',root/'public/assets/characters/swarm-soldier.glb')]
records=[]
for i,(name,detail,path) in enumerate(sources):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));objects=set(bpy.data.objects)-before
 for o in objects:
  o.animation_data_clear()
  if o.type=='ARMATURE':
   o.data.pose_position='POSE'
   for b in o.pose.bones:b.matrix_basis=Matrix.Identity(4)
   bpy.context.view_layer.update()
   for side in ['L','R']:
    upper=o.pose.bones.get('UpperArm_'+side)
    if not upper:continue
    sign=1 if (o.matrix_world@upper.head).x>0 else -1
    for bone_name,nextname in [('UpperArm','LowerArm'),('LowerArm','Hand')]:
     bone=o.pose.bones[bone_name+'_'+side];end=o.pose.bones[nextname+'_'+side]
     direction=(o.matrix_world.to_3x3()@(end.head-bone.head)).normalized()
     q=direction.rotation_difference(Vector((sign,0,0)));worldq=o.matrix_world.to_quaternion()
     localq=worldq.inverted()@q@worldq
     bone.matrix=Matrix.LocRotScale(bone.matrix.translation,localq@bone.matrix.to_quaternion(),bone.matrix.to_scale())
     bpy.context.view_layer.update()
 bpy.context.view_layer.update()
 deps=bpy.context.evaluated_depsgraph_get();coords=[]
 for o in objects:
  if o.type!='MESH' or o.hide_render or not o.visible_get():continue
  evaluated=o.evaluated_get(deps);mesh=evaluated.to_mesh()
  used={j for face in mesh.polygons if face.area>1e-12 for j in face.vertices}
  points=[evaluated.matrix_world@mesh.vertices[j].co for j in used]
  print('描画面の範囲',name,o.name,len(used),min(p.z for p in points),max(p.z for p in points),flush=True)
  coords.extend(points);evaluated.to_mesh_clear()
 lo=Vector(tuple(min(v[n] for v in coords) for n in range(3)));hi=Vector(tuple(max(v[n] for v in coords) for n in range(3)))
 scale=1.85/(hi.z-lo.z);holder=bpy.data.objects.new(name,None);scene.collection.objects.link(holder)
 for o in objects:
  if o.parent not in objects:o.parent=holder
 holder.scale=(scale,scale,scale);holder.location=((1-i)*2.9-(lo.x+hi.x)*scale/2,-(lo.y+hi.y)*scale/2,-lo.z*scale)
 records.append({'name':name,'file':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'heightBefore':hi.z-lo.z,'displayHeight':1.85,'pose':'common T pose'})
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*color,1);return m
floor=mat('比較用の床',(.13,.16,.18));ink=mat('見出し',(.012,.022,.028));muted=mat('補足',(.04,.07,.085))
for material,color in [(ink,(.9,.94,.97,1)),(muted,(.65,.78,.83,1))]:
 shader=material.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=color;shader.inputs['Emission Color'].default_value=color;shader.inputs['Emission Strength'].default_value=.8
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));bpy.context.object.data.materials.append(floor)
font=bpy.data.fonts.load('C:/Windows/Fonts/meiryo.ttc')
def label(text,x,z,size,material):
 curve=bpy.data.curves.new(text,'FONT');curve.body=text;curve.font=font;curve.align_x='CENTER';curve.size=size;curve.extrude=0
 obj=bpy.data.objects.new(text,curve);scene.collection.objects.link(obj);obj.location=(x,0,z);obj.rotation_euler=(math.pi/2,0,math.pi);obj.data.materials.append(material)
for i,(name,detail,_) in enumerate(sources):
 label(name,(1-i)*2.9,2.43,.21,ink);label(detail,(1-i)*2.9,2.19,.10,muted)
label('同じTポーズ・表示身長・カメラ・照明で実モデルを比較',0,.03,.12,ink)
bpy.data.objects['同じTポーズ・表示身長・カメラ・照明で実モデルを比較'].location.y=2.7
bpy.ops.object.light_add(type='SUN',location=(0,3,6));sun=bpy.context.object;sun.data.energy=2.1;sun.rotation_euler=(math.radians(-30),math.radians(15),0);sun.data.angle=.15
bpy.ops.object.light_add(type='AREA',location=(0,4,5));light=bpy.context.object;light.data.energy=500;light.data.shape='DISK';light.data.size=12;light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,10,3.2));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1.1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=9.4;scene.camera=camera
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/'soldier-generations.png')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'test-results/soldier-comparison/three-generations.blend'))
bpy.ops.render.render(write_still=True)
(out/'sources.json').write_text(json.dumps({'models':records,'conditions':'共通のTポーズ、表示身長1.85m、正投影カメラ、共通照明。初期図形は固定腕、他は既存の骨の回転でTポーズへ揃え、武器は非表示。形状やテクスチャの生成置換なし。'},ensure_ascii=False,indent=2),encoding='utf-8')
