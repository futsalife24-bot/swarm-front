"""HARROW Charakuru geometry adaptation; originals and public assets stay intact.
Blender --background --factory-startup --disable-autoexec --python-exit-code 1
  --python build_candidate.py [-- --animate]
"""
import bpy, json, math, sys, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix
P=Path(__file__).resolve().parent
KIT=Path('C:/Users/futsa/Documents/Codex/2026-10-07/https-x-com-dstudio-ai-status/tools/charakuru-1.0.2/charakuru-1.0.2-2026-10-07T16-58-19-992Z')
spec=importlib.util.spec_from_file_location('production',KIT/'scripts/production.py')
production=importlib.util.module_from_spec(spec);spec.loader.exec_module(production)
bpy.ops.wm.read_factory_settings(use_empty=True)
base=P;project=json.loads((P/'production-baseline.json').read_text(encoding='utf-8-sig'))
parts=production.inventory(project,base);restoration=[]
for group in project['production']['textureGroups']:
    returned=production.imported(P/'models/normalized-returns'/f'{group["id"]}.fbx')
    restoration.append(production.restore_uv([parts[n] for n in group['components']],returned))
    for o in returned:bpy.data.objects.remove(o,do_unlink=True)

SCALE=22.;GROUND=.09477;CENTER_X=.000975
def xyz(raw):
    x,y,z=raw
    return Vector(((y+.40)*SCALE,-(x-CENTER_X)*SCALE,(z-GROUND)*SCALE))
def smooth(t):
    t=max(0.,min(1.,t));return t*t*(3-2*t)
def body_position(v):
    v=v.copy()
    # Raise the posterior tail gradually from its root; original is a flying pose.
    if abs(v.x-CENTER_X)<.042 and v.y>-.34:v.z+=.13*smooth((v.y+.34)/.84)
    return xyz(v)
raw_neck=[(CENTER_X,-.416,.425),(CENTER_X,-.422,.468),(CENTER_X,-.435,.503),(CENTER_X,-.448,.543),(CENTER_X,-.461,.581),(CENTER_X,-.470,.617),(CENTER_X,-.475,.650)]
raw_tail=[(CENTER_X,-.405,.35),(CENTER_X,-.28,.295),(CENTER_X,-.15,.245),(CENTER_X,-.02,.204),(CENTER_X,.11,.158),(CENTER_X,.24,.11),(CENTER_X,.37,.057),(CENTER_X,.50,0)]
neck=list(map(xyz,raw_neck));tail=[body_position(Vector(v)) for v in raw_tail]
chains={};wings={}
for sign,side in [(1,'.L'),(-1,'.R')]:
    chains['Hindlimb'+side]=[xyz((sign*x,y,z)) for x,y,z in [(.052,-.402,.357),(.116,-.400,.316),(.120,-.405,.265),(.135,-.416,.224)]]
    chains['Forelimb'+side]=[xyz((sign*x,y,z)) for x,y,z in [(.032,-.42,.47),(.045,-.395,.465),(.061,-.385,.49),(.068,-.383,.503)]]
    wings[side]=[xyz((sign*x,y,z)) for x,y,z in [(.044,-.40,.44),(.123,-.36,.50),(.205,-.295,.532),(.40,-.22,.37)]]
