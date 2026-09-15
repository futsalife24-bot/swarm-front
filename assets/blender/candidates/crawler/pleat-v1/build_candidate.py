"""PLEAT, isolated deterministic candidate. Run with --blockout for the first silhouette pass.
Reuses local copy of phase1_common mesh helpers; IK/NLA workflow from build_hound_motion.py.
All outputs stay beside this file. Does not load or overwrite an existing user scene.
"""
from pathlib import Path
import sys, json, math, random, hashlib
import bpy
from mathutils import Vector, Matrix, Quaternion

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import phase1_common as c
P = json.loads((HERE/'parameters.json').read_text())
BLOCK = '--blockout' in sys.argv
TAG = 'pleat_blockout' if BLOCK else 'pleat_motion_v1'
rng = random.Random(P['seed'])
c.REPO = HERE  # Only helper geometry functions are reused; c.export() is never called.
root = c.setup('pleat')
root['candidate_status'] = 'proposal; user visual approval pending'
root['reference_id'] = 'crawler'
colors = P['materials']
felt = c.mat('dry_felt', (.35,.38,.37) if BLOCK else colors['felt'], rough=.94)
horn = c.mat('grown_edge', (.35,.38,.37) if BLOCK else colors['horn'], rough=.76)
support = c.mat('hardened_support', (.35,.38,.37) if BLOCK else colors['support'], rough=.82)
seam = c.mat('pressure_seam', (.35,.38,.37) if BLOCK else colors['seam'], rough=.55, emit=0 if BLOCK else .18)
materials = [felt, horn, support, seam]
parts = []

def tag(o, bone):
    o['part_bone'] = bone
    parts.append(o)
    return o

def tube(name, centers, widths, depths, mat, bone, sides=10):
    """Smooth closed tapered sweep; each cross section lies perpendicular to its tangent."""
    pts = [Vector(p) for p in centers]; verts=[]; faces=[]
    for j, p in enumerate(pts):
        tangent=(pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)]).normalized()
        side=tangent.cross(Vector((0,0,1)))
        if side.length<.05: side=tangent.cross(Vector((0,1,0)))
        side.normalize();up=side.cross(tangent).normalized()
        for k in range(sides):
            a=k*math.tau/sides
            verts.append(p+side*(math.cos(a)*widths[j])+up*(math.sin(a)*depths[j]))
    for j in range(len(pts)-1):
        for k in range(sides):
            a=j*sides+k;b=j*sides+(k+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(range(sides-1,-1,-1)))
    faces.append(tuple((len(pts)-1)*sides+k for k in range(sides)))
    o=tag(c.mesh(name,verts,faces,mat),bone)
    for f in o.data.polygons:f.use_smooth=True
    return o

def ell(name, pos, size, mat, bone, sub=2):
    o=tag(c.ico(name,pos,size,mat,sub),bone)
    for f in o.data.polygons:f.use_smooth=True
    return o

# Two broad, continuous dorsal masses. The narrower bridge leaves open negative space beneath.
for label, y0, y1, height, width in [('front',-.05,1.05,1.13,.65),('rear',-1.42,.06,1.20,.70)]:
    centers=[]; widths=[]; depths=[]
    for j in range(11):
        u=j/10;s=math.sin(math.pi*(.03+.94*u))
        centers.append((0,y0+(y1-y0)*u,height+.035*math.sin(math.pi*u)))
        widths.append(.045+width*s**.62);depths.append(.07+.30*s)
    tube('mantle_'+label,centers,widths,depths,felt,'mantle_'+label,sides=16)
    # Wide-grown edge is a layered keratin fringe, not manufactured trim.
    for side in [-1,1]:
        centers2=[(side*w*.93,p[1],p[2]-.11) for p,w in zip(centers,widths)]
        tube('edge_'+label+str(side),centers2,[.035]*11,[.065]*11,horn,'mantle_'+label,sides=6)
    if not BLOCK:
        # Large matted clumps follow the surface and do not create a particle/hair dependency.
        for j in range(7):
            u=.22+j*.09;y=y0+(y1-y0)*u
            for k in range(9):
                a=(k-4)*.30
                lean=rng.uniform(.15,.23)
                def surface(da,dy,lift):
                    v=max(.02,min(.98,(y+dy-y0)/(y1-y0)));s=math.sin(math.pi*(.03+.94*v))
                    return ((.045+width*s**.62)*math.sin(a+da),y+dy,
                            height+.035*math.sin(math.pi*v)+(.07+.30*s)*math.cos(a+da)+lift)
                verts=[surface(-.11,0,.012),surface(.11,0,.012),surface(.08,-lean,.030),
                       surface(0,-lean-.06,.06),surface(-.08,-lean,.030),surface(0,-.06,.035)]
                faces=[(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5),(4,3,2,1,0)]
                tag(c.mesh('felt_clump_'+label+f'_{j}_{k}',verts,faces,felt),'mantle_'+label)

