"""Run: blender --background --factory-startup --python build_hound_v3.py
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
SOURCE = REPO / 'assets/blender/source/hound_blockout_v3.blend'
GLB = REPO / 'public/assets/enemies/hound_blockout_v3.glb'
QA = REPO / 'dist-validation/hound-v3'
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

shell = material('HOUND_shell', (0.055, 0.075, 0.085), 0.5)
ivory = material('HOUND_spine', (0.48, 0.55, 0.57), 0.35)
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

# V3: rigid chassis with layered armor. No head, rig, or gameplay data.
steel = material('HOUND_edge_metal', (.22,.29,.32), .65)
def beam(name,a,b,width,depth,mat):
    a,b=Vector(a),Vector(b)
    q=(b-a).to_track_quat('Z','Y')
    return slab(name,(a+b)/2,(width,depth,(b-a).length),mat,rotation=q.to_euler())
def axle(name,pos,radius,length,axis='X'):
    rot=(0,math.pi/2,0) if axis=='X' else (math.pi/2,0,0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=radius,depth=length,location=pos,rotation=rot)
    return finish(bpy.context.object,name,steel,pos)
body=slab('chassis', (0,-.18,1.02),(.82,1.46,.40),shell,rotation=(.297,0,0))
for v in body.data.vertices:
    rear=max(0,min(1,(-v.co.y+.2)/.9));v.co.x=v.co.x*(1-.26*rear)+.1*rear
# Separate angled deck sectors, asymmetric side cheeks and undertray.
for i,(x,y,z,w,d,h,angle) in enumerate([
 (-.22,.29,1.31,.43,.65,.16,.25),(.24,.13,1.27,.38,.79,.17,.19),
 (-.17,-.43,1.08,.34,.54,.14,.32),(.24,-.58,1.03,.37,.45,.19,.4),
 (-.43,-.12,1.11,.16,.65,.29,-.12),(.43,-.26,1.05,.14,.49,.23,.18)]):
    slab('deck_'+str(i),(x,y,z),(w,d,h),ivory,rotation=(angle,0,(-1)**i*.07))
apron=slab('front_apron',(-.03,.51,1.19),(.70,.18,.28),ivory,rotation=(.32,0,.06))
for v in apron.data.vertices:
    v.co.x *= .82 if v.co.z<0 else 1
slab('apron_seam',(.15,.614,1.19),(.018,.018,.17),shell,rotation=(.32,0,.06))
slab('undertray',(.03,-.13,.77),(.64,1.13,.16),steel,rotation=(.23,0,.06))
for x,y in [(-.25,.2),(.22,.03),(-.18,-.48)]:
    slab('belly_recess',(x,y,.716),(.18,.3,.065),shell)
    slab('belly_lumen',(x,y,.679),(.028,.16,.018),energy)
for i in range(4):
    slab('deck_vent',(-.23,-.2+i*.085,1.255),(.19,.027,.025),shell,rotation=(.27,0,-.16))
slab('offaxis_service_bay',(.43,-.3,1.18),(.12,.25,.1),steel)
# Five load-bearing continuous legs with articulated bases and overlapping armor.
feet=[]
for side,label in [(-1,'L'),(1,'R')]:
    a=(side*.35,.43,1.34);b=(side*.60,.88,1.17);c=(side*.93,1.24,.68);f=(side*1.10,1.67,0)
    leg=blade('front_leg_'+label,[(*a,.16,.17),(*b,.145,.15),(*c,.10,.115),(side*1.10,1.57,.22,.074,.11),(*f,.06,.13)],a)
    feet.append({'name':leg.name,'ground':0,'contact_blender':list(f)})
    axle('shoulder_hinge_'+label,a,.18,.39)
    slab('hip_guard_'+label,(side*.48,.45,1.36),(.16,.35,.31),ivory,rotation=(.18,side*.18,0))
    beam('upper_armor_'+label,(side*.5,.58,1.43),(side*.73,1.01,1.07),.26,.21,ivory)
    beam('lower_armor_'+label,(side*.76,1.04,1.08),(side*1.11,1.61,.17),.205,.20,ivory)
    beam('recess_'+label,(side*.86,1.22,.87),(side*1.035,1.51,.40),.104,.215,shell)
    beam('light_'+label,(side*.875,1.247,.83),(side*1.00,1.46,.49),.035,.224,energy)
    beam('actuator_'+label,(side*.48,.62,1.13),(side*.70,1.02,.91),.065,.065,steel)
    axle('knee_hinge_'+label,(side*.76,1.06,.97),.13,.25)
    for t in [.22,.62]:
        p=Vector((side*.76,1.04,1.08)).lerp(Vector((side*1.11,1.61,.17)),t)
        slab('armor_seam_'+label,p,(.22,.033,.034),shell,rotation=(.56,0,0))
for label,x,y,fx,fy,h,w in [('A',-.46,-.58,-.65,-.93,.91,.12),('B',.48,-.62,.72,-1,.84,.14),('C',.04,-.82,.06,-1.39,.73,.13)]:
    a=(x,y,h);f=(fx,fy,0)
    leg=blade('rear_leg_'+label,[(*a,w,.14),(fx*.91,(y+fy)/2,.46,w,.12),(fx,fy,.16,w*.7,.10),(*f,w*.75,.16)],a)
    feet.append({'name':leg.name,'ground':0,'contact_blender':list(f)})
    axle('rear_base_'+label,a,.14,.29)
    slab('rear_socket_'+label,(x,y,h+.06),(.25,.28,.2),steel)
    beam('rear_shield_'+label,(x,y+.10,h-.07),(fx,fy+.1,.17),w*1.55,.13,ivory)
    beam('rear_inset_'+label,(x,y+.18,h-.16),(fx,fy+.18,.32),.035,.025,energy)
    slab('heel_cap_'+label,(fx,fy,.10),(w*1.6,.25,.15),steel)
# Ring housing in shoulder space: dark outer track, cyan inner band, clamp blocks.
ring_pos=(.24,-.19,1.48);ring_rot=(math.pi/2+math.radians(18),math.radians(12),math.radians(-28))
from mathutils import Euler
ring_matrix=Euler(ring_rot).to_matrix()
for name,r,t,mat in [('ring_housing',.51,.089,shell),('shoulder_ring',.51,.048,energy)]:
    # Emissive band sits forward of the housing, visibly recessed between metal lips.
    p=Vector(ring_pos)+(ring_matrix@Vector((0,0,-.070 if mat==energy else 0)))
    bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=6,major_radius=r,minor_radius=t,location=p,rotation=ring_rot)
    obj=finish(bpy.context.object,name,mat,p)
    for poly in obj.data.polygons:poly.use_smooth=True
for i,ang in enumerate([.45,2.5,4.5]):
    p=Vector(ring_pos)+ring_matrix@Vector((math.cos(ang)*.51,math.sin(ang)*.51,0))
    slab('ring_clamp_'+str(i),p,(.16,.18,.13),steel,rotation=ring_rot)
beam('ring_support_L',(-.3,-.38,1.05),(-.13,-.27,1.48),.13,.17,steel)
beam('ring_support_R',(.38,-.51,1.10),(.57,-.38,1.34),.12,.18,steel)
# Three nonidentical levitating cassettes, staggered in front projection.
for i,(x,y,z,w,d,h,rx,ry,rz) in enumerate([(-.20,.17,1.88,.72,.28,.13,-.10,-.17,-.09),(.13,-.40,2.14,.59,.25,.16,.05,.20,.04),(-.10,-.98,1.60,.49,.31,.12,.18,-.12,.15)],1):
    rot=(rx,ry,rz);R=Euler(rot).to_matrix();center=Vector((x,y,z))
    slab('spine_plate_'+str(i),center,(w,d,h),ivory,rotation=rot)
    slab('spine_under_'+str(i),center+R@Vector((0,0,-h*.56)),(w*.73,d*.7,.046),shell,rotation=rot)
    slab('spine_slit_'+str(i),center+R@Vector((w*.23,d*.505,0)),(w*.38,.019,h*.40),energy,rotation=rot)
    slab('spine_split_'+str(i),center+R@Vector((-w*.16,0,h*.505)),(.018,d*.93,.012),shell,rotation=rot)
# Restrained edge wear: sparse inlaid silver chips, no textures or random noise.
for i in range(6):
    slab('edge_wear_'+str(i),(-.37+i*.065,.52,1.414),(.026,.028,.009),steel)

bpy.context.view_layer.update()
# Validate actual individual leg contacts before material batching.
for obj in list(root.children):
    if '_leg_' in obj.name:
        assert abs(min((obj.matrix_world@v.co).z for v in obj.data.vertices))<1e-6
# Static prototype: material batches keep four draw calls even at 40 instances.
for mat in [shell,ivory,energy,steel]:
    objects=[o for o in list(root.children) if o.type=='MESH' and o.data.materials[0]==mat]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    obj=bpy.context.object;obj.name='HOUND_batch_'+mat.name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # Joining identical material slots can retain duplicate slots; normalize.
    obj.data.materials.clear();obj.data.materials.append(mat)
    for poly in obj.data.polygons:poly.material_index=0
parts=list(root.children)
def inspect(objects):
    bpy.context.view_layer.update();points=[];triangles=0;mats=set()
    for o in objects:
        assert all(abs(v-1)<1e-6 for v in o.scale)
        assert o.matrix_world.determinant()>0
        o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
        assert all(t.area>1e-10 for t in o.data.loop_triangles)
        points.extend(o.matrix_world@v.co for v in o.data.vertices)
        mats.update(m.name for m in o.data.materials)
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    assert abs(lo[2])<1e-5
    return {'triangles':triangles,'materials':sorted(mats),'meshes':len(objects),'bounds_blender':{'min':lo,'max':hi}}
source_metrics=inspect(parts)
assert 3000<=source_metrics['triangles']<=8000
assert len(parts)==4 and len(source_metrics['materials'])==4
root['five_contacts']=json.dumps(feet);root['prototype']='v3 static material batches; no animation'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in parts:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_texcoords=False,export_normals=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(GLB))
reimport_metrics=inspect([o for o in bpy.context.scene.objects if o.type=='MESH'])
assert reimport_metrics['triangles']==source_metrics['triangles']
for key in ['min','max']:
    assert all(abs(a-b)<1e-5 for a,b in zip(source_metrics['bounds_blender'][key],reimport_metrics['bounds_blender'][key]))
report={'blender_version':bpy.app.version_string,'source':source_metrics,'reimport':reimport_metrics,'feet':feet,'glb_bytes':GLB.stat().st_size,'validation':'PASS: five actual grounded legs before batching; unit positive scales; nondegenerate triangles; export/import bounds and triangles match; forward Blender +Y to GLTF -Z'}
(QA/'blender-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('HOUND_VALIDATION',json.dumps(report))
