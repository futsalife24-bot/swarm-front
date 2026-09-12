"""Supplement: same reach pose, occluding torso/other weapon hidden explicitly."""
import bpy,importlib.util,math
from pathlib import Path
from mathutils import Vector,Quaternion
Q=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('poses',Q/'render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p)
for label,n,kind in [('reach_rifle','BackWeaponSocket','rifle'),('reach_rocket','BackWeaponSocket_2','rocket')]:
 p.sample('Weapon_Idle_Rifle',0);gun=p.rig.pose.bones[n].matrix.copy();target=gun@Vector((.071,0,.005));p.arm_to('R',target,gun.to_quaternion()@Quaternion((0,0,1),math.pi/2),Vector((.5,-.25,1.4)))
 for finger in ['Index','Middle','Ring','Little','Thumb']:
  for k in range(1,4):
   b=p.rig.pose.bones[f'{finger}{k}_R'];b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion((1,0,0),.6)
 bpy.context.view_layer.update()
 for o in bpy.data.objects:
  if o.type=='MESH':o.hide_render=o.name not in ['Study_Glove_R','Trial_Forearm_R','Weapon_'+kind]
 o=p.weapons[kind];o.matrix_world=p.rig.matrix_world@gun
 p.render(label+'_cutaway',target+Vector((-.65,.45,.2)),target+Vector((0,.03,0)),.45)