tube('axial_sling',[(0,-1.04,.83),(0,-.55,.70),(0,0,.66),(0,.52,.72),(0,.84,.78)],
     [.09,.12,.10,.12,.09],[.07,.10,.08,.10,.07],support,'body',10)

# Four folded support limbs. Independent toes keep contact patches flat through compression.
legs={}
for front in [True,False]:
    for side,label in [(-1,'L'),(1,'R')]:
        name=('fore_' if front else 'hind_')+label
        hip=Vector((side*.45,.53 if front else -.69,.96 if front else .97))
        knee=Vector((side*.98,.05 if front else -.25,.56))
        toe=Vector((side*.86,1.02 if front else -1.16,.07))
        legs[name]=(hip,knee,toe)
        for seg,a,b in [('upper',hip,knee),('lower',knee,toe)]:
            mid=a.lerp(b,.50)+Vector((side*.03,0,.025))
            tube(name+'_'+seg,[a,mid,b],[.10,.14,.075],[.065,.095,.055],support,name+'_'+seg,10)
            if not BLOCK:
                tube(name+'_'+seg+'_growth',[a*.8+mid*.2,mid,mid*.3+b*.7],
                     [.055,.08,.03],[.034,.04,.025],horn,name+'_'+seg,6)
        # Flattened spatulate pad, all bottom vertices exactly at Z=0.
        x,y,z=toe
        verts=[(x-.13,y-.18,0),(x+.13,y-.18,0),(x+.17,y+.22,0),(x-.17,y+.22,0),
               (x-.10,y-.12,.13),(x+.10,y-.12,.13),(x+.13,y+.16,.055),(x-.13,y+.16,.055)]
        tag(c.mesh(name+'_pad',verts,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],horn),name+'_toe')

# A low anterior pressure organ. Paired pleats wrap an opening; there is no mouth or eye.
for side,label in [(-1,'L'),(1,'R')]:
    tube('breast_pleat_'+label,[(side*.42,.53,.77),(side*.62,.89,.54),(side*.49,1.15,.32),(side*.17,1.25,.27)],
         [.16,.20,.18,.065],[.10,.14,.12,.05],horn,'breast_'+label,12)
    tube('breast_seam_'+label,[(side*.39,.62,.68),(side*.52,.91,.45),(side*.36,1.18,.30)],
         [.021,.027,.012],[.024,.025,.013],seam,'breast_'+label,8)
    tube('flank_pleat_'+label,[(side*.48,-.82,.84),(side*.55,-.32,.68),(side*.42,.15,.80)],
         [.07,.10,.065],[.055,.065,.05],horn,'flank_'+label,10)
    if not BLOCK:
        for j in range(3):
            y=-.6+j*.19
            tube('dry_fold_'+label+str(j),[(side*.35,y,.87),(side*.51,y+.06,.72),(side*.39,y+.12,.59)],
                 [.03,.045,.02],[.028,.03,.02],support,'flank_'+label,6)
ell('pressure_keel',(0,.78,.30),(.26,.34,.13),support,'keel',2)
ell('pressure_tip',(0,.96,.30),(.13,.06,.08),seam,'keel',2)

rig_data=bpy.data.armatures.new('PLEAT_support_rig')
rig=bpy.data.objects.new('PLEAT_RIG',rig_data);bpy.context.collection.objects.link(rig);rig.parent=root
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(n,a,b,parent=None):
    p=rig_data.edit_bones.new(n);p.head=a;p.tail=b
    if parent:p.parent=rig_data.edit_bones[parent]
bone('body',(0,0,.8),(0,0,1.05))
for n,(hip,knee,toe) in legs.items():
    bone(n+'_upper',hip,knee,'body');bone(n+'_lower',knee,toe,n+'_upper')
    bone(n+'_toe',toe,toe+Vector((0,.18,0)),n+'_lower')
