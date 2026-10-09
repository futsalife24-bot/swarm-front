import bpy,math,json,hashlib
from pathlib import Path
from mathutils import Vector
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-polished-candidate.blend'))
s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(r.animation_data.nla_tracks):r.animation_data.nla_tracks.remove(tr)
parts=[bpy.data.objects[n] for n in ['Body','Head']];report={}
# Fractional keys keep fast roll and sprint interpolation above the floor.
# Preserve authored airtime; only lift an actual intersection.
for name in ['Down','Dodge_Roll','Jump_Start','Jump_Land','Walk','Sprint']:
 a=bpy.data.actions['Soldier_'+name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];samples=[]
 for quarter in range(round(a.frame_range[0]*4),round(a.frame_range[1]*4)+1):
  f=quarter/4;s.frame_set(math.floor(f),subframe=f%1);dg=bpy.context.evaluated_depsgraph_get();low=float('inf')
  for part in parts:
   obj=part.evaluated_get(dg);mesh=obj.to_mesh();low=min(low,min((obj.matrix_world@v.co).z for v in mesh.vertices));obj.to_mesh_clear()
  hip=r.pose.bones['hips'];basis=(r.matrix_world@hip.parent.matrix).to_quaternion()@(hip.parent.bone.matrix_local.inverted()@hip.bone.matrix_local).to_quaternion()
  lift=max(0,.004-low);samples.append((f,hip.location.copy()+basis.inverted()@Vector((0,0,lift)),lift))
 for f,location,lift in samples:
  r.pose.bones['hips'].location=location;r.pose.bones['hips'].keyframe_insert(data_path='location',frame=f)
 for layer in a.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:key.interpolation='LINEAR'
 report[name]={'sampleRate':s.render.fps*4,'keys':len(samples),'maximumExtraLift':max(row[2] for row in samples)}
r.animation_data.action=None
for b in r.pose.bones:b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0)
s.frame_set(0);bpy.ops.object.select_all(action='DESELECT')
for obj in [r]+parts:obj.select_set(True)
bpy.context.view_layer.objects.active=r
# export-game.py writes both candidate and runtime GLBs at 120 Hz.
bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-polished-candidate.blend'))
(p/'ground-refinement.json').write_text(json.dumps(report,indent=2))
