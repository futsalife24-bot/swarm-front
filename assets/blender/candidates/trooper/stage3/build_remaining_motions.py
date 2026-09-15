"""Practical SF motion pass. Preserve originals; bake candidate actions and isolated GLB."""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion
Q=Path(__file__).resolve().parent
OUT=Q.parent/'stage4';OUT.mkdir(exist_ok=True)
SOURCE=Q/'experiments/rocket_x_0325_route3/trooper_stage3_animated.blend'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
s=bpy.context.scene;rig=bpy.data.objects['STANDARD_TROOPER_RIG']
for t in rig.animation_data.nla_tracks:t.mute=True
def hashes():
 result={}
 for a in bpy.data.actions:
  if a.name.startswith('Trial_'):continue
  rows=[]
  for l in a.layers:
   for st in l.strips:
    for bag in st.channelbags:
     for fc in bag.fcurves:rows.append((fc.data_path,fc.array_index,[(list(k.co),list(k.handle_left),list(k.handle_right),k.interpolation) for k in fc.keyframe_points]))
  result[a.name]=hashlib.sha256(json.dumps(rows).encode()).hexdigest()
 return result
original=hashes();binds={b.name:[list(r) for r in b.matrix_local] for b in rig.data.bones}
def sample(name,f):
 rig.animation_data.action=None
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 rig.animation_data.action=bpy.data.actions[name];s.frame_set(int(f),subframe=f-int(f));bpy.context.view_layer.update()
 result={b.name:b.matrix_basis.copy() for b in rig.pose.bones};rig.animation_data.action=None
 return result
def restore(pose):
 for n,m in pose.items():rig.pose.bones[n].matrix_basis=m
 bpy.context.view_layer.update()
profiles={'rifle':sample('Trial_Switch_1_to_2',0),'rocket':sample('Trial_Switch_1_to_2',60)}
profiles['shotgun']={n:m.copy() for n,m in profiles['rifle'].items()}
bases={k:sample('Weapon_Idle_'+k.title(),0) for k in profiles}
upper=lambda n:n.startswith(('Clavicle','UpperArm','LowerArm','Hand','Thumb','Index','Middle','Ring','Little')) or n in ['RightHandWeaponSocket','LeftHandSupportSocket']
def back_rest():
 for n in ['BackWeaponSocket','BackWeaponSocket_2']:
  rig.pose.bones[n].matrix=rig.pose.bones['Chest'].matrix@rig.data.bones['Chest'].matrix_local.inverted()@rig.data.bones[n].matrix_local
 bpy.context.view_layer.update()
def bake(name,frames,poses):
 a=bpy.data.actions.new(name);a.use_fake_user=True;previous={}
 for f,pose in zip(range(frames+1),poses):
  rig.animation_data.action=None;restore(pose);back_rest();p={b.name:b.matrix_basis.copy() for b in rig.pose.bones};rig.animation_data.action=a
  for n,m in p.items():
   b=rig.pose.bones[n];loc,rot,sc=m.decompose()
   if n in previous and rot.dot(previous[n])<0:rot.negate()
   previous[n]=rot.copy();b.rotation_mode='QUATERNION';b.location=loc;b.rotation_quaternion=rot;b.scale=sc
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(prop,frame=f,group=n)
 for l in a.layers:
  for st in l.strips:
   for bag in st.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
 t=rig.animation_data.nla_tracks.new();t.name=name;t.strips.new(name,0,a);t.mute=True;rig.animation_data.action=None
 print('MOTION BAKED',name,frames,flush=True)
 return a
manifest=[]
for name in list(original):
 if name.startswith('Switch_'):continue
 kind='rocket' if name.endswith('Rocket') else 'shotgun' if name.endswith('Shotgun') else 'rifle'
 count=round(bpy.data.actions[name].frame_range[1]);poses=[]
 for f in range(count+1):
  src=sample(name,f);dst={n:m.copy() for n,m in src.items()}
  for n in dst:
   if upper(n):dst[n]=profiles[kind][n].copy()
   elif n in ['Spine','SpineMid','Chest','Neck','Head']:dst[n]=profiles[kind][n]@bases[kind][n].inverted()@src[n]
  poses.append(dst)
 bake('Trial_'+name,count,poses)
 manifest.append({'name':'Trial_'+name,'weapon':kind,'duration':count/60,'loop':name.startswith(('Idle','Weapon_Idle','Run')),'source':name})
