"""前版との形状差と、全クリップの頭の向きの一致を確認。"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Quaternion
out=Path(__file__).resolve().parent
def collect(folder):
    bpy.ops.wm.open_mainfile(filepath=str(folder/'yosuga.blend'))
    mesh=bpy.data.objects['Yosuga_Surface'];rig=bpy.data.objects['Yosuga']
    groups={}
    for name in ['head','body']:
        i=mesh.vertex_groups[name].index
        groups[name]=[mesh.matrix_world@v.co.copy() for v in mesh.data.vertices if any(g.group==i and g.weight>.99 for g in v.groups)]
    rotations=[]
    for name in ['Idle','Follow','Display']:
        a=bpy.data.actions[name];rig.animation_data.action=a
        if a.slots:rig.animation_data.action_slot=a.slots[0]
        for f in range(1,int(a.frame_range[1])+1):
            bpy.context.scene.frame_set(f);bpy.context.view_layer.update()
            rotations.append(rig.pose.bones['head'].matrix.to_quaternion().copy())
    return groups,rotations
old,oldrot=collect(out.parent/'yosuga-lowpoly-v4')
new,newrot=collect(out)
lean=Quaternion((1,0,0),math.radians(15));waist=Vector((0,0,.3));lower=Vector((0,0,-.012))
def move(p):return waist+lower+lean@(p-waist)
head_shift=move(Vector((0,.01,.49)))-Vector((0,.01,.49))
assert len(old['head'])==len(new['head']) and len(old['body'])==len(new['body'])
head_error=max((b-a-head_shift).length for a,b in zip(old['head'],new['head']))
body_error=max((b-move(a)).length for a,b in zip(old['body'],new['body']))
angle=max(a.rotation_difference(b).angle for a,b in zip(oldrot,newrot))
assert head_error<1e-6 and body_error<1e-6 and angle<.001,(head_error,body_error,angle)
result={'body_forward_degrees':15,'head_translation_m':list(head_shift),'head_vertex_translation_max_error_m':head_error,'body_vertex_transform_max_error_m':body_error,'animation_head_orientation_max_delta_degrees':math.degrees(angle),'frames_checked':len(oldrot)}
(out/'review'/'posture-check.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