arm=bpy.data.armatures.new('HARROW Charakuru skeleton');rig=bpy.data.objects.new('HARROW',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
bones={}
def bone(name,a,b,parent=None):
    e=arm.edit_bones.new(name);e.head=a;e.tail=b
    if parent:e.parent=arm.edit_bones[parent]
    bones[name]={'head':list(a),'tail':list(b),'parent':parent}
bone('Root',(0,0,0),(0,0,.6));torso=xyz((CENTER_X,-.407,.378));bone('Torso',torso,torso+Vector((0,0,1)),'Root')
for i in range(6):bone(f'Neck.{i:02}',neck[i],neck[i+1],'Torso' if i==0 else f'Neck.{i-1:02}')
bone('Head',neck[-1],neck[-1]+Vector((0,0,1.5)),'Neck.05')
# Retain runtime bone contract; this faceless head has no animated jaw geometry.
bone('Jaw',neck[-1],neck[-1]+Vector((-.5,0,0)),'Head')
for name,q in chains.items():
    for i in range(3):bone(f'{name}.{i}',q[i],q[i+1],'Torso' if i==0 else f'{name}.{i-1}')
    bone(name+'.3',q[3],q[3]+Vector((-.6,0,-.2)),name+'.2')
for side,q in wings.items():
    for i,name in enumerate(['Wing upper','Wing fore','Wing fan']):bone(name+side,q[i],q[i+1],'Torso' if i==0 else ['Wing upper','Wing fore'][i-1]+side)
for i in range(7):bone(f'Tail.{i:02}',tail[i],tail[i+1],'Torso' if i==0 else f'Tail.{i-1:02}')
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
assert len(arm.bones)==39
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'

def nearest(v,chain):
    results=[]
    for i,(a,b) in enumerate(zip(chain,chain[1:])):
        d=b-a;t=max(0.,min(1.,(v-a).dot(d)/d.length_squared));results.append(((v-a-t*d).length_squared,i,t))
    return min(results)
def link_weights(v,chain,names,blend=False):
    _,i,t=nearest(v,chain)
    if not blend:return {names[i]:1.}
    u=i+t-.5;lo=max(0,min(len(names)-1,math.floor(u)));hi=max(0,min(len(names)-1,math.floor(u)+1));f=u-math.floor(u)
    return {names[lo]:1.} if lo==hi else {names[lo]:1-f,names[hi]:f}
def assign(o,weights):
    for idx,values in enumerate(weights):
        for name,w in values.items():
            if w>1e-8:(o.vertex_groups.get(name) or o.vertex_groups.new(name=name)).add([idx],w,'REPLACE')
    o.parent=rig;mod=o.modifiers.new('HARROW skin','ARMATURE');mod.object=rig

removed=['body_00050','body_00051','body_00212','body_00213','body_00092']
missile_ids=['body_00004','body_00005','body_00006','body_00008','body_00009','body_00010','body_00011','body_00012','body_00015','body_00018']
report={'restoration':restoration,'scale':SCALE,'removed':[], 'parts':[], 'bones':bones}
groups={};launchers=[];foot_samples={'.L':[],'.R':[]};wing_samples={'.L':[],'.R':[]}
for part_id,o in parts.items():
    raw=[v.co.copy() for v in o.data.vertices];lo=Vector([min(v[i] for v in raw) for i in range(3)]);hi=Vector([max(v[i] for v in raw) for i in range(3)]);mid=(lo+hi)*.5
    if part_id in removed:
        report['removed'].append({'id':part_id,'vertices':len(raw),'min':list(lo),'max':list(hi),'reason':'shin artifact' if part_id in removed[:2] else 'neck rear artifact' if part_id=='body_00092' else 'sixth missile'})
        bpy.data.objects.remove(o,do_unlink=True);continue
    side='.L' if mid.x>CENTER_X else '.R';rigid=True
    if part_id.startswith('head'):
        kind='Head';positions=[xyz((v.x*.135+CENTER_X,v.y*.135-.475,v.z*.135+.625)) for v in raw];weights=[{'Head':1.} for v in raw]
    else:
        positions=[body_position(v) for v in raw]
        if part_id in missile_ids:
            kind='Launcher'+side+'_'+part_id;weights=[{'Wing fore'+side:1.} for v in raw]
            tip_index=max(range(len(raw)),key=lambda i:raw[i].z);launchers.append({'id':part_id,'side':side,'bone':'Wing fore'+side,'point':list(positions[tip_index])})
        elif part_id=='body_00002':
            kind='TorsoTail';weights=[];rigid=False
            for raw_v,v in zip(raw,positions):
                if raw_v.y>-.34:weights.append(link_weights(v,tail,[f'Tail.{i:02}' for i in range(7)],True))
                elif raw_v.z>.44:weights.append(link_weights(v,neck,[f'Neck.{i:02}' for i in range(6)],True))
                else:weights.append({'Torso':1.})
        elif max(abs(lo.x-CENTER_X),abs(hi.x-CENTER_X))<.039 and hi.z>.48:
            kind='Neck';weights=[link_weights(v,neck,[f'Neck.{i:02}' for i in range(6)],True) for v in positions];rigid=False
        elif hi.z<.366 and abs(mid.x-CENTER_X)>.041 and mid.y<-.35:
            kind='Hindlimb'+side;q=chains[kind]
            if hi.z<.235:weights=[{kind+'.3':1.} for v in raw]
            else:weights=[link_weights(body_position(mid),q,[kind+f'.{i}' for i in range(3)]) for v in raw]
            foot_samples[side].extend({'bone':next(iter(w)),'point':list(v)} for v,w in zip(positions,weights))
        elif hi.z>.43 and max(abs(lo.x),abs(hi.x))<.082 and min(abs(lo.x),abs(hi.x))>.027:
            kind='Forelimb'+side;q=chains[kind];weights=[link_weights(body_position(mid),q,[kind+f'.{i}' for i in range(3)]) for v in raw]
        elif abs(mid.x-CENTER_X)>.075 or max(abs(lo.x),abs(hi.x))>.15:
            kind='Wing'+side;q=wings[side];names=['Wing upper'+side,'Wing fore'+side,'Wing fan'+side]
            # The input is a flying reference pose: lift the hanging outer tips
            # smoothly to give the grounded rest pose clearance, keeping roots fixed.
            for pos,raw_v in zip(positions,raw):pos.z+=.77*smooth((abs(raw_v.x-CENTER_X)-.20)/.28)
            if min(abs(lo.x),abs(hi.x))>.17 and part_id!='body_00001':weights=[{'Wing fan'+side:1.} for v in raw]
            elif part_id=='body_00001':weights=[link_weights(v,q,names,True) for v in positions];rigid=False
            else:weights=[link_weights(body_position(mid),q,names) for v in raw]
            wing_samples[side].extend({'bone':max(w,key=w.get),'point':list(v)} for v,w in zip(positions,weights) if max(w.values())>.999)
        else:kind='Torso';weights=[{'Torso':1.} for v in raw]
    for v,pos in zip(o.data.vertices,positions):v.co=pos
    assign(o,weights);groups.setdefault(kind,[]).append(o)
    report['parts'].append({'id':part_id,'kind':kind,'vertices':len(raw),'rigid':rigid,'bones':sorted(set(n for w in weights for n in w))})

# Three curved metal talons extend each formerly fused upper-hand stub.
mat=bpy.data.materials.new('Obsidian claws');mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.014,.018,.024,1);bs.inputs['Metallic'].default_value=.65;bs.inputs['Roughness'].default_value=.3
for sign,side in [(1,'.L'),(-1,'.R')]:
    for finger in range(3):
        origin=Vector((sign*(.060+finger*.009),-.389,.501));pts=[origin,origin+Vector((sign*.004,-.006,.017)),origin+Vector((sign*.002,-.021,.022)),origin+Vector((-sign*.003,-.031,.009))]
        vs=[];fs=[]
        for j,p in enumerate(pts):
            direction=(pts[min(j+1,3)]-pts[max(j-1,0)]).normalized();a=direction.cross(Vector((1,0,0))).normalized();b=direction.cross(a);radius=[.005,.0045,.003,.0004][j]
            for k in range(8):vs.append(xyz(p+radius*(a*math.cos(k*math.tau/8)+b*math.sin(k*math.tau/8))))
        for j in range(3):
            for k in range(8):fs.append((j*8+k,j*8+(k+1)%8,(j+1)*8+(k+1)%8,(j+1)*8+k))
        fs.extend([tuple(reversed(range(8))),tuple(range(24,32))]);mesh=bpy.data.meshes.new('Upper talon');mesh.from_pydata(vs,[],fs);mesh.materials.append(mat)
        obj=bpy.data.objects.new('Upper talon',mesh);bpy.context.collection.objects.link(obj);assign(obj,[{'Forelimb'+side+'.3':1.} for _ in vs]);groups.setdefault('Forelimb'+side,[]).append(obj)

