"""Reference-only PLEAT / LEAPER refresh. Existing source and VOLLEY are read-only.
Blender --background --factory-startup --python-exit-code 1 --python this_file -- pleat|leaper
"""
from pathlib import Path
import sys, math, json, hashlib
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
kind = sys.argv[-1]
assert kind in ('pleat', 'leaper')
OUT = HERE / kind
OUT.mkdir(exist_ok=True)
source = REPO / ('assets/blender/candidates/crawler/pleat-v4/pleat_motion_v4.blend' if kind == 'pleat' else 'assets/blender/source/hound_motion_v1.blend')
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
assert len(meshes) == 4
for pb in rig.pose.bones: pb.matrix_basis = Matrix.Identity(4)
rig.animation_data.action = None
for track in rig.animation_data.nla_tracks: track.mute = True
bpy.context.view_layer.update()
materials = [o.data.materials[0] for o in meshes]
print('SOURCE', kind, [m.name for m in materials], [b.name for b in rig.data.bones])
def getmat(token): return next(m for m in materials if token in m.name)
if kind == 'pleat':
    armor, dark, metal, glow = getmat('felt'), getmat('support'), getmat('edge'), getmat('seam')
else:
    armor, dark, metal, glow = getmat('spine'), getmat('shell'), getmat('metal'), getmat('emission')
    # The tall circular HOUND halo belongs to VOLLEY's silhouette. Replace it
    # in LEAPER alone with the reference's narrow dorsal energy spine.
    for obj in meshes:
        group=obj.vertex_groups.get('ring')
        if group:
            remove={v.index for v in obj.data.vertices if any(g.group==group.index and g.weight>.5 for g in v.groups)}
            bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table()
            bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index in remove],context='VERTS')
            bm.to_mesh(obj.data);bm.free()
additions = {m: [] for m in materials}
def finish(o, mat, bone):
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.materials.clear(); o.data.materials.append(mat)
    o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))), 1, 'REPLACE')
    additions[mat].append(o)
    return o
def slab(name, pos, size, mat, bone, rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos, rotation=rotation)
    o=bpy.context.object; o.name=name; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Machined edge', 'BEVEL'); b.width=min(size)*.19; b.segments=1
    bpy.ops.object.modifier_apply(modifier=b.name)
    return finish(o,mat,bone)
def beam(name,a,b,width,depth,mat,bone):
    a,b=Vector(a),Vector(b)
    return slab(name,(a+b)/2,(width,depth,(b-a).length),mat,bone,(b-a).to_track_quat('Z','Y').to_euler())