# SF reload: weapon stays in right hand; support hand works the feed/energy unit.
# Deliberately no individual loose magazines, cartridges or shell simulation.
def left_to(target):
 a=rig.pose.bones['UpperArm_L'].head.copy();old=rig.pose.bones['LowerArm_L'].head.copy();l1=rig.data.bones['UpperArm_L'].length;l2=rig.data.bones['LowerArm_L'].length
 d=target-a;length=min(d.length,l1+l2-.0001);axis=d.normalized();along=(l1*l1-l2*l2+length*length)/(2*length);height=math.sqrt(max(0,l1*l1-along*along));pole=old-a;pole=(pole-axis*pole.dot(axis)).normalized();elbow=a+axis*along+pole*height
 hand=rig.pose.bones['Hand_L'].matrix.copy()
 for n,start,end in [('UpperArm_L',a,elbow),('LowerArm_L',elbow,a+axis*length)]:
  rest=rig.data.bones[n].matrix_local;rot=(rest.to_3x3()@Vector((0,1,0))).rotation_difference(end-start)
  mat=rot.to_matrix().to_4x4()@rest.to_3x3().to_4x4();mat.translation=start;rig.pose.bones[n].matrix=mat;bpy.context.view_layer.update()
 hand.translation=a+axis*length;rig.pose.bones['Hand_L'].matrix=hand;bpy.context.view_layer.update()
for kind,duration in [('rifle',1.65),('shotgun',2.1),('rocket',2.7)]:
 count=round(duration*60);poses=[]
 for f in range(count+1):
  t=f/count;restore(profiles[kind]);start=rig.pose.bones['Hand_L'].head.copy();gun=rig.pose.bones['RightHandWeaponSocket'].matrix.copy()
  w=math.sin(math.pi*min(1,max(0,(t-.12)/.76)))**2
  target=gun@Vector((-.055,.025,-.14 if kind!='rocket' else -.10))
  target.z+=.022*math.sin(t*math.pi*(8 if kind=='shotgun' else 4))*w
  left_to(start.lerp(target,w))
  for b in rig.pose.bones:
   if b.name.endswith('_L') and b.name.startswith(('Index','Middle','Ring','Little','Thumb')):
    loc,q,sc=b.matrix_basis.decompose();b.matrix_basis=Matrix.LocRotScale(loc,q.slerp(Quaternion(),w*.18),sc)
  bpy.context.view_layer.update();poses.append({b.name:b.matrix_basis.copy() for b in rig.pose.bones})
 bake('Trial_Reload_'+kind.title(),count,poses);manifest.append({'name':'Trial_Reload_'+kind.title(),'weapon':kind,'duration':duration,'loop':False,'source':'new SF feed-unit gesture'})
for name in ['Trial_Switch_1_to_2','Trial_Switch_2_to_1']:manifest.append({'name':name,'weapon':'rifle' if name.endswith('1_to_2') else 'rocket','duration':1,'runtimeDuration':.5,'loop':False,'events':{'holster':.45,'draw':.60}})
assert hashes()==original and binds=={b.name:[list(r) for r in b.matrix_local] for b in rig.data.bones}
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();s.render.fps=60;s.frame_start=0;s.frame_end=180
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'trooper_stage4_candidate.blend'))
# Original tracks remain in saved .blend. Export selection contains trial clips only.
for t in list(rig.animation_data.nla_tracks):
 if not t.name.startswith('Trial_'):rig.animation_data.nla_tracks.remove(t)
bpy.ops.object.select_all(action='DESELECT');rig.hide_set(False);rig.select_set(True);bpy.context.view_layer.objects.active=rig
selected=[]
for o in s.objects:
 if o.type=='MESH' and not o.hide_render and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers):o.hide_set(False);o.select_set(True);selected.append(o.name)
bpy.ops.export_scene.gltf(filepath=str(OUT/'trooper_stage4_candidate.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_vertex_color='ACTIVE',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False)
data=(OUT/'trooper_stage4_candidate.glb').read_bytes();doc=json.loads(data[20:20+int.from_bytes(data[12:16],'little')]);names=[a['name'] for a in doc['animations']]
assert set(names)=={x['name'] for x in manifest},names
assert all(len(x['joints'])==57 for x in doc['skins'])
report={'originalActionsPreserved':original,'bindsUnchangedFromApprovedStage3':True,'clips':manifest,'exportedMeshes':selected,'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),'bytes':len(data),'bones':57,'criterion':'normal speed and game scale; isolated transient intersections accepted','limitations':['Reload is an SF feed-unit gesture, not individual cartridge or magazine simulation.','Representative slot assignment rifle/shotgun slot 0, rocket slot 1; arbitrary reversed loadouts not tested.','No game main files, collision scale or production changes.']}
(OUT/'motion-manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('ALL MOTIONS AND EXPORT COMPLETE',len(names),report['triangles'],flush=True)
