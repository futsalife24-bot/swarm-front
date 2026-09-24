import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector,Matrix
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P/'harrow.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rest={b.name:b.matrix_local.copy() for b in rig.data.bones}
inv={n:m.inverted() for n,m in rest.items()}
wing={side:[rig.data.bones['Wing '+part+side].head_local.copy() for part in ('upper','fore','fan')] for side in ('.L','.R')}
points={};hulls={}
for side in ('.L','.R'):
 for part in ('upper','fore','fan'):
  bn='Wing '+part+side
  points[bn]=[v.co.copy() for o in bpy.data.objects if o.type=='MESH' and o.name.startswith(('Wing','Launcher')) and any(g.name==bn for g in o.vertex_groups) for v in o.data.vertices]
  bm=bmesh.new()
  for p in points[bn]:bm.verts.new(p)
  h=bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False)
  hulls[bn]=[v.co.copy() for v in h['geom'] if isinstance(v,bmesh.types.BMVert)];bm.free()
def around(p,axis,a):return Matrix.Translation(p)@Matrix.Rotation(a,4,axis)@Matrix.Translation(-p)
rig.animation_data.action=bpy.data.actions['Spin'];rig.animation_data.action_slot=rig.animation_data.action.slots[0]
for tr in rig.animation_data.nla_tracks:tr.mute=True
bpy.context.scene.frame_set(67);bpy.context.view_layer.update()
torso=rig.pose.bones['Torso'].matrix@inv['Torso']
results=[]
for fore in (-.15,0,.15):
 for fan in (-.35,-.15,0,.15):
  for sweep in (-.15,0,.15):
   side='.R';q=wing[side]
   def transforms(a):
    upper=torso@around(q[0],'X',-a)@around(q[0],'Z',-.045)
    lower=upper@around(q[1],'X',fore)
    end=lower@around(q[2],'X',fan)@around(q[2],'Z',sweep)
    return {'Wing upper'+side:upper,'Wing fore'+side:lower,'Wing fan'+side:end}
   lo,hi=-.3,1.3
   for _ in range(23):
    mid=(lo+hi)*.5;ms=transforms(mid)
    floor=min((ms[n]@p).z for n in ms for p in hulls[n])
    if floor>.025:lo=mid
    else:hi=mid
   ms=transforms((lo+hi)*.5)
   low=[]
   for n,m in ms.items():
    for p in points[n]:
     v=m@p
     if v.z*1.95<2:low.append(math.hypot(v.x,v.y)*1.95)
   results.append({'fore':fore,'fanX':fan,'fanZ':sweep,'angle':(lo+hi)*.5,'lowRadius':max(low)})
print('PROBE_RESULTS',json.dumps(sorted(results,key=lambda r:-r['lowRadius'])[:12]))
