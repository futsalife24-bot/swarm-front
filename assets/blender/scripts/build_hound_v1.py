"""Run: blender --background --factory-startup --python build_hound_v1.py
Deterministic, texture-free rigid-part blockout. Blender +Y -> glTF -Z.
Only owned output paths are overwritten. Never modifies gameplay or preferences.
"""
from pathlib import Path
import bpy
import bmesh
import json
import math
from mathutils import Vector

REPO = Path(__file__).resolve().parents[3]
SOURCE = REPO / 'assets/blender/source/hound_blockout_v1.blend'
GLB = REPO / 'public/assets/enemies/hound_blockout_v1.glb'
QA = REPO / 'dist-validation/hound-v1'
for path in (SOURCE.parent, GLB.parent, QA):
    path.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1.0
bpy.context.preferences.filepaths.save_version = 0

def material(name, color, metal=0.0, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = 0.65
    bsdf.inputs['Emission Color'].default_value = (*color, 1)
    bsdf.inputs['Emission Strength'].default_value = emission
    return mat

shell = material('HOUND_shell', (0.19, 0.28, 0.31), 0.25)
ivory = material('HOUND_spine', (0.63, 0.76, 0.73), 0.1)
energy = material('HOUND_ring_emission', (0.03, 0.78, 0.94), 0.0, 0.65)
root = bpy.data.objects.new('HOUND_ROOT', None)
bpy.context.collection.objects.link(root)
root['forward_blender'] = '+Y'
root['forward_gltf'] = '-Z'
root['ground'] = 'Blender Z=0; glTF Y=0; meters; root at contact plane'
root['reference_kind'] = 'crawler; radius=1.25; aim=1.4; gameplay unchanged'

def finish(obj, name, mat, pivot):
    obj.name = name
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # Bake geometry relative to animation pivot, preserving rest pose.
    delta = obj.location - Vector(pivot)
    for v in obj.data.vertices:
        v.co += delta
    obj.location = pivot
    obj.parent = root
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.select_set(False)
    return obj

def slab(name, pos, size, mat, pivot=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos, rotation=rotation)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new('edge silhouette', 'BEVEL')
    bevel.width = min(size) * 0.16
    bevel.segments = 1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return finish(obj, name, mat, pivot or pos)

def blade(name, stations, pivot):
    # Continuous blade, no repeated insect-like elbow segments or joints.
    verts, faces = [], []
    for x, y, z, width, depth in stations:
        for i in range(8):
            angle = 2 * math.pi * (i + 0.5) / 8
            verts.append((x + math.cos(angle)*width, y + math.sin(angle)*depth, z))
    faces.append(tuple(reversed(range(8))))
    for j in range(len(stations)-1):
        for i in range(8):
            a=j*8+i; b=j*8+(i+1)%8
            faces.append((a,b,b+8,a+8))
    faces.append(tuple(range(len(verts)-8,len(verts))))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj=bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj,name,shell,pivot)

# The compressed rear mass slopes upward into an empty shoulder halo.
slab('body_core', (0,-0.12,1.02), (0.82,1.34,0.44), shell,
     pivot=(0,0,1.05), rotation=(math.radians(13),0,0))
for side, label in ((-1,'L'),(1,'R')):
    blade('front_leg_'+label, [
        (side*.35,.43,1.34,.19,.19),
        (side*.56,.88,1.19,.17,.18),
        (side*.82,1.18,.79,.13,.14),
        (side*.91,1.57,.24,.085,.12),
        (side*.90,1.67,0,.065,.13),
    ],(side*.35,.43,1.34))
# An odd rear tripod: two heel supports plus a displaced central keel.
for label,x,y in [('A',-.43,-.64),('B',.43,-.64),('C',.12,-.87)]:
    blade('rear_leg_'+label,[
        (x,y,.86,.14,.15),
        (x*1.26,y-.12,.56,.13,.13),
        (x*1.37,y-.22,.20,.09,.10),
        (x*1.37,y-.23,0,.10,.16),
    ],(x,y,.86))
bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=8,
    major_radius=.51, minor_radius=.064, location=(0,.46,1.48),
    rotation=(math.pi/2,0,0))
ring=finish(bpy.context.object,'shoulder_ring',energy,(0,.46,1.48))
ring['animation_hint']='Local X/Z scale for contraction in Blender; emission material unique. No animation baked.'
for i,(y,z,width) in enumerate(((.14,1.58,.67),(-.25,1.64,.59),(-.67,1.62,.48)),1):
    slab(f'spine_plate_{i:02}',(0,y,z),(width,.24,.12),ivory,
         rotation=(0,math.radians((-1)**i*8),0))

parts=list(root.children)
assert len(parts)==10
def inspect(objects):
    points=[]; triangles=0; mats=set(); details=[]
    bpy.context.view_layer.update()
    for obj in objects:
        assert obj.type=='MESH', obj.name
        assert all(abs(v-1)<1e-6 for v in obj.scale), obj.name
        assert obj.matrix_world.determinant()>0, obj.name
        obj.data.calc_loop_triangles()
        n=len(obj.data.loop_triangles); triangles+=n
        bm=bmesh.new(); bm.from_mesh(obj.data)
        # glTF splits hard-normal vertices; weld only this temporary QA mesh.
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
        assert all(e.is_manifold for e in bm.edges), obj.name
        assert bm.calc_volume(signed=True)>0, obj.name
        bm.free()
        assert all(t.area>1e-10 for t in obj.data.loop_triangles), obj.name
        points.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        mats.update(m.name for m in obj.data.materials)
        details.append({'name':obj.name,'triangles':n,'pivot':list(obj.location)})
    lo=[min(v[i] for v in points) for i in range(3)]
    hi=[max(v[i] for v in points) for i in range(3)]
    assert abs(lo[2])<1e-5
    for obj in objects:
        if '_leg_' in obj.name:
            assert abs(min((obj.matrix_world @ v.co).z for v in obj.data.vertices))<1e-5
    return {'triangles':triangles,'materials':sorted(mats),'bounds_blender':{'min':lo,'max':hi},'parts':details}

source_metrics=inspect(parts)
assert source_metrics['triangles']<=5000
assert len(source_metrics['materials'])<=3
assert all(sum(abs(v) for v in o.rotation_euler)<1e-6 for o in parts)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
for obj in parts: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,
    export_yup=True,export_extras=True,export_cameras=False,export_lights=False,
    export_animations=False,export_texcoords=False,export_normals=True)

# Reload the actual artifact into a clean scene; do not overwrite .blend afterwards.
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(GLB))
assert not any(o.type in {'LIGHT','CAMERA','ARMATURE'} for o in bpy.context.scene.objects)
imported=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert sorted(o.name for o in imported)==sorted(d['name'] for d in source_metrics['parts'])
reimport_metrics=inspect(imported)
assert reimport_metrics['triangles']==source_metrics['triangles']
for bound in ('min','max'):
    assert all(abs(a-b)<1e-5 for a,b in zip(source_metrics['bounds_blender'][bound],reimport_metrics['bounds_blender'][bound]))
report={'blender_version':bpy.app.version_string,'source':source_metrics,
    'reimport':reimport_metrics,'glb_bytes':GLB.stat().st_size,
    'validation':'PASS: manifold, outward winding, nondegenerate faces, five grounded feet, positive unit scale, applied source rotations, clean export, exact bounds roundtrip',
    'gui_operations':[]}
(QA/'blender-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('HOUND_VALIDATION',json.dumps(report))
