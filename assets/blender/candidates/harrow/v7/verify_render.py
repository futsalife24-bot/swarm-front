"""Reopen saved Blender source, inspect bones, then render the reimported runtime GLB."""
import bpy, json, math, hashlib, sys
from pathlib import Path
from mathutils import Vector
P=Path(__file__).resolve().parent
OUT=P.parents[4]/'dist-validation'/'harrow-v7'
OUT.mkdir(parents=True,exist_ok=True)
build=json.loads((P/'build-report.json').read_text())
report={'blend_sha256':hashlib.sha256((P/'harrow.blend').read_bytes()).hexdigest(),'glb_sha256':hashlib.sha256((P/'harrow.glb').read_bytes()).hexdigest(),'checks':{}}
def check(label):
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
 unweighted=sum(1 for o in meshes for v in o.data.vertices if sum(g.weight for g in v.groups)<.999)
 assert unweighted==0 and len(rig.data.bones)==39
 result={'meshes':len(meshes),'bones':39,'unweighted':unweighted,'clips':{}}
 for clip,duration in build['clips'].items():
  action=bpy.data.actions.get(clip);assert action,clip
  rig.animation_data_create();rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
  for tr in rig.animation_data.nla_tracks:tr.mute=True
  initial=None;root_error=0.;joint_gap=0.
  for f in range(round(duration*40)+1):
   bpy.context.scene.frame_set(f);bpy.context.view_layer.update()
   values=[v for b in rig.pose.bones for row in b.matrix for v in row];assert all(math.isfinite(v) for v in values)
   if initial is None:initial=values
   root=rig.pose.bones['Root'];root_error=max(root_error,max(abs(root.matrix[i][j]-root.bone.matrix_local[i][j]) for i in range(4) for j in range(4)))
   for name in ('Forelimb.L','Forelimb.R','Hindlimb.L','Hindlimb.R'):
    joint_gap=max(joint_gap,(rig.pose.bones[name+'.2'].tail-rig.pose.bones[name+'.3'].head).length)
  seam=max(abs(a-b) for a,b in zip(initial,values))
  if clip in ('Idle','Locomotion','Attack','Threat','Spin','Flight','Glide'):assert seam<1e-4,(label,clip,seam)
  assert root_error<1e-5,(clip,root_error)
  assert joint_gap<.001,(clip,joint_gap)
  result['clips'][clip]={'frames':round(duration*40)+1,'root_error':root_error,'limb_joint_gap':joint_gap,'endpoint_delta':seam}
 report['checks'][label]=result
 return rig
bpy.ops.wm.open_mainfile(filepath=str(P/'harrow.blend'));check('source_reopened')
for o in list(bpy.context.scene.objects):
 if o.type=='ARMATURE' or (o.type=='MESH' and o.name!='Studio ground'):bpy.data.objects.remove(o,do_unlink=True)
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.import_scene.gltf(filepath=str(P/'harrow.glb'));rig=check('runtime_glb_reimported')
(OUT/'saved-validation.json').write_text(json.dumps(report,indent=2))
print('HARROW_V7_SAVED_PASS',json.dumps({k:list(v['clips']) for k,v in report['checks'].items()}))
if '--validate-only' in sys.argv:sys.exit(0)
s=bpy.context.scene;s.render.resolution_x=960;s.render.resolution_y=720;s.cycles.samples=8;s.render.threads_mode='FIXED';s.render.threads=2
poses=[('idle','Idle',0,'hero'),('spin','Spin',3.15,'hero'),('spin-front','Spin',3.15,'front'),('flight','Flight',1.05,'hero'),('glide','Glide',1.05,'side'),('dive','Dive',1.4,'side'),('stagger','StaggerFall',1.3125,'hero'),('launchers','Threat',3.5,'hero')]
for name,clip,t,cam in poses:
 rig.animation_data.action=bpy.data.actions[clip];rig.animation_data.action_slot=rig.animation_data.action.slots[0]
 for tr in rig.animation_data.nla_tracks:tr.mute=True
 s.frame_set(round(t*40));s.camera=bpy.data.objects[cam];s.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
(OUT/'saved-validation.json').write_text(json.dumps(report,indent=2))
print('HARROW_V7_SAVED_PASS',json.dumps({k:list(v['clips']) for k,v in report['checks'].items()}))
