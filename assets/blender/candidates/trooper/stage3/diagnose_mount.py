"""Read-only mount diagnosis/proposal. No blend/bind modifications saved."""
import bpy,math,json
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
Q=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(Q.parent/'stage2/trooper_stage2_refined.blend'));rig=bpy.data.objects['STANDARD_TROOPER_RIG'];s=bpy.context.scene;rig.data.pose_position='POSE';rig.animation_data.action=None
for tr in rig.animation_data.nla_tracks:tr.mute=True
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();dep=bpy.context.evaluated_depsgraph_get();body=bpy.data.objects['Study_Body'];ev=body.evaluated_get(dep);me=ev.to_mesh();vs=[v.co.copy() for v in me.vertices];tree=BVHTree.FromPolygons(vs,[list(p.vertices) for p in me.polygons]);ev.to_mesh_clear()
def inside(v):
 direction=Vector((1,.123,.037)).normalized();origin=v.copy();hits=0
 for _ in range(80):
  hit=tree.ray_cast(origin,direction)
  if hit[0] is None:break
  hits+=1;origin=hit[0]+direction*.00001
 return hits%2==1
report=[];s.render.resolution_x=800;s.render.resolution_y=800;s.cycles.samples=12;cam=s.camera
original={o.name:o.hide_render for o in bpy.data.objects if o.type=='MESH'}
for mode in ['current','proposal']:
 mats={}
 for kind,n in [('rifle','BackWeaponSocket'),('rocket','BackWeaponSocket_2')]:
  mat=rig.data.bones[n].matrix_local.copy()
  if mode=='proposal' and kind=='rifle':
   mat.translation.y=-.300;mat=Matrix.Translation(mat.translation)@Matrix.Rotation(-math.pi/2,4,'X')
  mats[kind]=mat;o=bpy.data.objects['Weapon_'+kind];o.matrix_world=mat;o.hide_render=False
  deep=[]
  for i,v in enumerate(o.data.vertices):
   co=mat@v.co;hit=tree.find_nearest(co)
   if hit[3]>.012 and inside(co):deep.append({'index':i,'depth':hit[3],'world':list(co)})
  report.append({'mode':mode,'weapon':kind,'insideBodyOver12mm':len(deep),'worst':max(deep,key=lambda e:e['depth']) if deep else None})
 bpy.data.objects['Weapon_shotgun'].hide_render=True
 for variant in ['normal','cutaway']:
  for o in bpy.data.objects:
   if o.type=='MESH' and not o.name.startswith('Weapon'):o.hide_render=original.get(o.name,True) or (variant=='cutaway' and o.name not in ['Helmet','Boots'])
  # Exact half-body cutaway on camera side exposes the relation to the torso.
  if variant=='cutaway':
   mesh=body.data.copy();ob=bpy.data.objects.new('Diagnostic_half_body',mesh);s.collection.objects.link(ob)
   import bmesh
   bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=(.01,0,0),plane_no=(1,0,0),clear_outer=True,clear_inner=False);bm.to_mesh(mesh);bm.free()
  cam.location=(5,-.3,1.35);target=Vector((0,-.12,1.3));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=1.15;s.render.filepath=str(Q/f'mount_{mode}_{variant}.png');bpy.ops.render.render(write_still=True)
  if variant=='cutaway':ob.hide_render=True
(Q/'mount-diagnosis.json').write_text(json.dumps({'method':'Full weapon vertices; positive-X slanted ray parity in closed body mesh, nearest-surface distance; diagnostic rest pose. No bind edits saved.','results':report},indent=2));print('MOUNT DIAGNOSIS',report)
