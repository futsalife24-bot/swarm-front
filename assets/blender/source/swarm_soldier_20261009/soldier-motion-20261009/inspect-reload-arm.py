import bpy,json,math
from pathlib import Path
from mathutils import Matrix
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-sling-motion-candidate.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
basis=Matrix(((-1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))
report={}
for profile in ['Rifle','Shotgun','Rocket']:
 a=bpy.data.actions['Soldier_'+profile+'_Reload'];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
 start,end=a.frame_range;rows=[]
 for t in [0,.18,.38,.57,.75,1]:
  f=start+(end-start)*t;bpy.context.scene.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
  rows.append({'t':t,'points':{n:[round(x,4) for x in basis@rig.matrix_world@rig.pose.bones[n].head] for n in ['chest','upper_arm.L','lower_arm.L','hand.L','RightHandWeaponSocket']}})
 report[profile]=rows
(p/'reload-arm-inspection.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report['Rocket']),flush=True)
