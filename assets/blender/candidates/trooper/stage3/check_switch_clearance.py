"""Coarse vertex/nearest-normal screen: flags candidates, not a collision proof."""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
Q=Path(__file__).resolve().parent;candidate_source=sys.argv[sys.argv.index('--source')+1] if '--source' in sys.argv else 'trooper_stage3_animated.blend';bpy.ops.wm.open_mainfile(filepath=str(Q/candidate_source));rig=bpy.data.objects['STANDARD_TROOPER_RIG'];rig.data.pose_position='POSE'
for tr in rig.animation_data.nla_tracks:tr.mute=True
dep=bpy.context.evaluated_depsgraph_get();report=[]
def inside(tree,v):
 votes=0
 for direction in [(1,.123,.037),(.073,1,.213),(.183,.119,1)]:
  d=Vector(direction).normalized();origin=v.copy();hits=0
  for _ in range(80):
   hit=tree.ray_cast(origin,d)
   if hit[0] is None:break
   hits+=1;origin=hit[0]+d*.00001
  votes+=hits%2
 return votes>=2
for direction,source,dest in [('1_to_2','rifle','rocket'),('2_to_1','rocket','rifle')]:
 rig.animation_data.action=bpy.data.actions['Trial_Switch_'+direction]
 for f in range(61):
  bpy.context.scene.frame_set(f);bpy.context.view_layer.update();trees={}
  for name in ['Study_Body','Helmet']:
   o=bpy.data.objects[name];ev=o.evaluated_get(dep);me=ev.to_mesh();vs=[ev.matrix_world@v.co for v in me.vertices];trees[name]=(BVHTree.FromPolygons(vs,[list(p.vertices) for p in me.polygons]),Vector(tuple(min(v[a] for v in vs) for a in range(3))),Vector(tuple(max(v[a] for v in vs) for a in range(3))));ev.to_mesh_clear()
  for kind in [source,dest]:
   held=(kind==source and f<27) or (kind==dest and f>=36);bn='RightHandWeaponSocket' if held else 'BackWeaponSocket' if kind=='rifle' else 'BackWeaponSocket_2';mat=rig.matrix_world@rig.pose.bones[bn].matrix;weapon=bpy.data.objects['Weapon_'+kind];deep=[]
   for i in range(len(weapon.data.vertices)):
    v=mat@weapon.data.vertices[i].co
    for name,(tree,lo,hi) in trees.items():
     if not all(lo[a]<v[a]<hi[a] for a in range(3)):continue
     hit=tree.find_nearest(v)
     if hit[0] is not None and hit[3]>.012 and inside(tree,v):deep.append((hit[3],name,i,tuple(v)))
   if deep:
    worst=max(deep);tree=trees[worst[1]][0];surface=tree.find_nearest(Vector(worst[3]));ob=bpy.data.objects[worst[1]];poly=ob.data.polygons[surface[2]];weights={}
    for vi in poly.vertices:
     for g in ob.data.vertices[vi].groups:weights[ob.vertex_groups[g.group].name]=weights.get(ob.vertex_groups[g.group].name,0)+g.weight
    report.append({'direction':direction,'frame':f,'weapon':kind,'held':held,'sampledDeepVertices':len(deep),'worst':worst,'bodyRegion':max(weights,key=weights.get) if weights else 'none'})
output=sys.argv[sys.argv.index('--output')+1] if '--output' in sys.argv else 'clearance-screen.json'
(Q/output).write_text(json.dumps({'source':candidate_source,'method':'Every frame and all weapon vertices within target AABB; three-direction majority slanted ray parity and nearest surface depth >12mm. Body closed, helmet disconnected. Inspect flagged frames visually. No hand/armor/weapon-vs-weapon coverage. Threshold is detection only, not approved penetration allowance.','flags':report},indent=2));print('CLEARANCE FLAG COUNT',len(report))
