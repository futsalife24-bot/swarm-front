"""Use the visually reviewed close back anchors with the low evasive step."""
import bpy,json
from pathlib import Path
from mathutils import Matrix,Vector
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-low-evade-candidate.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for t in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(t)
rig.animation_data.action=None
def m(v):return Matrix([v[i:i+4] for i in range(0,16,4)]).transposed()
data=json.loads((p/'low-evade-mounts.json').read_text())
chest=m(data['idleChest'])
mounts=data['mounts']
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for n,row in mounts.items():
 frame=m(row['idleWorldMatrix'])
 # Measured on the low step at 25/50/75%: the left shotgun stock clips the
 # waist without this 4 cm clearance. Do not move the already-clear right slot.
 if n=='BackWeaponSocket_2':frame.translation+=Vector((0,0,.04))
 rig.data.edit_bones[n].matrix=rig.data.edit_bones['chest'].matrix@chest.inverted()@frame
bpy.ops.object.mode_set(mode='OBJECT')
for action in bpy.data.actions:
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in list(bag.fcurves):
     if any('pose.bones["'+n+'"]' in curve.data_path for n in mounts):bag.fcurves.remove(curve)
for n in mounts:
 b=rig.pose.bones[n];b.location=(0,0,0);b.rotation_quaternion=(1,0,0,0);b.scale=(1,1,1)
bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-low-evade-mounted.blend'))
