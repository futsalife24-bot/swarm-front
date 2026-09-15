import bpy, os, json
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out=os.path.join(root,'public','assets','weapons','progression-v1')
os.makedirs(out,exist_ok=True)
source=os.path.join(root,'assets','blender','source','progression-weapons-v1')
os.makedirs(source,exist_ok=True)
report=[]
colors=[(.25,.3,.32,1),(.16,.42,.29,1),(.12,.28,.58,1),(.44,.2,.59,1),(.74,.45,.10,1)]
for kind in ['rifle','shotgun','rocket']:
 for grade in range(5):
  bpy.ops.wm.read_factory_settings(use_empty=True)
  bpy.ops.import_scene.gltf(filepath=os.path.join(root,'public','assets','characters','standard_'+kind+'_v4.glb'))
  meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
  vertices=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
  low=Vector([min(v[i] for v in vertices) for i in range(3)])
  high=Vector([max(v[i] for v in vertices) for i in range(3)])
  size=high-low;center=(high+low)/2;axis=max(range(3),key=lambda i:size[i]);side=(axis+1)%3;up=({0,1,2}-{axis,side}).pop()
  accent=bpy.data.materials.new('Progression_'+str(grade));accent.diffuse_color=colors[grade];accent.use_nodes=True
  shader=accent.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=colors[grade];shader.inputs['Metallic'].default_value=.65;shader.inputs['Roughness'].default_value=.25
  if grade>=2:shader.inputs['Emission Color'].default_value=colors[grade];shader.inputs['Emission Strength'].default_value=(grade-1)*.7
  # Extra rail modules are authored in Blender; original imported meshes remain.
  for i in range(grade):
   for sign in [-1,1]:
    location=center.copy();location[axis]=low[axis]+size[axis]*(.35+i*.1);location[side]=center[side]+sign*size[side]*.48
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    obj=bpy.context.object;obj.name=f'GRADE_{grade}_RAIL_{i}_{sign}';dimensions=size*.12;dimensions[axis]=size[axis]*.055;dimensions[side]=size[side]*.09;dimensions[up]=size[up]*.38;obj.dimensions=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.data.materials.append(accent)
    bevel=obj.modifiers.new('machined_edge','BEVEL');bevel.width=min(dimensions)*.12;bevel.segments=2
  path=os.path.join(out,f'{kind}_{grade}.glb')
  bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',export_animations=False)
  bpy.ops.wm.save_as_mainfile(filepath=os.path.join(source,f'{kind}_{grade}.blend'))
  report.append({'kind':kind,'grade':grade,'baseMeshes':len(meshes),'extraModules':grade*2,'size':list(size),'bytes':os.path.getsize(path)})
with open(os.path.join(out,'manifest.json'),'w',encoding='utf8')as f:json.dump(report,f,indent=2)
