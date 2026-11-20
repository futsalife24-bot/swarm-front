"""Isolated RL-9 PBR proof. This intentionally fails the current image prohibition.
Never writes production files. Run from the repository worktree with Blender.
"""
import bpy, sys, json, math, hashlib
from pathlib import Path

ROOT = Path.cwd()
OUT = ROOT / 'dist-validation/astra-pbr-proof'
OUT.mkdir(parents=True, exist_ok=True)
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'design/weapon-models-20261111/blender'))
import weapon_kit
from weapons import heavy

before = hashlib.sha256((ROOT/'public/assets/weapons/unique-v1/heavy_0.glb').read_bytes()).hexdigest()
k = weapon_kit.Kit(heavy.SPEC)
heavy.build(k)
ix,iy,iz = heavy.SPEC['inlay']
for side in [-1,1]:
    k.box('Grade inlay',(side*ix,iy,iz),(.002,.014,.012),'accent',.001)
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.ops.object.join()
obj=bpy.context.object
obj.name='Weapon_heavy_pbr_proof'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
mesh=obj.data
mesh.calc_loop_triangles()
triangles=len(mesh.loop_triangles)
assert triangles<=12060
assert len(mesh.materials)==6

# Unwrap actual geometry into one atlas; primitive UVs previously overlapped.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(65),island_margin=.003,area_weight=.4,correct_aspect=True,scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=16
scene.render.bake.margin=5
scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.color_depth='8'
scene.view_settings.view_transform='Standard'

def node(nt,typ): return nt.nodes.new(typ)
def mathnode(nt,op,a,b=None):
    n=node(nt,'ShaderNodeMath');n.operation=op
    for i,v in enumerate([a,b]):
        if v is None: continue
        if isinstance(v,(int,float)):n.inputs[i].default_value=v
        else:nt.links.new(v,n.inputs[i])
    return n.outputs[0]
def ramp(nt,value,points):
    n=node(nt,'ShaderNodeValToRGB')
    n.color_ramp.interpolation='LINEAR'
    for e in list(n.color_ramp.elements)[2:]:n.color_ramp.elements.remove(e)
    for i,(p,c) in enumerate(points):
        e=n.color_ramp.elements[i] if i<2 else n.color_ramp.elements.new(p)
        e.position=p;e.color=(*c,1)
    nt.links.new(value,n.inputs['Fac'])
    return n.outputs['Color']
def mix(nt,f,a,b):
    n=node(nt,'ShaderNodeMixRGB')
    for i,v in enumerate([f,a,b]):
        if isinstance(v,tuple):n.inputs[i].default_value=(*v,1)
        elif isinstance(v,(float,int)):n.inputs[i].default_value=v
        else:nt.links.new(v,n.inputs[i])
    return n.outputs['Color']

originals={}
graphs={}
for mat in mesh.materials:
    nt=mat.node_tree;p=nt.nodes.get('Principled BSDF')
    originals[mat.name]={'color':list(p.inputs['Base Color'].default_value),'roughness':p.inputs['Roughness'].default_value,'metallic':p.inputs['Metallic'].default_value,'emission':list(p.inputs['Emission Color'].default_value),'emission_strength':p.inputs['Emission Strength'].default_value}
    if mat.name in ['Rarity identification','Glow heat']:
        continue
    base=tuple(p.inputs['Base Color'].default_value[:3])
    metal=p.inputs['Metallic'].default_value;rough=p.inputs['Roughness'].default_value
    geo=node(nt,'ShaderNodeNewGeometry')
    noise=node(nt,'ShaderNodeTexNoise');noise.inputs['Scale'].default_value=155;noise.inputs['Detail'].default_value=3;noise.inputs['Roughness'].default_value=.72
    nt.links.new(geo.outputs['Position'],noise.inputs['Vector'])
    fine=node(nt,'ShaderNodeTexNoise');fine.inputs['Scale'].default_value=980;fine.inputs['Detail'].default_value=2
    nt.links.new(geo.outputs['Position'],fine.inputs['Vector'])
    # Pointiness interpolates broad flat panels; use a local bevel-normal delta.
    bevel=node(nt,'ShaderNodeBevel');bevel.samples=4;bevel.inputs['Radius'].default_value=.0012
    dot=node(nt,'ShaderNodeVectorMath');dot.operation='DOT_PRODUCT'
    nt.links.new(geo.outputs['Normal'],dot.inputs[0]);nt.links.new(bevel.outputs['Normal'],dot.inputs[1])
    edge=mathnode(nt,'MINIMUM',1,mathnode(nt,'MULTIPLY',mathnode(nt,'SUBTRACT',1,dot.outputs['Value']),45))
    chip_noise=ramp(nt,noise.outputs['Fac'],[(.28,(0,0,0)),(.62,(1,1,1))])
    edge_chip=mathnode(nt,'MULTIPLY',edge,chip_noise)
    pits=ramp(nt,fine.outputs['Fac'],[(.72,(0,0,0)),(.80,(.38,.38,.38))])
    chips=mathnode(nt,'MAXIMUM',edge_chip,pits)
    ao=node(nt,'ShaderNodeAmbientOcclusion');ao.samples=24;ao.inputs['Distance'].default_value=.018
    dirt=mathnode(nt,'SUBTRACT',1,ao.outputs['AO'])
    dirt=mathnode(nt,'MULTIPLY',dirt,.28)
    variation=ramp(nt,noise.outputs['Fac'],[(.22,tuple(v*.55 for v in base)),(.77,tuple(min(1,v*1.18) for v in base))])
    if mat.name=='Paint rust orange':
        # Paint removal exposes actual metal values in the separate metallic map.
        worn=mix(nt,chips,variation,(.055,.067,.071))
        color=mix(nt,dirt,worn,(.018,.008,.004))
        metallic=mathnode(nt,'ADD',.12,mathnode(nt,'MULTIPLY',chips,.86))
        roughness=mix(nt,chips,(.68,.68,.68),(.32,.32,.32))
    elif mat.name.startswith('Metal'):
        color=mix(nt,mathnode(nt,'MULTIPLY',chips,.62),variation,(.25,.28,.28))
        color=mix(nt,mathnode(nt,'MULTIPLY',dirt,.65),color,(.012,.009,.007))
        metallic=mathnode(nt,'SUBTRACT',metal,mathnode(nt,'MULTIPLY',dirt,.32))
        roughness=ramp(nt,noise.outputs['Fac'],[(.24,(rough*.72,)*3),(.76,(min(.9,rough*1.55),)*3)])
    else:
        color=mix(nt,mathnode(nt,'MULTIPLY',edge,.30),variation,(.09,.095,.085))
        color=mix(nt,dirt,color,(.004,.004,.003))
        metallic=metal
        roughness=ramp(nt,fine.outputs['Fac'],[(.2,(.48,)*3),(.8,(.87,)*3)])
    combine=node(nt,'ShaderNodeCombineColor');combine.mode='RGB'
    nt.links.new(ao.outputs['AO'],combine.inputs['Red'])
    nt.links.new(roughness,combine.inputs['Green'])
    if isinstance(metallic,(float,int)):combine.inputs['Blue'].default_value=metallic
    else:nt.links.new(metallic,combine.inputs['Blue'])
    graphs[mat.name]={'base':color,'orm':combine.outputs['Color']}

