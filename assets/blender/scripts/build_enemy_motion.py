"""Regenerate approved geometry in memory, then export separate motion prototypes.
Blender --background --factory-startup --python-exit-code 1 --python this_file -- prism|ray|foundry_zero
No edits to approved static generators or assets. Standard glTF skeletal animation.
"""
from pathlib import Path
import sys, math, json, struct, hashlib
import bpy
from mathutils import Vector, Matrix, Quaternion
sys.path.insert(0,str(Path(__file__).parent))
import phase1_common as c

name=sys.argv[sys.argv.index('--')+1]
assert name in ['prism','ray','foundry_zero']
script=Path(__file__).with_name('build_'+name+'_v1.py')
code=script.read_text(encoding='utf-8-sig').rsplit('\nexport(',1)[0]
c.ACTIVE='body'
original_finish=c.finish
def tagged(o,n,m):
    o=original_finish(o,n,m);o['motion_part']=c.ACTIVE
    if n.startswith('chassis_'):o['motion_part']='body'
    return o
c.finish=tagged
if name=='prism':
    code=code.replace(' R=Euler(rot).to_matrix();c=Vector(pos)'," common.ACTIVE='shield_'+str(index)\n R=Euler(rot).to_matrix();c=Vector(pos)")
    code=code.replace('# Nested lower stabilizer',"common.ACTIVE='body'\n# Nested lower stabilizer")
elif name=='ray':
    code=code.replace('for side in [-1,1]:',"for side in [-1,1]:\n common.ACTIVE='fin_'+str(side)")
    code=code.replace('# Skewed elliptical',"common.ACTIVE='body'\n# Skewed elliptical")
    code=code.replace(' side=tail-1;path=[]'," common.ACTIVE='tail_'+str(tail)\n side=tail-1;path=[]")
else:
    code=code.replace('for i in range(6):',"for i in range(6):\n common.ACTIVE='leg_'+str(i)")
    code=code.replace('# Asymmetric service towers',"common.ACTIVE='body'\n# Asymmetric service towers")
    code=code.replace('for side,z,length in [', 'for side,z,length in [')
    code=code.replace(' start=Vector((side*1.10'," common.ACTIVE='crane_'+str(side)\n start=Vector((side*1.10")
    code=code.replace('# Lower deployment bay',"common.ACTIVE='body'\n# Lower deployment bay")
exec(compile(code,str(script),'exec'),{'__file__':str(script)})
root=c.ROOT;objects=list(root.children)
qa=c.REPO/'dist-validation/enemies-motion'/name;qa.mkdir(parents=True,exist_ok=True)
rest_vertices=sum(len(o.data.vertices) for o in objects)
rig_data=bpy.data.armatures.new(name+'_rig');rig=bpy.data.objects.new(name+'_rig',rig_data)
bpy.context.collection.objects.link(rig);rig.parent=root
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
centers={};legs={}
def bone(n,head,tail=None):
    head=Vector(head);b=rig_data.edit_bones.new(n);b.head=head;b.tail=Vector(tail) if tail is not None else head+Vector((0,0,.25));centers[n]=head
bone('body',(0,0,1.5))
if name=='prism':
    for i in range(8):
        group=[o for o in objects if o['motion_part']=='shield_'+str(i)]
        points=[v.co for o in group for v in o.data.vertices]
        bone('shield_'+str(i),sum(points,Vector())/len(points))
elif name=='ray':
    for side in [-1,1]:bone('fin_'+str(side),(side*.45,.1,1.3))
    for i in range(3):
        for j in range(4):bone('tail_'+str(i)+'_'+str(j),((i-1)*(.23+.53*j/3),-.60-(1.70+i*.15)*j/3,1))
else:
    for i in range(6):
        a=(i+.5)*math.tau/6;x,y=math.cos(a),math.sin(a)
        hip=Vector((x*1.46,y*1.46,2.35))*1.25;knee=Vector((x*2.24,y*2.24,1.82))*1.25;toe=Vector((x*2.92,y*2.92,.19))*1.25
        legs['leg_'+str(i)]=(hip,knee,toe)
        bone('leg_'+str(i)+'_upper',hip,knee);bone('leg_'+str(i)+'_lower',knee,toe);bone('leg_'+str(i)+'_toe',toe)
    for s,z in [(-1,3.79),(1,3.43)]:bone('crane_'+str(s),(s*1.1*1.25,-.24*1.25,z*1.25))
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
rest={b.name:b.matrix_local.copy() for b in rig.data.bones}
for p in rig.pose.bones:p.rotation_mode='QUATERNION'
for o in objects:
    part=o['motion_part'];centroid=sum((v.co for v in o.data.vertices),Vector())/len(o.data.vertices)
    for v in o.data.vertices:
        weights={part:1}
        if name=='ray' and part.startswith('tail_'):
            i=int(part[-1]);t=max(0,min(3,(-v.co.y-.60)/(1.70+i*.15)*3));j=min(2,int(t));weights={part+'_'+str(j):1-(t-j),part+'_'+str(j+1):t-j}
        elif name=='foundry_zero' and part.startswith('leg_'):
            hip,knee,toe=legs[part]
            if o.name.startswith(('pylon_foot','independent_toe','toe_grip','sole_anchor','foot_toe')):weights={part+'_toe':1}
            elif o.name.startswith(('upper_box','hydraulic_piston')):weights={part+'_upper':1}
            elif o.name.startswith(('knee_','layered_white','exposed_ram','polished_ram','ram_base','armor_lock','shin_service','lower_hydraulic','pylon_warning')):weights={part+'_lower':1}
            else:weights={part+('_upper' if centroid.z>knee.z else '_lower'):1}
        for n,w in weights.items():
            if w>0:
                g=o.vertex_groups.get(n) or o.vertex_groups.new(name=n);g.add([v.index],w,'REPLACE')