for n,center in [('mantle_front',(0,.30,1.13)),('mantle_rear',(0,-.68,1.2)),
                 ('breast_L',(-.35,.55,.6)),('breast_R',(.35,.55,.6)),
                 ('keel',(0,.78,.3)),('flank_L',(-.45,-.2,.76)),('flank_R',(.45,-.2,.76))]:
    bone(n,center,Vector(center)+Vector((0,0,.15)),'body')
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
rest={b.name:b.matrix_local.copy() for b in rig.data.bones}
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
assert len(rest)==20
for o in parts:
    for n in rest:o.vertex_groups.new(name=n)
    o.vertex_groups[o['part_bone']].add(list(range(len(o.data.vertices))),1,'REPLACE')
meshes=[]
material_batches=[(mat,[o for o in parts if o.data.materials[0]==mat]) for mat in materials]
for mat,batch in material_batches:
    bpy.ops.object.select_all(action='DESELECT')
    for o in batch:o.select_set(True)
    bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join();o=bpy.context.object
    o.name='PLEAT_skin_'+mat.name;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.data.materials.clear();o.data.materials.append(mat)
    for f in o.data.polygons:f.material_index=0
    mod=o.modifiers.new('PLEAT armature','ARMATURE');mod.object=rig;o.parent=rig;meshes.append(o)

def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def around(center,shift=Vector(),rotation=Quaternion()):
    return Matrix.Translation(center+shift)@rotation.to_matrix().to_4x4()@Matrix.Translation(-center)
def xform(name,head,tail):
    r=rest[name];v=rig.data.bones[name].tail_local-rig.data.bones[name].head_local
    out=v.rotation_difference(tail-head).to_matrix().to_4x4()@r;out.translation=head;return out
def ik(hip,target,plane,l1,l2):
    delta=target-hip;distance=max(abs(l1-l2)+1e-4,min(l1+l2-1e-5,delta.length));axis=delta.normalized()
    bend=plane.cross(axis)
    if bend.length<1e-5:bend=axis.cross(Vector((1,0,0)))
    bend.normalize();a=(l1*l1-l2*l2+distance*distance)/(2*distance)
    return hip+axis*a+bend*math.sqrt(max(0,l1*l1-a*a)),hip+axis*distance

contacts={};max_error=0;impact_tip=None
def pose(mode,t):
    global max_error,impact_tip
    shift=Vector();fold=0;charge=0;release=0;advance=0
    if mode=='Idle':fold=.018*math.sin(t*math.tau/4);shift.z=-.008*(1-math.cos(t*math.tau/4))
    elif mode=='Locomotion':
        fold=.10*math.sin(t*math.tau/.8);shift.z=-.025-.015*(1-math.cos(t*math.tau/.4))
    else:
        if t<=.45:
            charge=smooth(t/.36);release=smooth((t-.36)/.09);advance=.29*release
        else:
            charge=1-smooth((t-.45)/.75);release=1;advance=.29*(1-smooth((t-.45)/.32))
        shift.z=-.10*charge;fold=-.14*charge
    B=Matrix.Translation(shift)
    rig.pose.bones['body'].matrix=B@rest['body'];bpy.context.view_layer.update()
    for i,(name,(hip0,knee0,toe0)) in enumerate(legs.items()):
        hip=B@hip0;target=toe0.copy();plant=True
        if mode=='Locomotion':
            phase=(t/P['cycle_seconds']+[0,.5,.5,0][i])%1;duty=P['stance_fraction']
            travel=P['cycle_distance_m']*duty
            if phase<duty:target.y+=travel*(.5-phase/duty)
            else:
                u=(phase-duty)/(1-duty);target.y+=travel*(-.5+smooth(u));target.z+=P['foot_lift_m']*math.sin(math.pi*u)**2;plant=False
        plane=(toe0-hip0).cross(knee0-hip0).normalized()
        knee,actual=ik(hip,target,plane,(knee0-hip0).length,(toe0-knee0).length)
        max_error=max(max_error,(actual-target).length)
        for segment,a,b in [('upper',hip,knee),('lower',knee,actual)]:
            rig.pose.bones[name+'_'+segment].matrix=xform(name+'_'+segment,a,b);bpy.context.view_layer.update()
        rig.pose.bones[name+'_toe'].matrix=Matrix.Translation(actual-toe0)@rest[name+'_toe'];bpy.context.view_layer.update()
        contacts.setdefault(mode,[]).append({'time':t,'leg':name,'planted':plant,'toe':list(actual),'ground':actual.z-.07})
    for n,angle in [('mantle_front',fold),('mantle_rear',-fold*.75)]:
        rig.pose.bones[n].matrix=B@around(rest[n].translation,rotation=Quaternion((1,0,0),angle))@rest[n]
    for side,label in [(-1,'L'),(1,'R')]:
        n='breast_'+label
        opening=charge*(1-release)*.30
        rig.pose.bones[n].matrix=B@around(rest[n].translation,Vector((side*opening,0,0)),Quaternion((0,1,0),side*(opening*.7)))@rest[n]
        n='flank_'+label
        rig.pose.bones[n].matrix=B@around(rest[n].translation,Vector((0,fold*.24,0)),Quaternion((1,0,0),fold))@rest[n]
    # Cancel body depression: the pressure tip stays on the authoritative burst plane.
    rig.pose.bones['keel'].matrix=Matrix.Translation((0,advance,0))@rest['keel']
    bpy.context.view_layer.update()
    if mode=='Lunge' and abs(t-.45)<1e-6:impact_tip=[0,.96+advance,.3]

