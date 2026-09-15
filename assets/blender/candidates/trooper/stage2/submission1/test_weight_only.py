"""Try a local weight-only repair before changing any rest bones."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q.parent/'stage1/trooper_anatomy_stage1.blend'))
s=bpy.context.scene;rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='POSE';rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def weights_for(p,side):
 sgn=-1 if side=='L' else 1;ax=p.x*sgn
 # Continuous gradients through MCP, PIP and DIP; no nearest-finger jumping.
 centers=[.374,.391,.408,.425];index=min(range(4),key=lambda i:abs(ax-centers[i]));finger=['Index','Middle','Ring','Little'][index]
 if ax<.364 and p.z<.87:finger='Thumb'
 if finger=='Thumb':
  b=rig.data.bones['Thumb1_'+side];a=b.head_local;end=rig.data.bones['Thumb3_'+side].tail_local;u=(p-a).dot((end-a).normalized());keys=[(-.014,'Hand_'+side),(.011,'Thumb1_'+side),(.035,'Thumb2_'+side),(.057,'Thumb3_'+side)]
 else:
  u=.841-p.z;lens=[.95,1,.94,.78][index];keys=[(0,'Hand_'+side),(.025*lens,finger+'1_'+side),(.05*lens,finger+'2_'+side),(.072*lens,finger+'3_'+side)]
 if u<=keys[0][0]:return {keys[0][1]:1}
 if u>=keys[-1][0]:return {keys[-1][1]:1}
 for (a,na),(b,nb) in zip(keys,keys[1:]):
  if a<=u<=b:
   t=smooth((u-a)/(b-a));return {na:1-t,nb:t}
for side in ['L','R']:
 o=bpy.data.objects['Study_Glove_'+side];anchor=rig.data.bones['Hand_'+side].head_local;o.vertex_groups.clear()
 for v in o.data.vertices:
  d=v.co-anchor;p=anchor+Vector((d.x/1.24,d.y/1.22,d.z/1.32))
  for n,w in weights_for(p,side).items():
   if w>1e-7:(o.vertex_groups.get(n) or o.vertex_groups.new(name=n)).add([v.index],w,'REPLACE')
 for b in rig.pose.bones:
  if b.name.endswith('_'+side) and b.name.startswith(('Thumb','Index','Middle','Ring','Little')):b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion((1,0,0),.78*.65 if 'Thumb' in b.name else .78)
bpy.context.view_layer.update();s.render.resolution_x=700;s.render.resolution_y=700;s.cycles.samples=24
cam=s.camera;cam.data.ortho_scale=.3;target=Vector((-.39,.05,.815));cam.location=(-1.7,3,.99);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(Q/'diagnostic_weight_only.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(Q/'weight_only_diagnostic.blend'))