images={}
for channel in ['base','orm']:
    image=bpy.data.images.new('RL9_'+channel,width=1024,height=1024,alpha=False)
    image.colorspace_settings.name='sRGB' if channel=='base' else 'Non-Color'
    for mat in mesh.materials:
        nt=mat.node_tree
        for n in nt.nodes:n.select=False
        target=node(nt,'ShaderNodeTexImage');target.image=image;target.select=True;nt.nodes.active=target
        out=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL')
        emit=node(nt,'ShaderNodeEmission')
        if mat.name in graphs:nt.links.new(graphs[mat.name][channel],emit.inputs['Color'])
        else:emit.inputs['Color'].default_value=originals[mat.name]['color'] if channel=='base' else (1,originals[mat.name]['roughness'],originals[mat.name]['metallic'],1)
        nt.links.new(emit.outputs[0],out.inputs['Surface'])
    print('BAKE_START',channel,flush=True)
    bpy.ops.object.bake(type='EMIT',use_clear=True)
    # JPEG avoids increasing this 8k triangle asset beyond the 800KB ceiling.
    scene.render.image_settings.file_format='JPEG'
    scene.render.image_settings.quality=76 if channel=='base' else 82
    scene.view_settings.view_transform='Standard' if channel=='base' else 'Raw'
    if channel=='orm':image.scale(512,512)
    file=OUT/(channel+'.jpg')
    image.save_render(str(file),scene=scene)
    images[channel]=bpy.data.images.load(str(file),check_existing=False)
    images[channel].colorspace_settings.name='sRGB' if channel=='base' else 'Non-Color'
    print('BAKE_DONE',channel,file.stat().st_size,flush=True)

group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
for mat in mesh.materials:
    nt=mat.node_tree;nt.nodes.clear();p=node(nt,'ShaderNodeBsdfPrincipled');p.name='Principled BSDF'
    out=node(nt,'ShaderNodeOutputMaterial');nt.links.new(p.outputs[0],out.inputs['Surface'])
    orig=originals[mat.name]
    p.inputs['Base Color'].default_value=orig['color'];p.inputs['Roughness'].default_value=orig['roughness'];p.inputs['Metallic'].default_value=orig['metallic']
    p.inputs['Emission Color'].default_value=orig['emission'];p.inputs['Emission Strength'].default_value=orig['emission_strength']
    if mat.name not in graphs:continue
    tex=node(nt,'ShaderNodeTexImage');tex.image=images['base'];nt.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    orm=node(nt,'ShaderNodeTexImage');orm.image=images['orm']
    sep=node(nt,'ShaderNodeSeparateColor');sep.mode='RGB';nt.links.new(orm.outputs['Color'],sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'],p.inputs['Roughness']);nt.links.new(sep.outputs['Blue'],p.inputs['Metallic'])
    oc=node(nt,'ShaderNodeGroup');oc.node_tree=group;nt.links.new(sep.outputs['Red'],oc.inputs['Occlusion'])

path=OUT/'heavy_0.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_image_format='AUTO')
assert path.stat().st_size<=800000, f'Over size ceiling: {path.stat().st_size}'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'heavy-pbr.blend'))
after=hashlib.sha256((ROOT/'public/assets/weapons/unique-v1/heavy_0.glb').read_bytes()).hexdigest()
assert before==after
(OUT/'summary.json').write_text(json.dumps({'triangles':triangles,'materials':len(mesh.materials),'bytes':path.stat().st_size,'originals':originals,'original_sha256':before,'production_unchanged':before==after,'current_checker':'Expected FAIL: images prohibited; no criteria changed.','maps':['UV-packed geometry-aware color and wear','AO/roughness/metallic packed map'],'limitations':'PBR proof only. Visual quality, game load, phone and checker validation pending.'},indent=2),encoding='utf8')
print('PBR_PROOF_COMPLETE',triangles,path.stat().st_size,flush=True)
