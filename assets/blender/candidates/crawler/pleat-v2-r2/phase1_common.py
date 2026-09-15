"""Shared deterministic Blender mesh/export utilities. Static material batching follows HOUND."""
from pathlib import Path
import bpy,bmesh,json,math
from mathutils import Vector
REPO=Path(__file__).resolve().parents[3]
def setup(name):
 global NAME,ROOT,MATS
 NAME=name;MATS=[]
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
 bpy.context.preferences.filepaths.save_version=0
 ROOT=bpy.data.objects.new(name.upper()+'_ROOT',None);bpy.context.collection.objects.link(ROOT)
 ROOT['forward']='Blender +Y / glTF -Z';ROOT['units']='meters; no runtime scale correction'
 return ROOT
def mat(name,color,metal=0,rough=.55,emit=0):
 m=bpy.data.materials.new(NAME+'_'+name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit;MATS.append(m);return m
def finish(o,name,m):
 o.name=name;o.parent=ROOT;o.data.materials.clear();o.data.materials.append(m)
 bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 o.select_set(False);return o
def box(name,pos,size,m,rot=(0,0,0),bevel=.10):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos,rotation=rot);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel and min(size)>=globals().get("BEVEL_MIN_SIZE",0):
  mod=o.modifiers.new('machined_edges','BEVEL');mod.width=min(size)*bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,name,m)
def mesh(name,verts,faces,m):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o)
 bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free();return finish(o,name,m)
def beam(name,a,b,w,m,depth=None):
 a,b=Vector(a),Vector(b);return box(name,(a+b)/2,(w,depth or w,(b-a).length),m,(b-a).to_track_quat('Z','Y').to_euler())
def cylinder(name,pos,r,depth,m,n=16,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=pos,rotation=rot);return finish(bpy.context.object,name,m)
def ico(name,pos,size,m,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=pos);o=bpy.context.object;o.scale=size;return finish(o,name,m)
def ring(name,pos,r,t,m,n=48,k=6):
 bpy.ops.mesh.primitive_torus_add(major_segments=n,minor_segments=k,major_radius=r,minor_radius=t,location=pos);return finish(bpy.context.object,name,m)
def export(mintri,maxtri,ground=0):
 qa=REPO/'dist-validation'/f'{NAME}-v1';qa.mkdir(parents=True,exist_ok=True)
 source=REPO/'assets/blender/source'/f'{NAME}_v1.blend';glb=REPO/'public/assets/enemies'/f'{NAME}_v1.glb'
 logical=[{'name':o.name,'material':o.data.materials[0].name} for o in ROOT.children if o.type=='MESH']
 for m in MATS:
  objs=[o for o in ROOT.children if o.type=='MESH' and o.data.materials[0]==m]
  if not objs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();o=bpy.context.object;o.name=NAME+'_batch_'+m.name;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.clear();o.data.materials.append(m)
  for p in o.data.polygons:p.material_index=0
 def inspect():
  bpy.context.view_layer.update();pts=[];tris=0;materials=set();meshes=[]
  for o in bpy.context.scene.objects:
   if o.type!='MESH':continue
   assert all(abs(s-1)<1e-6 for s in o.scale) and o.matrix_world.determinant()>0
   o.data.calc_loop_triangles();assert all(t.area>1e-10 for t in o.data.loop_triangles)
   tris+=len(o.data.loop_triangles);pts.extend(o.matrix_world@v.co for v in o.data.vertices);materials.update(m.name for m in o.data.materials);meshes.append(o.name)
  lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)]
  assert abs(lo[2]-ground)<1e-4,(lo,ground)
  return dict(triangles=tris,materials=sorted(materials),meshes=meshes,bounds_blender=dict(min=lo,max=hi))
 metrics=inspect();assert mintri<=metrics['triangles']<=maxtri,metrics['triangles'];assert len(metrics['materials'])<=5
 ROOT['logical_parts']=json.dumps(logical);ROOT['static_prototype']='material batches; regenerate logical parts for future motion, no rig'
 bpy.ops.wm.save_as_mainfile(filepath=str(source));bpy.ops.object.select_all(action='SELECT')
 bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_texcoords=False)
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(glb));again=inspect();assert metrics['triangles']==again['triangles']
 for k in ['min','max']:assert all(abs(a-b)<1e-4 for a,b in zip(metrics['bounds_blender'][k],again['bounds_blender'][k]))
 report=dict(blender=bpy.app.version_string,source=metrics,reimport=again,glb_bytes=glb.stat().st_size,ground=ground,forward='Blender +Y to glTF -Z',logical_parts=logical,pass_checks=['generation','blend save','GLB export','GLB reimport','nondegenerate triangles','unit positive scales','bounds match','ground clearance'])
 (qa/'blender-validation.json').write_text(json.dumps(report,indent=2));print('VALIDATION',NAME,metrics['triangles'],glb.stat().st_size)
