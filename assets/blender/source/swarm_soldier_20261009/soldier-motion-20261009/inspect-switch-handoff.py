"""Measure authored weapon-origin discontinuity at runtime handoff fractions."""
import bpy,json,math,sys,hashlib
from pathlib import Path
p=Path(__file__).resolve().parent
exported='--exported' in sys.argv
if exported:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(p/'switch-preview/swarm-soldier.glb'))
else:bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-reload-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
report=[]
for name,backs in [('Weapon_Switch',['BackWeaponSocket','BackWeaponSocket_2']),('Weapon_Switch_Back',['BackWeaponSocket_2','BackWeaponSocket'])]:
 actionName=({'Weapon_Switch':'Trial_Switch_1_to_2','Weapon_Switch_Back':'Trial_Switch_2_to_1'}[name] if exported else 'Soldier_'+name)
 action=bpy.data.actions[actionName];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 start,end=action.frame_range
 for t,back in zip([.45,.6],backs):
  f=start+(end-start)*t;s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
  hand=rig.matrix_world@rig.pose.bones['RightHandWeaponSocket'].matrix;target=rig.matrix_world@rig.pose.bones[back].matrix
  angle=math.degrees(hand.to_quaternion().rotation_difference(target.to_quaternion()).angle)
  report.append({'action':name,'fraction':t,'back':back,'originGapMetres':(hand.translation-target.translation).length,'rotationGapDegrees':min(angle,360-angle)})
result={'scope':'Authored socket frames only; runtime blending and attachment scale need visual validation.','events':report}
if exported:result['sha256']=hashlib.sha256((p/'switch-preview/swarm-soldier.glb').read_bytes()).hexdigest()
(p/('switch-handoff-exported.json' if exported else 'switch-handoff-before.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
if exported:assert all(row['originGapMetres']<.002 and row['rotationGapDegrees']<1 for row in report)
