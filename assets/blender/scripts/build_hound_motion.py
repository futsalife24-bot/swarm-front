"""HOUND v3 motion-ready asset; reuse the approved geometry before static batching.
Run Blender --background --factory-startup --python-exit-code 1 --python this_file.
Writes only hound_motion_v1 artifacts. Static v3 remains byte-for-byte unchanged.
"""
from pathlib import Path
import json, math
import bpy
from mathutils import Vector, Matrix, Quaternion

SCRIPT = Path(__file__).resolve()
static = SCRIPT.with_name('build_hound_v3.py').read_text(encoding='utf-8-sig')
exec(compile(static.split('# Static prototype:')[0], str(SCRIPT), 'exec'))
SOURCE = REPO / 'assets/blender/source/hound_motion_v1.blend'
GLB = REPO / 'public/assets/enemies/hound_motion_v1.glb'
QA = REPO / 'dist-validation/hound-motion'
QA.mkdir(parents=True, exist_ok=True)
objects = list(root.children)

# Logical rig: body, two joints and a grounded toe for each leg, independent halo/plates.
legs = {}
for side, name in [(-1,'front_L'),(1,'front_R')]:
    legs[name] = [Vector((side*.35,.43,1.34)), Vector((side*.76,1.06,.97)), Vector((side*1.10,1.67,.12))]
for name,x,y,fx,fy,h in [('rear_A',-.46,-.58,-.65,-.93,.91),('rear_B',.48,-.62,.72,-1,.84),('rear_C',.04,-.82,.06,-1.39,.73)]:
    legs[name] = [Vector((x,y,h)), Vector((fx*.91,(y+fy)/2,.46)), Vector((fx,fy,.12))]
bpy.ops.object.select_all(action='DESELECT')
rig_data=bpy.data.armatures.new('HOUND_KinematicRig')
rig=bpy.data.objects.new('HOUND_RIG',rig_data)
bpy.context.collection.objects.link(rig);rig.parent=root
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    b=rig_data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=rig_data.edit_bones[parent]
    return b
bone('body',(0,0,1.05),(0,0,1.35))
for name,(hip,knee,toe) in legs.items():
    bone(name+'_upper',hip,knee,'body')
    bone(name+'_lower',knee,toe,name+'_upper')
    bone(name+'_toe',toe,toe+Vector((0,.18,0)),name+'_lower')
bone('ring',(.24,-.19,1.48),(.24,-.19,1.78),'body')
for i,p in enumerate([(-.2,.17,1.88),(.13,-.4,2.14),(-.1,-.98,1.60)],1):
    bone('spine_'+str(i),p,Vector(p)+Vector((0,.15,0)),'body')
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
rest={b.name:b.matrix_local.copy() for b in rig.data.bones}
for p in rig.pose.bones:p.rotation_mode='QUATERNION'