scene=bpy.context.scene;scene.render.fps=60
rig.animation_data_create()
if not BLOCK:
    for name,duration in [('Idle',4),('Locomotion',.8),('Lunge',1.2)]:
        action=bpy.data.actions.new(name);rig.animation_data.action=action
        for frame in range(round(duration*60)+1):
            scene.frame_set(frame);pose(name,frame/60)
            for pb in rig.pose.bones:
                for prop in ['location','rotation_quaternion','scale']:pb.keyframe_insert(prop,frame=frame,group=pb.name)
        action.use_fake_user=True;track=rig.animation_data.nla_tracks.new();track.name=name
        track.strips.new(name,0,action);track.mute=True
    rig.animation_data.action=None
for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
root['motion_contract']=json.dumps({'clips':{'Idle':4,'Locomotion':.8,'Lunge':1.2},'impact':.45,'cycle_distance':.72,'root_motion':False,'forward':'-Z','ground':'Y=0'})
scene.frame_start=0;scene.frame_end=240;scene.frame_set(0)
blend=HERE/(TAG+'.blend');glb=HERE/(TAG+'.glb')
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);rig.select_set(True)
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,
    export_animations=not BLOCK,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,
    export_cameras=False,export_lights=False,export_texcoords=False)
data=glb.read_bytes();gltf=json.loads(data[20:20+int.from_bytes(data[12:16],'little')])
tri=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
assert tri<=P['budget']['triangles'],tri
assert len(gltf['materials'])==4 and len(gltf['skins'][0]['joints'])==20
assert BLOCK or {a['name'] for a in gltf['animations']}=={'Idle','Locomotion','Lunge'}
assert max_error<1e-4,max_error
report={'blender':bpy.app.version_string,'triangles':tri,'materials':4,'bones':20,'bytes':len(data),'max_ik_error':max_error,
        'impact_tip_blender':impact_tip,'seed':P['seed'],'sha256':hashlib.sha256(data).hexdigest(),'blockout':BLOCK}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(glb))
assert sum(o.type=='ARMATURE' for o in scene.objects)==1
report['reimport']='PASS'
(HERE/'validation'/(TAG+'.json')).write_text(json.dumps(report,indent=2))
if not BLOCK:(HERE/'validation/contact-samples.json').write_text(json.dumps(contacts))

# Review render is of the reimported GLB, not the pre-export mesh.
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world.color=(.16,.16,.16)
floor_mat=bpy.data.materials.new('review_floor');floor_mat.diffuse_color=(.035,.048,.052,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));bpy.context.object.data.materials.append(floor_mat)
def light(pos,power,size,color):
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color
    o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
light((-3,1,6),650,5,(1,.9,.76));light((3,-3,4),800,4,(.67,.85,1));light((0,5,3),150,3,(.75,1,.95))
bpy.ops.object.camera_add(location=(4.3,5.8,3.0));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.75))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=4.8;scene.camera=cam
scene.render.filepath=str(HERE/'review'/(TAG+'_oblique.png'));bpy.ops.render.render(write_still=True)
print('PLEAT_VALIDATION',json.dumps(report))
