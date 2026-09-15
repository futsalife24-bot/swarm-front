"""Wider, staggered aiming stance; preserve v6 locomotion and upper-body grips."""
import bpy, math, json, struct, copy, hashlib
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'assets/blender/candidates/trooper/stance-v7';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/candidates/trooper/run-v6/trooper_run_v6.blend'))
rig=bpy.data.objects['STANDARD_TROOPER_RIG'];scene=bpy.context.scene
for track in rig.animation_data.nla_tracks:track.mute=True
rest={b.name:b.matrix_local.copy() for b in rig.data.bones}
names=['Trial_Idle','Trial_Weapon_Idle_Rifle','Trial_Weapon_Idle_Shotgun','Trial_Weapon_Idle_Rocket']
frames=60

def curve(t,keys):
 for (a,x,m),(b,y,n) in zip(keys,keys[1:]):
  if a<=t<=b:
   u=(t-a)/(b-a)
   return (2*u**3-3*u*u+1)*x+(u**3-2*u*u+u)*(b-a)*m+(-2*u**3+3*u*u)*y+(u**3-u*u)*(b-a)*n
 return keys[-1][1]

def setm(n,m):
 rig.pose.bones[n].matrix=m;bpy.context.view_layer.update()

def around(p,q):return Matrix.Translation(p)@q.to_matrix().to_4x4()@Matrix.Translation(-p)

def sample(action,f):
 rig.animation_data.action=None
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 rig.animation_data.action=action;scene.frame_set(int(f),subframe=f-int(f));bpy.context.view_layer.update()
 result={b.name:b.matrix.copy() for b in rig.pose.bones};rig.animation_data.action=None
 return result

# Sole points in armature space, including toe-bound geometry.
soles={s:[] for s in ['L','R']}
for o in scene.objects:
 if o.type!='MESH' or o.hide_render:continue
 groups={g.index:g.name for g in o.vertex_groups}
 for v in o.data.vertices:
  for s in soles:
   if any(groups[g.group] in ['Foot_'+s,'Toe_'+s] and g.weight>.5 for g in v.groups):soles[s].append(o.matrix_world@v.co)
assert all(soles.values())

report={'clips':{},'ankleWidth':.54,'foreAftStagger':.14}
for name in names:
 old=bpy.data.actions[name];duration=old.frame_range[1]
 source=[sample(old,f/frames*duration) for f in range(frames+1)]
 old.name='PreviousV6_'+name
 for track in list(rig.animation_data.nla_tracks):
  if track.name==name:rig.animation_data.nla_tracks.remove(track)
 action=bpy.data.actions.new(name);action.use_fake_user=True;previous={}
 for f in range(frames+1):
  src=source[f]
  for n,m in src.items():setm(n,m)
  pelvis=src['Pelvis'].copy();pelvis.translation.z-=.035;setm('Pelvis',pelvis)
  for side in ['L','R']:
   sign=-1 if side=='L' else 1
   ankle=rest['Foot_'+side].translation
   rotation=Quaternion((0,0,1),-sign*.10).to_matrix()
   bottom=min((rotation@(p-ankle)).z for p in soles[side])
   foot=Vector((sign*.27,-sign*.07,-bottom+.002))
   hip=rig.pose.bones['UpperLeg_'+side].head.copy()
   l1=rig.data.bones['UpperLeg_'+side].length;l2=rig.data.bones['LowerLeg_'+side].length
   d=foot-hip;length=d.length;assert length<l1+l2
   axis=d.normalized();along=(l1*l1-l2*l2+length*length)/(2*length);h=math.sqrt(max(0,l1*l1-along*along))
   pole=Vector((sign*.2,1,0));pole=(pole-axis*pole.dot(axis)).normalized()
   knee=hip+axis*along+pole*h
   for n,a,b in [('UpperLeg_'+side,hip,knee),('LowerLeg_'+side,knee,foot)]:
    r=rest[n].to_3x3();setm(n,Matrix.Translation(a)@(r@Vector((0,1,0))).rotation_difference(b-a).to_matrix().to_4x4()@r.to_4x4())
   fm=Matrix.Translation(foot)@rotation.to_4x4()@rest['Foot_'+side].to_3x3().to_4x4();setm('Foot_'+side,fm)
   setm('Toe_'+side,fm@rest['Foot_'+side].inverted()@rest['Toe_'+side])
  pose={b.name:b.matrix_basis.copy() for b in rig.pose.bones}
  rig.animation_data.action=action
  for n,m in pose.items():
   b=rig.pose.bones[n];loc,rot,scale=m.decompose()
   if n in previous and rot.dot(previous[n])<0:rot.negate()
   previous[n]=rot.copy();b.rotation_mode='QUATERNION';b.location=loc;b.rotation_quaternion=rot;b.scale=scale
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(prop,frame=f/frames*duration,group=n)
  rig.animation_data.action=None
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
 track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
 report['clips'][name]={'duration':duration/60};print('BAKED',name,flush=True)

rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
scene.render.fps=60;bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'trooper_stance_v7.blend'))
for track in list(rig.animation_data.nla_tracks):
 if track.name not in names:rig.animation_data.nla_tracks.remove(track)
bpy.ops.object.select_all(action='DESELECT');rig.hide_set(False);rig.select_set(True);bpy.context.view_layer.objects.active=rig
for o in scene.objects:
 if o.type=='MESH' and not o.hide_render and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers):o.hide_set(False);o.select_set(True)
temp=OUT/'stance_export.glb'
bpy.ops.export_scene.gltf(filepath=str(temp),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False)

# Transplant animation accessors only: retain v6 geometry, materials, skeleton,
# sockets, textures and all 14 other clips byte-for-byte.
def read_glb(path):
 data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size]);return doc,data[28+size:]
doc,binary=read_glb(ROOT/'public/assets/characters/standard_trooper_v6.glb');new,nb=read_glb(temp)
original=copy.deepcopy(doc);offset=len(binary);binary+=nb;av=len(doc['accessors']);bv=len(doc['bufferViews'])
for view in new['bufferViews']:
 v=copy.deepcopy(view);v['byteOffset']=v.get('byteOffset',0)+offset;doc['bufferViews'].append(v)
for accessor in new['accessors']:
 a=copy.deepcopy(accessor)
 if 'bufferView' in a:a['bufferView']+=bv
 assert 'sparse' not in a
 doc['accessors'].append(a)
nodeIds={n.get('name'):i for i,n in enumerate(doc['nodes'])}
for animation in new['animations']:
 assert animation['name'] in names
 for sampler in animation['samplers']:sampler['input']+=av;sampler['output']+=av
 for channel in animation['channels']:channel['target']['node']=nodeIds[new['nodes'][channel['target']['node']]['name']]
 index=next(i for i,a in enumerate(doc['animations']) if a['name']==animation['name']);doc['animations'][index]=animation
assert all(doc[k]==original[k] for k in ['meshes','nodes','skins','materials','textures','images'])
assert all(a==doc['animations'][i] for i,a in enumerate(original['animations']) if a['name'] not in names)
doc['buffers'][0]['byteLength']=len(binary);js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary+=b'\0'*((-len(binary))%4)
result=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
target=ROOT/'public/assets/characters/standard_trooper_v7.glb';target.write_bytes(result)
report.update({'geometrySkeletonMaterialsUnchanged':True,'other14ClipsUnchanged':True,'sha256':hashlib.sha256(result).hexdigest()})
(OUT/'build-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