# Split the formerly static rear armor at its hinge; a rigid panel must not stretch across a knee.
for obj in list(objects):
    if not obj.name.startswith(('rear_shield_','rear_inset_')):continue
    label=obj.name.split('_')[-1];height=legs['rear_'+label][1].z
    for upper in [True,False]:
        copy=obj.copy();copy.data=obj.data.copy();bpy.context.collection.objects.link(copy)
        copy.name=obj.name.rsplit('_',1)[0]+('_upper_' if upper else '_lower_')+label
        bm=bmesh.new();bm.from_mesh(copy.data)
        cut=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=(0,0,height-copy.location.z),plane_no=(0,0,1),clear_inner=upper,clear_outer=not upper)
        border=[e for e in cut['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
        if border:bmesh.ops.holes_fill(bm,edges=border,sides=0)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(copy.data);bm.free()
        objects.append(copy)
    objects.remove(obj);bpy.data.objects.remove(obj,do_unlink=True)

def assign(obj):
    n=obj.name
    if n.startswith(('ring_housing','shoulder_ring','ring_clamp')):return 'ring'
    if n.startswith('spine_'):return 'spine_'+n.split('_')[-1].split('.')[0]
    label=n.split('_')[-1].split('.')[0]
    if label in ['L','R']:
        part='front_'+label
        if n.startswith(('lower_armor','recess_','light_','knee_hinge','armor_seam')):return part+'_lower'
        if n.startswith('front_leg'):return part
        if n.startswith('shoulder_hinge'):return 'body'
        return part+'_upper'
    if label in ['A','B','C']:
        part='rear_'+label
        if n.startswith('heel_cap'):return part+'_toe'
        if '_upper_' in n:return part+'_upper'
        if '_lower_' in n:return part+'_lower'
        if n.startswith(('rear_shield','rear_inset','rear_leg')):return part
        return 'body'
    return 'body'

for obj in objects:
    part=assign(obj)
    for b in rig.data.bones:obj.vertex_groups.new(name=b.name)
    for v in obj.data.vertices:
        co=obj.matrix_world@v.co
        weights={part:1.0}
        if part in legs:
            hip,knee,toe=legs[part]
            # Armor stays rigid; continuous chassis blades flex only around the joint.
            if co.z<.20:weights={part+'_toe':1.0}
            else:
                u=max(0,min(1,(co.z-knee.z+.07)/.14))
                weights={part+'_upper':u,part+'_lower':1-u}
        for name,w in weights.items():
            if w>0:obj.vertex_groups[name].add([v.index],w,'REPLACE')

meshes=[]
material_batches=[(mat,[o for o in objects if o.data.materials[0]==mat]) for mat in [shell,ivory,energy,steel]]
for mat,batch in material_batches:
    bpy.ops.object.select_all(action='DESELECT')
    for o in batch:o.select_set(True)
    bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join()
    o=bpy.context.object;o.name='HOUND_skin_'+mat.name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.data.materials.clear();o.data.materials.append(mat)
    for p in o.data.polygons:p.material_index=0
    m=o.modifiers.new('HOUND armature','ARMATURE');m.object=rig
    o.parent=rig;meshes.append(o)

def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def xform(name,head,tail):
    r=rest[name];v=rig.data.bones[name].tail_local-rig.data.bones[name].head_local
    q=v.rotation_difference(tail-head)
    out=q.to_matrix().to_4x4()@r;out.translation=head
    return out
def around(center,translation=Vector((0,0,0)),rotation=Quaternion(),scale=1):
    return Matrix.Translation(center+translation)@rotation.to_matrix().to_4x4()@Matrix.Scale(scale,4)@Matrix.Translation(-center)
def ik(hip,target,plane,l1,l2):
    delta=target-hip;distance=delta.length
    distance=max(abs(l1-l2)+1e-4,min(l1+l2-1e-5,distance))
    axis=delta.normalized()
    bend=plane.cross(axis)
    if bend.length<1e-5:bend=axis.cross(Vector((1,0,0)))
    bend.normalize();a=(l1*l1-l2*l2+distance*distance)/(2*distance)
    knee=hip+axis*a+bend*math.sqrt(max(0,l1*l1-a*a))
    return knee,hip+axis*distance

contact_samples={};reach_error=0
def pose(mode,t):
    global reach_error
    # In-place clips: world translation always belongs to gameplay.
    body_shift=Vector((0,0,0));pitch=0;roll=0;ring_scale=1;burst=0
    if mode=='Idle':
        body_shift.z=-.018*(1-math.cos(t*math.tau/4));pitch=.008*math.sin(t*math.tau/4)
    elif mode=='Locomotion':
        phase=t/.8*math.tau
        body_shift=Vector((0,-.035*math.sin(phase),-.12-.018*(1-math.cos(phase))))
        pitch=.025*math.sin(phase);roll=.018*math.sin(phase+1.2)
    else:
        charge=smooth(t/.36)
        if t<.45:
            shoot=smooth((t-.36)/.09)
            body_shift=Vector((0,-.08*charge+.18*shoot,-.13*charge));pitch=-.04*charge+.10*shoot
            ring_scale=1-.22*charge
        else:
            burst=1-smooth((t-.45)/.24)
            recovery=1-smooth((t-.45)/.75)
            body_shift=Vector((0,.10*burst,-.13*recovery));pitch=.06*burst
            ring_scale=1-.22*recovery
    B=around(Vector((0,0,1.05)),body_shift,Quaternion((1,0,0),pitch)@Quaternion((0,1,0),roll))
    rig.pose.bones['body'].matrix=B@rest['body']
    bpy.context.view_layer.update()
    for index,(name,(hip0,knee0,toe0)) in enumerate(legs.items()):
        hip=B@hip0;target=toe0.copy();lift=0;plant=True
        if mode=='Locomotion':
            phase=(t/.8+[0,.08,.40,.60,.80][index])%1
            duty=.5 if index<2 else .44
            travel=.36 if index<2 else .3168
            if phase<duty:offset=travel*(.5-phase/duty)
            else:
                f=(phase-duty)/(1-duty);offset=travel*(-.5+smooth(f));lift=(.19 if index<2 else .12)*math.sin(math.pi*f)**2;plant=False
            target.y+=offset-(.15 if index<2 else -.08)
            target.z+=lift
        l1=(knee0-hip0).length;l2=(toe0-knee0).length
        plane=(toe0-hip0).cross(knee0-hip0).normalized()
        knee,actual=ik(hip,target,B.to_3x3()@plane,l1,l2)
        reach_error=max(reach_error,(actual-target).length)
        rig.pose.bones[name+'_upper'].matrix=xform(name+'_upper',hip,knee)
        bpy.context.view_layer.update()
        rig.pose.bones[name+'_lower'].matrix=xform(name+'_lower',knee,actual)
        bpy.context.view_layer.update()
        # A separate toe keeps the flat contact plane horizontal, including turns/recovery.
        rig.pose.bones[name+'_toe'].matrix=Matrix.Translation(actual-toe0)@rest[name+'_toe']
        bpy.context.view_layer.update()
        contact_samples.setdefault(mode,[]).append({'time':round(t,4),'leg':name,'planted':plant,'ground':actual.z-.12,'target_error':(actual-target).length})
    # Independent mechanical stabilization. Ring contracts around its own center, never the body root.
    sway=.014*math.sin(t*math.tau/(4 if mode=='Idle' else .8)) if mode!='Lunge' else -.035*burst
    rig.pose.bones['ring'].matrix=B@around(Vector((.24,-.19,1.48)),rotation=Quaternion((0,0,1),sway),scale=ring_scale)@rest['ring']
    for i in range(1,4):
        period=4 if mode=='Idle' else .8 if mode=='Locomotion' else 1.2
        wave=math.sin(t*math.tau/period+(i-1)*2.1)-math.sin((i-1)*2.1)
        shift=Vector((.008*wave,(-.025*burst if mode=='Lunge' else 0),.018*wave))
        center=rest['spine_'+str(i)].translation
        rig.pose.bones['spine_'+str(i)].matrix=B@around(center,shift,Quaternion((0,1,0),.025*wave))@rest['spine_'+str(i)]
    bpy.context.view_layer.update()

scene=bpy.context.scene;scene.render.fps=60
rig.animation_data_create();actions=[]
for name,duration in [('Idle',4.0),('Locomotion',.8),('Lunge',1.2)]:
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame in range(round(duration*60)+1):
        scene.frame_set(frame);pose(name,frame/60)
        for pb in rig.pose.bones:
            pb.keyframe_insert('location',frame=frame,group=pb.name)
            pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
            pb.keyframe_insert('scale',frame=frame,group=pb.name)
    action.use_fake_user=True;actions.append(action)
    track=rig.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,0,action);track.mute=True
rig.animation_data.action=None
for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
root['motion_contract']=json.dumps({'version':1,'clips':{'Idle':4,'Locomotion':.8,'Lunge':1.2},'attack_contact_seconds':.45,'root_motion':False,'toe_count':5,'bones':20,'forward':'-Z','ground':'Y=0','nominal_cycle_distance':.72})
root['prototype']='motion-ready v1; 20-bone rig; four skinned materials; no gameplay edits'
scene.frame_start=0;scene.frame_end=240;scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);rig.select_set(True)
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False,export_texcoords=False)
data=GLB.read_bytes();gltf=json.loads(data[20:20+int.from_bytes(data[12:16],'little')])
assert {a['name'] for a in gltf.get('animations',[])}=={'Idle','Locomotion','Lunge'}
triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
assert 4960<=triangles<=5500 and len(gltf['materials'])==4
assert len(gltf['skins'])==1 and len(gltf['skins'][0]['joints'])==20
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(GLB))
assert sum(o.type=='ARMATURE' for o in scene.objects)==1
report={'triangles':triangles,'materials':4,'bones':20,'glb_bytes':len(data),'clips':[a['name'] for a in gltf['animations']],'max_ik_target_error':reach_error,'contacts':{n:{'min_ground':min(s['ground'] for s in ss),'max_planted_ground':max(abs(s['ground']) for s in ss if s['planted'])} for n,ss in contact_samples.items()},'export_import':'PASS','attack_contact_seconds':.45,'root_motion':False}
(QA/'blender-motion.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
(QA/'contact-samples.json').write_text(json.dumps(contact_samples),encoding='utf-8')
print('HOUND_MOTION_VALIDATION',json.dumps(report))