model=[]
for kind,objects in groups.items():
    obj=production.join(objects,kind);model.append(obj)
    # Joining preserves weights but only the active object's armature modifier.
    assert obj.parent==rig and len([m for m in obj.modifiers if m.type=='ARMATURE'])==1
    for poly in obj.data.polygons:poly.use_smooth=True
for obj in model:
    for material in obj.data.materials:
        material.use_nodes=True;shader=material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Metallic'].default_value=.40 if obj.name!='Head' else .6;shader.inputs['Roughness'].default_value=.42
        material.use_backface_culling=False
    assert all(abs(sum(g.weight for g in v.groups)-1)<1e-5 for v in obj.data.vertices)
    # Keep mesh and bone node names distinct after GLTFLoader sanitizes them.
    if obj.name in ('Head','Torso'):obj.name += ' surface'
contacts={s:min(values,key=lambda p:p['point'][2]) for s,values in foot_samples.items()}
wing_contacts={s:max(values,key=lambda p:math.hypot(p['point'][0],p['point'][1])) for s,values in wing_samples.items()}
metadata={'game_scale':1.95,'ground_contacts':contacts,'wing_contacts':wing_contacts,'wing_samples':wing_samples,'launcher_tips':sorted(launchers,key=lambda p:(p['side'],p['id']))}
(P/'rig-metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
report.update(meshes=len(model),vertices=sum(len(o.data.vertices) for o in model),triangles=sum(len(p.vertices)-2 for o in model for p in o.data.polygons),contacts=contacts,wing_contacts=wing_contacts)
if '--animate' in sys.argv:
    sys.path.insert(0,str(P));from animation_contract import animate
    report['animation']=animate(rig,metadata)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=6
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.28,.31,.36,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
scene.render.resolution_x=1400;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
def area(name,pos,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((1,0,6))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key',(-12,-15,22),6000,12);area('Rim',(10,12,20),6500,10);area('Front',(-16,9,10),4500,12)
for name,position,scale in [('front',(-40,0,7),27),('side',(8,-40,7),28),('hero',(-25,-35,19),32),('back',(40,0,7),27)]:
    data=bpy.data.cameras.new(name);data.type='ORTHO';data.ortho_scale=scale;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=position;o.rotation_euler=(Vector((8 if name=='side' else 4 if name=='hero' else 2,0,6.6))-o.location).to_track_quat('-Z','Y').to_euler()
scene.camera=bpy.data.objects['hero'];bpy.ops.file.pack_all()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in model:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(P/'harrow.blend'))
if '--animate' in sys.argv:bpy.ops.export_scene.gltf(filepath=str(P/'harrow.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False,export_extras=True)
(P/'build-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
for name in ([] if '--no-render' in sys.argv else ['front','side','hero','back']):
    scene.camera=bpy.data.objects[name];scene.render.filepath=str(P/'review'/f'adapted-{name}.png');bpy.ops.render.render(write_still=True)
print('HARROW_CANDIDATE',json.dumps({k:report[k] for k in ['meshes','vertices','triangles','contacts','wing_contacts']}))