meshes=[]
batches=[(mat,[o for o in objects if o.data.materials[0]==mat]) for mat in c.MATS]
for mat,batch in batches:
    bpy.ops.object.select_all(action='DESELECT')
    for o in batch:o.select_set(True)
    bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join();o=bpy.context.object
    o.name=name+'_skin_'+mat.name;o.data.materials.clear();o.data.materials.append(mat)
    for p in o.data.polygons:p.material_index=0
    mod=o.modifiers.new('motion','ARMATURE');mod.object=rig;o.parent=rig;meshes.append(o)

def around(n,move=(0,0,0),axis=(0,0,1),angle=0):
    center=centers[n];return Matrix.Translation(center+Vector(move))@Quaternion(axis,angle).to_matrix().to_4x4()@Matrix.Translation(-center)@rest[n]
def aim(n,head,tail):
    r=rest[n];q=(rig.data.bones[n].tail_local-rig.data.bones[n].head_local).rotation_difference(tail-head)
    m=q.to_matrix().to_4x4()@r;m.translation=head;return m
def ik(hip,target,knee,rest_hip=None):
    l1=(knee-(rest_hip if rest_hip is not None else hip)).length;l2=(legs_current_toe-knee).length;delta=target-hip;d=delta.length
    assert abs(l1-l2)<d<l1+l2,(name,hip,target,d,l1+l2)
    axis=delta.normalized();bend=knee-hip-axis*(knee-hip).dot(axis);bend.normalize()
    a=(l1*l1-l2*l2+d*d)/(2*d)
    return hip+axis*a+bend*math.sqrt(max(0,l1*l1-a*a))
