import bpy,json,math
from pathlib import Path
out=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(out/'oriha.glb'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
a=bpy.data.actions['Coil'];rig.animation_data_create();rig.animation_data.action=a
if a.slots:rig.animation_data.action_slot=a.slots[0]
names=['tail','seg4','seg3','seg2','seg1','seg0']
bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
initial={n:rig.pose.bones[n].matrix.to_quaternion().copy() for n in names}
onset={};rotations=[]
for frame in range(1,122):
    bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
    for n in names:
        angle=math.degrees(initial[n].rotation_difference(rig.pose.bones[n].matrix.to_quaternion()).angle)
        if angle>1 and n not in onset:onset[n]=frame
assert all(onset[names[i]]<onset[names[i+1]] for i in range(5)),onset
loop=max(math.degrees(initial[n].rotation_difference(rig.pose.bones[n].matrix.to_quaternion()).angle) for n in names)
assert loop<.1,loop
result={'motion':'Coil','threshold_degrees':1,'first_rotation_frame':onset,'tail_to_body_order_verified':True,'loop_rotation_max_error_degrees':loop,'fps':30}
(out/'review'/'coil-order.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