def ring(name,pos,r,thick,mat,bone,rotation=(0,math.pi/2,0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=12,minor_segments=4,location=pos,major_radius=r,minor_radius=thick,rotation=rotation)
    return finish(bpy.context.object,mat,bone)

if kind=='pleat':
    # Parallel grown seams run over both independent mantle folds.
    for label,y0,y1,height,width in [('front',-.10,1.05,1.06,.61),('rear',-1.42,.10,1.10,.65)]:
        for j,x in enumerate([-.40,-.19,.13,.38]):
            for k in range(4):
                y=y0+.22+(y1-y0-.35)*k/4
                z=height+.17+.08*(y-y0)/(y1-y0)-.07*abs(x)/width
                slab('grown_shell_ridge', (x,y,z),(.035,.24,.033),metal,'mantle_'+label,(.07,.05,(-1)**j*.08))
                if k%2==0: slab('shell_laminate',(x+.027,y+.05,z-.012),(.10,.17,.035),armor,'mantle_'+label,(.06,.12,0))
    for side,label in [(-1,'L'),(1,'R')]:
        for i in range(6):
            beam('pressure_pleat',(side*.035,.86-i*.008,.91-i*.034),(side*(.39+i*.009),.82-i*.016,.89-i*.083),.085,.072,dark,'breast_'+label)
            beam('pressure_fold_edge',(side*.045,.903-i*.008,.928-i*.034),(side*(.38+i*.009),.863-i*.016,.908-i*.083),.014,.015,metal,'breast_'+label)
else:
    # LEAPER has a broad swept shoulder shield and an elevated segmented dorsal rail.
    # These masses deliberately separate its outline from the unchanged narrow VOLLEY.
    for side in [-1,1]:
        slab('swept_scapula',(side*.52,.26,1.40),(.33,.88,.16),armor,'body',(.27,side*.31,side*.24))
        slab('scapula_inset',(side*.54,.30,1.478),(.12,.48,.016),dark,'body',(.27,side*.31,side*.24))
        for i in range(4):
            slab('scapula_gill',(side*.55,.08+i*.07,1.48),(.16,.022,.026),metal,'body',(.27,side*.31,side*.24))
    for i in range(1,4):
        p=rig.data.bones['spine_'+str(i)].head_local
        for side in [-1,1]:
            slab('floating_spine_wing',p+Vector((side*.27,0,.015)),(.48,.22,.105),armor,'spine_'+str(i),(.12,side*.12,side*.10))
            slab('spine_inset',p+Vector((side*.31,0,.071)),(.22,.055,.014),metal,'spine_'+str(i))
    beam('dorsal_spine_mast',(0,-.75,1.38),(.1,-.4,2.20),.12,.10,dark,'body')
    beam('dorsal_energy_rail',(0,-.81,1.48),(.10,-.46,2.20),.035,.023,glow,'body')
    ring('ventral_pulse_emitter',(0,.08,.705),.23,.032,glow,'body',rotation=(0,0,0))
    ring('ventral_emitter_housing',(0,.08,.72),.28,.035,metal,'body',rotation=(0,0,0))
    for bone in rig.data.bones:
        if not bone.name.endswith('_toe'):continue
        p=bone.head_local
        for dx in [-.08,0,.08]:
            beam('gripping_claw',p+Vector((dx,-.01,-.025)),p+Vector((dx*1.45,.20,-.085)),.052,.065,metal,bone.name)

# Rigid knee collars, layered greaves and small recesses follow their actual bones.
for bone in rig.data.bones:
    if not bone.name.endswith(('_upper','_lower')): continue
    a,b=bone.head_local,bone.tail_local
    delta=b-a
    side=-1 if a.x<0 else 1
    ring('articulated_collar',a,.078 if kind=='pleat' else .092,.018,metal,bone.name)
    if kind=='leaper':
        ring('joint_energy_seal',a+Vector((side*.026,0,0)),.06,.009,glow,bone.name)
        for j in range(2):
            p=a+delta*(.26+j*.30)+Vector((side*.044,0,.015))
            q=p+delta*.26
            beam('overlap_greave',p,q,.18 if 'front' in bone.name else .14,.13,armor,bone.name)
            beam('greave_channel',p+Vector((side*.095,0,0)),q+Vector((side*.095,0,0)),.014,.037,dark,bone.name)
    for f in [.30,.58,.82]:
        ring('support_band',a+delta*f,.057,.009,metal,bone.name,rotation=delta.to_track_quat('Z','Y').to_euler())

def surface(mat, base, rough, metallic, shell=False):
    """Portable baked PBR maps: deterministic dry pores / striations / fine wear."""
    rng=np.random.default_rng(1209+(1 if shell else 0)); n=512
    y,x=np.mgrid[0:n,0:n]/n
    noise=rng.random((n,n))
    bands=np.sin(x*89+np.sin(y*24)*2)*.5+.5
    patches=(np.sin(x*19+y*13)+np.sin(y*41-x*7))*.5
    pores=np.where(noise>.963,-.25,0)
    value=np.clip(.91+patches*.075+noise*.09+pores+(bands-.5)*(.11 if shell else .035),.55,1.12)
    if not shell:
        scratch=(np.sin(x*461+y*13)>.995)&(noise>.75)
        value=np.where(scratch,1.2,value)
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Metallic'].default_value=metallic
    bsdf.inputs['Roughness'].default_value=rough
    mat.diffuse_color=(*base,1)
    def img(name,pixels,colorspace='sRGB'):
        image=bpy.data.images.new(kind+'_'+name,width=n,height=n)
        image.colorspace_settings.name=colorspace
        rgba=np.ones((n,n,4),dtype=np.float32);rgba[:,:,:3]=pixels
        image.pixels.foreach_set(rgba.ravel());image.filepath_raw=str(OUT/(name+'.png'));image.file_format='PNG';image.save();image.pack()
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
        return tex
    color=img(mat.name+'_albedo',np.clip(value[:,:,None]*np.array(base),0,1))
    mat.node_tree.links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
    r=np.clip(rough+(noise-.5)*.12+pores*.1,0,1)
    rt=img(mat.name+'_roughness',np.repeat(r[:,:,None],3,2),'Non-Color')
    mat.node_tree.links.new(rt.outputs['Color'],bsdf.inputs['Roughness'])
    # Tangent-space normal texture survives GLB; no Blender-only procedural nodes.
    h=(noise*.20+bands*.12+pores)*(.7 if shell else .20)
    dy,dx=np.gradient(h); normals=np.stack((-dx*2,-dy*2,np.ones_like(dx)),axis=2)
    normals/=np.linalg.norm(normals,axis=2)[:,:,None]
    nt=img(mat.name+'_normal',normals*.5+.5,'Non-Color')
    normal=mat.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.65
    mat.node_tree.links.new(nt.outputs['Color'],normal.inputs['Color']);mat.node_tree.links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])

