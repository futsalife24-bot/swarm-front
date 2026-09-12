"""Same-pose normal/transparent diagnosis of the three auditor-specified contacts."""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
Q=Path(__file__).resolve().parent
source=sys.argv[sys.argv.index('--source')+1] if '--source' in sys.argv else 'submission1/trooper_stage3_animated.blend'
prefix=sys.argv[sys.argv.index('--prefix')+1] if '--prefix' in sys.argv else ''
bpy.ops.wm.open_mainfile(filepath=str(Q/source))
s=bpy.context.scene;rig=bpy.data.objects['STANDARD_TROOPER_RIG'];cam=s.camera;body=bpy.data.objects['Study_Body']
for tr in rig.animation_data.nla_tracks:tr.mute=True
s.render.resolution_x=560;s.render.resolution_y=560;s.render.resolution_percentage=100;s.cycles.samples=12
visibility={o.name:o.hide_render for o in bpy.data.objects if o.type=='MESH'}
original_materials=list(body.data.materials)
glass=bpy.data.materials.new('Diagnostic translucent cloth');glass.use_nodes=True;n=glass.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');mix=n.new('ShaderNodeMixShader');mix.inputs[0].default_value=.23;trans=n.new('ShaderNodeBsdfTransparent');diff=n.new('ShaderNodeBsdfDiffuse');diff.inputs['Color'].default_value=(.10,.65,.72,1);links=glass.node_tree.links;links.new(trans.outputs[0],mix.inputs[1]);links.new(diff.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs[0])
def emission(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=.5;return m
red=emission('Diagnostic inside weapon vertex',(1,.04,.02));green=emission('Diagnostic nearest cloth surface',(.1,1,.1))
markers=[]
for mat in [red,green]:
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.004);o=bpy.context.object;o.data.materials.append(mat);o.hide_render=True;markers.append(o)
bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=.0015,depth=1);line=bpy.context.object;line.data.materials.append(red);line.hide_render=True
def inside(tree,v):
 votes=0
 for axis in [(1,.123,.037),(.073,1,.213),(.183,.119,1)]:
  d=Vector(axis).normalized();origin=v.copy();hits=0
  for _ in range(80):
   hit=tree.ray_cast(origin,d)
   if hit[0] is None:break
   hits+=1;origin=hit[0]+d*.00001
  votes+=hits%2
 return votes>=2
groups=[('C1',[('1_to_2',0),('1_to_2',2),('2_to_1',58),('2_to_1',60)],'rifle',(.27,-.01,1.38),(3,.6,.7),.52),('C2',[('1_to_2',f) for f in range(34,39)],'rocket',(.29,-.14,1.36),(3,-1,.6),.58),('C3',[('2_to_1',f) for f in range(8,13)],'rocket',(.50,.12,1.40),(3,3,1),.72)]
report=[];dep=bpy.context.evaluated_depsgraph_get()
for group,frames,kind,target,offset,scale in groups:
 target=Vector(target);cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
 for direction,f in frames:
  rig.animation_data.action=None
  for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
  rig.animation_data.action=bpy.data.actions['Trial_Switch_'+direction];s.frame_set(f);bpy.context.view_layer.update()
  source,dest=('rifle','rocket') if direction=='1_to_2' else ('rocket','rifle')
  for wk in ['rifle','rocket']:
   held=(wk==source and f<27) or (wk==dest and f>=36);bn='RightHandWeaponSocket' if held else 'BackWeaponSocket' if wk=='rifle' else 'BackWeaponSocket_2';ob=bpy.data.objects['Weapon_'+wk];ob.matrix_world=rig.matrix_world@rig.pose.bones[bn].matrix
  ev=body.evaluated_get(dep);me=ev.to_mesh();verts=[ev.matrix_world@v.co for v in me.vertices];tree=BVHTree.FromPolygons(verts,[list(p.vertices) for p in me.polygons]);ev.to_mesh_clear();lo=[min(v[a] for v in verts) for a in range(3)];hi=[max(v[a] for v in verts) for a in range(3)]
  weapon=bpy.data.objects['Weapon_'+kind];deep=[]
  for v in weapon.data.vertices:
   pt=weapon.matrix_world@v.co
   if not all(lo[a]<pt[a]<hi[a] for a in range(3)):continue
   near=tree.find_nearest(pt)
   if near[3]>.003 and inside(tree,pt):deep.append((near[3],v.index,pt.copy(),near[0].copy()))
  worst=max(deep,key=lambda x:x[0]) if deep else None
  report.append({'group':group,'direction':direction,'frame':f,'weapon':kind,'insideVerticesOver3mm':len(deep),'maxDepthMeters':worst[0] if worst else 0,'deepestVertex':worst[1] if worst else None,'insidePoint':list(worst[2]) if worst else None,'nearestSurface':list(worst[3]) if worst else None,'armHeads':{n:list(rig.pose.bones[n].head) for n in ['Clavicle_L','UpperArm_L','LowerArm_L','Hand_L','UpperArm_R','LowerArm_R','Hand_R']},'weaponOrigin':list(weapon.matrix_world.translation)})
  for variant in ([] if '--data-only' in sys.argv else ['normal','transparent']):
   for name,h in visibility.items():bpy.data.objects[name].hide_render=h
   for wk in ['rifle','rocket']:bpy.data.objects['Weapon_'+wk].hide_render=False
   bpy.data.objects['Weapon_shotgun'].hide_render=True
   body.data.materials.clear()
   for m in original_materials:body.data.materials.append(m)
   for o in markers+[line]:o.hide_render=True
   if variant=='transparent':
    for o in bpy.data.objects:
     if o.type=='MESH' and o.name!=body.name and not o.name.startswith('Weapon_'):o.hide_render=True
    body.hide_render=False;body.data.materials.clear();body.data.materials.append(glass)
    if worst:
     overlay=(cam.location-target).normalized()*.75
     for o,point in zip(markers,[worst[2],worst[3]]):o.hide_render=False;o.location=point+overlay
     line.hide_render=False;line.location=(worst[2]+worst[3])*.5+overlay;line.rotation_euler=(worst[3]-worst[2]).to_track_quat('Z','Y').to_euler();line.scale.z=worst[0]
   s.render.filepath=str(Q/f'{prefix}{group}_{direction}_{f:02}_{variant}.png');bpy.ops.render.render(write_still=True)
(Q/(prefix+'contact-diagnosis.json')).write_text(json.dumps({'method':'All weapon vertices; three-direction majority ray parity; nearest body surface; >3mm reporting threshold is not permission. Normal and transparent cloth use identical pose/camera. Red=projected deepest weapon vertex, green=projected nearest cloth surface; markers shifted camera-ward for visibility with identical orthographic pixel projection. Armor hidden only in transparent diagnostic.','frames':report},indent=2))
print('CONTACT DIAGNOSIS COMPLETE')
