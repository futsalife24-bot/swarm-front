"""Report candidate arm trajectories in runtime metres; not a collision test."""
import bpy,json,math
from pathlib import Path
from mathutils import Matrix
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-switch-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
basis=Matrix(((-1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))@rig.matrix_world
rows=[]
for name in ['Soldier_Weapon_Switch','Soldier_Weapon_Switch_Back']:
 a=bpy.data.actions[name];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
 start,end=a.frame_range
 for t in [0,.15,.3,.45,.525,.6,.75,.9,1]:
  f=start+(end-start)*t;s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
  chest=basis@rig.pose.bones['chest'].head
  rows.append({'action':name,'fraction':t,'chestRelative':{n:[round(v,4) for v in basis@rig.pose.bones[n].head-chest] for n in ['upper_arm.R','lower_arm.R','hand.R','RightHandWeaponSocket','BackWeaponSocket','BackWeaponSocket_2']}})
result={'scope':'Diagnostic joint coordinates only. Torso, vest and weapon surface clearance are not tested.','samples':rows}
(p/'switch-path-inspection.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result),flush=True)