durations={'Idle':4.,'Locomotion':2.,'Attack':1.6}
if name=='ray':durations['Attack']=3.6
if name=='foundry_zero':durations['Attack']=4.8
def ease(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def envelope(t,up,hold,down):
    return ease(t/up) if t<up else 1 if t<hold else 1-ease((t-hold)/(down-hold))
def pose(mode,t):
    global legs_current_toe
    phase=math.tau*t/durations[mode];wave=math.sin(phase);pulse=math.sin(phase/2)**2
    for n,p in rig.pose.bones.items():p.matrix=rest[n]
    if name=='prism':
        rig.pose.bones['body'].matrix=around('body',(0,-.10*pulse if mode=='Attack' else 0,.04*wave))
        for i in range(8):
            n='shield_'+str(i);p=centers[n];amplitude=.065 if mode=='Idle' else .14
            move=Vector((0,0,amplitude*math.sin(phase+i*math.tau/8)))
            if mode=='Attack':move+=Vector((p.x*.20*pulse,-.18*pulse,.04*pulse))
            rig.pose.bones[n].matrix=around(n,move,(0,1,0),.07*math.sin(phase+i*.7)+(.18*pulse if mode=='Attack' else 0))
    elif name=='ray':
        amp=.035 if mode=='Idle' else .16
        rig.pose.bones['body'].matrix=around('body',(0,.12*pulse if mode=='Attack' else 0,.018*wave))
        for side in [-1,1]:
            n='fin_'+str(side);rig.pose.bones[n].matrix=around(n,(0,0,.018*wave),(0,1,0),side*(amp*wave+(.22*pulse if mode=='Attack' else 0)))
        for i in range(3):
            for j in range(4):
                n=f'tail_{i}_{j}';a=phase-j*.65+i*.8
                rig.pose.bones[n].matrix=around(n,(.055*j*math.sin(a),0,.035*j*math.sin(a+.5)),(0,0,1),.055*j*math.sin(a))
        if mode=='Attack':
            # Broad wind-up, powerful downstroke and forward body thrust, then recovery.
            charge=envelope(t,1.25,1.45,2.05)
            strike=envelope(max(0,t-1.45),.60,.75,1.95) if t>=1.45 else 0
            lift=.70*charge+.42*strike
            body=Matrix.Translation(Vector((0,-.45*charge+1.0*strike,lift)))@Matrix.Translation(centers['body'])@Quaternion((1,0,0),.20*charge-.28*strike).to_matrix().to_4x4()@Matrix.Translation(-centers['body'])
            rig.pose.bones['body'].matrix=body@rest['body']
            for side in [-1,1]:
                n='fin_'+str(side)
                rig.pose.bones[n].matrix=body@around(n,axis=(0,1,0),angle=side*(-.85*charge+.55*strike))
            for i in range(3):
                for j in range(4):
                    n=f'tail_{i}_{j}';amp=(.12*charge+.21*strike)*j
                    rig.pose.bones[n].matrix=body@around(n,(amp*math.sin(t*4-j*.75+i),0,.075*j*charge),(0,0,1),amp*.45*math.sin(t*4-j*.75+i))
    else:
        shift=Vector((0,0,-(.045 if mode=='Idle' else .14)*pulse))
        rig.pose.bones['body'].matrix=around('body',shift)
        for i,(n,(hip,knee,toe)) in enumerate(legs.items()):
            target=toe.copy();legs_current_toe=toe
            if mode=='Locomotion':
                u=(t/2+(i%2)*.5)%1
                # Tripod cycle: stationary-height stance, smooth lifted return. In-place clip.
                if u<.5:target.y+=.24*(.5-2*u)
                else:
                    s=(u-.5)*2;target.y+=.24*(-.5+s);target.z+=.28*math.sin(math.pi*s)**2
            h=hip+shift;k=ik(h,target,knee)
            rig.pose.bones[n+'_upper'].matrix=aim(n+'_upper',h,k)
            rig.pose.bones[n+'_lower'].matrix=aim(n+'_lower',k,target)
            rig.pose.bones[n+'_toe'].matrix=around(n+'_toe',target-toe)
        for s in [-1,1]:
            n='crane_'+str(s);rig.pose.bones[n].matrix=around(n,shift,(0,0,1),s*(.025*wave+(.09*pulse if mode=='Attack' else 0)))
        if mode=='Attack':
            # Rear tripod stays planted. Fore tripod and the chassis rear up together.
            # 0–1.9 rise, 1.9–2.4 hold, 2.4–3.1 slam, 3.1–4.8 settle.
            rear=envelope(t,1.9,2.4,3.1)
            settle=.20*math.sin(math.pi*(t-3.1)/1.7)**2 if t>=3.1 else 0
            pivot=Vector((0,-1.5,2.94))
            body=Matrix.Translation(Vector((0,-.35*rear,-.45*rear-settle)))@Matrix.Translation(pivot)@Quaternion((1,0,0),.55*rear).to_matrix().to_4x4()@Matrix.Translation(-pivot)
            rig.pose.bones['body'].matrix=body@rest['body']
            for n,(hip,knee,toe) in legs.items():
                legs_current_toe=toe;front=toe.y>0
                target=body@toe if front else toe.copy()
                if front:target.z+=.65*rear+settle
                h=body@hip;k=ik(h,target,knee,hip)
                rig.pose.bones[n+'_upper'].matrix=aim(n+'_upper',h,k)
                rig.pose.bones[n+'_lower'].matrix=aim(n+'_lower',k,target)
                rig.pose.bones[n+'_toe'].matrix=around(n+'_toe',target-toe,(1,0,0),.30*rear if front else 0)
            for s in [-1,1]:
                n='crane_'+str(s);rig.pose.bones[n].matrix=body@around(n,axis=(0,0,1),angle=s*.12*rear)
    bpy.context.view_layer.update()

rig.animation_data_create();bpy.context.scene.render.fps=30
for mode,duration in durations.items():
    action=bpy.data.actions.new(mode);rig.animation_data.action=action
    for f in range(round(duration*30)+1):
        pose(mode,f/30)
        for p in rig.pose.bones:
            p.keyframe_insert('location',frame=f);p.keyframe_insert('rotation_quaternion',frame=f);p.keyframe_insert('scale',frame=f)
    action.use_fake_user=True;track=rig.animation_data.nla_tracks.new();track.name=mode;track.strips.new(mode,0,action);track.mute=True
rig.animation_data.action=None
for p in rig.pose.bones:p.matrix_basis.identity()
bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
root['motion_contract']=f"in-place; Idle / Locomotion loops; Attack {durations['Attack']} seconds; standalone prototype, not combat-timing integration"
if name=='foundry_zero':root['attack_impact_seconds']=3.1
source=c.REPO/'assets/blender/source'/f'{name}_motion_v1.blend';glb=c.REPO/'public/assets/enemies'/f'{name}_motion_v1.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);rig.select_set(True)
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False,export_texcoords=False)
data=glb.read_bytes();length=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+length])
assert {a['name'] for a in gltf['animations']}==set(durations)
triangles=sum(len(o.data.loop_triangles) for o in meshes)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(glb))
report={'name':name,'bones':len(centers),'materials':len(c.MATS),'clips':durations,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'source_generator_sha256':hashlib.sha256(script.read_bytes()).hexdigest(),'export_reimport':'PASS','scope':'standalone motion prototype; no gameplay integration'}
(qa/'blender-validation.json').write_text(json.dumps(report,indent=2));print('MOTION PASS',json.dumps(report))
