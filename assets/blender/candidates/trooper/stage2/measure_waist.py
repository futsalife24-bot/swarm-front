import bpy,importlib.util,json,bmesh
from pathlib import Path
from mathutils.bvhtree import BVHTree
Q=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('poses',Q/'render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p)
report={}
for state in ['rest','tuck']:
 p.reset()
 if state=='tuck':
  for n,a in [('Spine',-.4),('SpineMid',-.45),('Chest',-.4),('UpperLeg_L',1.4),('UpperLeg_R',1.4),('LowerLeg_L',-2),('LowerLeg_R',-2)]:
   b=p.rig.pose.bones[n];b.rotation_mode='XYZ';b.rotation_euler.x=a
 bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();body=bpy.data.objects['Study_Body'];tree=BVHTree.FromObject(body,dg);belt=bpy.data.objects['Trial_Waist_Band'].evaluated_get(dg);ds=[tree.find_nearest(v.co)[3] for v in belt.data.vertices];report[state]={'minDistance_m':min(ds),'meanDistance_m':sum(ds)/len(ds),'maxDistance_m':max(ds)}
bm=bmesh.new();bm.from_mesh(body.data);report['bodyNonmanifoldEdges']=sum(not e.is_manifold for e in bm.edges);bm.free();report['limits']='Vertex-to-nearest-surface distances and topological continuity; not a global self-intersection proof.'
(Q/'waist-measurement.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