surface(armor,(.43,.345,.245) if kind=='pleat' else (.72,.75,.73),.88 if kind=='pleat' else .47,.12 if kind=='pleat' else .36,kind=='pleat')
surface(dark,(.035,.046,.052),.49,.52)
surface(metal,(.51,.54,.51) if kind=='pleat' else (.20,.255,.28),.36,.7)

for obj in meshes:
    mat=obj.data.materials[0]
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    for o in additions[mat]: o.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.join()
    obj.data.materials.clear();obj.data.materials.append(mat)
    for p in obj.data.polygons:p.material_index=0
    # Planar face projection at constant world texel scale, including new detail geometry.
    uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='SurfaceUV')
    for face in obj.data.polygons:
        axis=max(range(3),key=lambda i:abs(face.normal[i]));axes=[i for i in range(3) if i!=axis]
        for li in face.loop_indices:
            co=obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv=(co[axes[0]]*.85,co[axes[1]]*.85)

tag='pleat_motion_v5' if kind=='pleat' else 'leaper_motion_v1'
blend=OUT/(tag+'.blend');glb=OUT/(tag+'.glb')
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,
    export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,
    export_cameras=False,export_lights=False,export_texcoords=True)
data=glb.read_bytes();gltf=json.loads(data[20:20+int.from_bytes(data[12:16],'little')])
report={'source':str(source.relative_to(REPO)),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'blender':bpy.app.version_string,
    'triangles':sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives']),
    'materials':len(gltf['materials']),'bones':len(gltf['skins'][0]['joints']),'images':len(gltf.get('images',[])),
    'clips':[a['name'] for a in gltf['animations']],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
assert report['materials']==4 and report['bones']==20 and set(report['clips'])=={'Idle','Locomotion','Lunge'}
assert report['triangles']<18000
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(glb))
assert len([o for o in bpy.context.scene.objects if o.type=='ARMATURE'])==1
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        assert all(math.isfinite(c) for v in o.data.vertices for c in v.co)
report['reimport']='PASS'
(OUT/'validation.json').write_text(json.dumps(report,indent=2))
print('REDESIGN',json.dumps(report))
