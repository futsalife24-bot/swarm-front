"""Deterministic isolated FOUNDRY ZERO rigid articulation candidate.
Run in a dedicated Blender factory-startup process. No gameplay behavior is authored.
Geometry helpers are a pinned local copy of the existing phase1_common.py.
"""
from pathlib import Path
import sys, math, json, hashlib
import bpy
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import phase1_common as c
c.REPO = HERE
root = c.setup('foundry_zero_segmented_v1')
root.name = 'FOUNDRY_ZERO_ROOT'
root['candidate_status'] = '2026-09-12 integrated first version approved; production asset'
root['coordinate_contract'] = 'meters; Blender +Y forward / glTF -Z forward; unit root at ground'
root['unit_pitch_m'] = 3.2
root['unit_count'] = 8

shell = c.mat('titanium_shell', (.235,.275,.29), metal=.69, rough=.34)
dark = c.mat('graphite_mechanism', (.018,.026,.032), metal=.46, rough=.50)
edge = c.mat('brushed_edges', (.48,.54,.56), metal=.86, rough=.24)
glow = c.mat('cyan_optics', (.003,.34,.78), metal=.15, rough=.18, emit=1.7)
warm = c.mat('amber_identification', (.62,.19,.055), metal=.4, rough=.37, emit=.2)
MATERIALS = [shell,dark,edge,glow,warm]
units=[]; legs=[]; emitters=[]; connectors=[]; parts=[]

def node(name, parent, location=(0,0,0), kind='part'):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o)
    o.parent=parent;o.location=location;o['part_kind']=kind;o.empty_display_size=.14
    return o

def part(name, parent, pivot, objects, kind='shell'):
    """One independently transformable mesh per physical rigid piece; multi-material."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join();o=bpy.context.object;o.name=name
    pivot=Vector(pivot)
    for v in o.data.vertices:v.co-=pivot
    o.parent=parent;o.location=pivot;o.rotation_euler=(0,0,0);o.scale=(1,1,1)
    o['part_kind']=kind;parts.append(o);o.select_set(False)
    return o

def smooth(o):
    for p in o.data.polygons:p.use_smooth=True
    return o

def cyl(name,p,r,d,m,n=12,axis='Y'):
    return c.cylinder(name,p,r,d,m,n,(math.pi/2,0,0) if axis=='Y' else (0,math.pi/2,0) if axis=='X' else (0,0,0))

def ring(name,p,r,t,m,n=24,k=5,axis='Z'):
    o=c.ring(name,p,r,t,m,n,k)
    if axis!='Z':
        pivot=Vector(p);rot=Matrix.Rotation(math.pi/2,4,'X' if axis=='Y' else 'Y')
        for v in o.data.vertices:v.co=pivot+rot.to_3x3()@(v.co-pivot)
    return smooth(o)

def tube(name,points,radii,m,sides=8):
    pts=list(map(Vector,points));verts=[];faces=[]
    for i,p in enumerate(pts):
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        side=tangent.cross(Vector((0,1,0)))
        if side.length<.1:side=tangent.cross(Vector((1,0,0)))
        side.normalize();up=side.cross(tangent).normalized()
        for j in range(sides):
            a=math.tau*j/sides;verts.append(p+radii[i]*(side*math.cos(a)+up*math.sin(a)))
    for i in range(len(pts)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(pts)-1)*sides+j for j in range(sides))])
    return smooth(c.mesh(name,verts,faces,m))

def body_panels(name,head=False):
    """Faceted curved shell split into broad dorsal armor and four flank plates."""
    width=1.25 if head else 1.08;length=1.20 if head else .95
    objs=[smooth(c.ico(name+'_core',(0,0,1.68),(width,.94, .76),dark,2))]
    for side in [-1,1]:
        for j in range(2):
            y=(-.48,.48)[j]*length
            a=.05;b=.86*width;d=1.13*width
            verts=[(side*a,y-.42,2.38),(side*b,y-.45,2.26),(side*d,y-.40,1.77),(side*d,y+.40,1.77),
                   (side*b,y+.46,2.26),(side*a,y+.42,2.38),
                   (side*a,y-.39,2.24),(side*b,y-.40,2.14),(side*(d-.09),y-.35,1.71),(side*(d-.09),y+.35,1.71),
                   (side*b,y+.40,2.14),(side*a,y+.39,2.24)]
            faces=[(0,1,4,5),(1,2,3,4),(6,11,10,7),(7,10,9,8),(0,6,7,1),(1,7,8,2),(2,8,9,3),(3,9,10,4),(4,10,11,5),(5,11,6,0)]
            objs.append(c.mesh(name+f'_armor_{side}_{j}',verts,faces,shell))
            # Raised shoulder lip and a recessed dark panel make the armor readable at game distance.
            objs.append(c.beam(name+'_edge',(side*.92*width,y-.37,2.25),(side*.92*width,y+.37,2.25),.065,edge))
            objs.append(c.box(name+'_inset',(side*1.123*width,y,1.96),(.045,.36,.20),dark,bevel=.15))
            objs.append(c.box(name+'_optic',(side*1.15*width,y+.03,1.85),(.03,.22,.034),glow,bevel=0))
        # Long lower rails and vent teeth are separated from the broad shell by negative space.
        objs.append(c.beam(name+'_sill',(side*1.02*width,-.80,1.30),(side*1.02*width,.80,1.30),.16,dark))
        for j in range(4):
            objs.append(c.box(name+'_vent',(side*1.10*width,-.58+j*.38,1.49),(.10,.17,.27),edge,rot=(0,side*.2,0),bevel=.08))
        for y in [-.70,.70]:
            objs.append(cyl(name+'_lock',(side*.93*width,y,2.23),.078,.055,edge,8,'Z'))
    # Broad low belly and recessed ribs give the heavy shell a crouching silhouette.
    objs.append(c.box(name+'_keel',(0,0,1.04),(1.55,1.60,.30),dark,bevel=.22))
    for side in [-1,1]:
        objs.append(c.box(name+'_belly_edge',(side*.70,0,1.00),(.12,1.35,.22),shell,rot=(0,side*.13,0),bevel=.22))
        for y in [-.49,0,.49]:
            objs.append(c.box(name+'_belly_rib',(side*.73,y,.94),(.17,.09,.20),edge,bevel=.05))
    return objs

def make_leg(unit,index,side,y,head=False):
    prefix=unit.name+f'_LEG_{"L" if side<0 else "R"}{index}'
    leg=node(prefix,unit,kind='leg_root')
    hip=Vector((side*(1.12 if head else .97),y,1.50 if head else 1.40))
    knee=Vector((side*(2.00 if head else 1.72),y-(.40 if head else .44),.96 if head else .88))
    toe=Vector((side*(2.65 if head else 2.43),y+(.46 if head else .43),.075))
    pivot_parts=[smooth(c.ico(prefix+'_hip',hip,(.23,.22,.23),dark,1)),
                 cyl(prefix+'_hinge',hip,.19,.35,edge,10,'Y'),cyl(prefix+'_inner',hip+Vector((0,.19,0)),.09,.035,dark,10,'Y')]
    part(prefix+'_HIP',leg,hip,pivot_parts,'leg_hip')
    upper=part(prefix+'_UPPER',leg,hip,[tube(prefix+'_upper',[hip,knee*.62+hip*.38,knee],[.17,.22,.12],shell),
               c.beam(prefix+'_upper_strut',hip+Vector((0,-.14,0)),knee+Vector((0,-.14,0)),.07,edge),
               smooth(c.ico(prefix+'_upper_ball',knee,(.19,.20,.19),dark,1))],'leg_upper')
    lower=part(prefix+'_LOWER',leg,knee,[tube(prefix+'_lower',[knee,knee*.50+toe*.50,toe],[.135,.17,.045],edge),
              tube(prefix+'_lower_cover',[knee,knee*.62+toe*.38,knee*.27+toe*.73],[.15,.20,.07],shell),
              cyl(prefix+'_knee',knee,.145,.26,dark,10,'Y')],'leg_lower')
    x,ty,z=toe
    foot=part(prefix+'_FOOT',leg,toe,[c.mesh(prefix+'_foot',[(x-.10,ty-.17,0),(x+.10,ty-.17,0),(x+.08,ty+.29,0),(x-.08,ty+.29,0),
                (x-.07,ty-.10,.13),(x+.07,ty-.10,.13),(x,ty+.31,.026)],
                [(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,6),(3,0,4,6),(4,5,6)],dark)],'leg_foot')
    legs.append(dict(unit=unit,index=len(legs),hip=hip,knee=knee,toe=toe,upper=upper,lower=lower,foot=foot,side=side))

for i in range(8):
    u=node('FZ_HEAD' if i==0 else f'FZ_BODY_{i:02d}',root,(0,-3.2*i,0),'head' if i==0 else 'body')
    u['unit_index']=i;u['forward']='local +Y in Blender / -Z in glTF';u['ground_origin']=True;units.append(u)
    objs=body_panels(u.name,i==0)
    if i:
        # Dorsal furnace/formation organ follows reference shape but defines no spawn behavior.
        objs.extend([cyl(u.name+'_dorsal_base',(0,0,2.40),.49,.13,dark,16,'Z'),
                     ring(u.name+'_dorsal_cyan',(0,0,2.49),.39,.038,glow,20,4),
                     cyl(u.name+'_dorsal_column',(0,0,2.66),.21,.38,dark,10,'Z'),
                     cyl(u.name+'_dorsal_cap',(0,0,2.88),.27,.085,edge,12,'Z')])
        for a in [0,math.pi/2,math.pi,math.pi*1.5]:
            x=.19*math.cos(a);y=.19*math.sin(a)
            objs.append(c.beam(u.name+'_dorsal_light',(x,y,2.51),(x,y,2.84),.035,glow))
        for side in [-1,1]:
            objs.append(c.box(u.name+'_serial',(side*.47,-.52,2.40),(.25,.17,.028),warm,bevel=.12))
        # The optical gimbal pivots at its muzzle: aiming never moves the shared shot origin.
        laser_pivot=Vector((0,.62,2.68))
        laser=node(u.name+'_LASER',u,laser_pivot,'laser_aim_pivot')
        laser_parts=[smooth(c.ico(u.name+'_laser_gimbal',(0,.40,2.68),(.24,.18,.24),dark,1)),
                     cyl(u.name+'_laser_barrel',(0,.48,2.68),.18,.22,shell,12,'Y'),
                     ring(u.name+'_laser_rim',(0,.605,2.68),.15,.036,edge,16,4,'Y'),
                     cyl(u.name+'_laser_optic',(0,.613,2.68),.117,.014,glow,12,'Y')]
        for o in laser_parts:
            for v in o.data.vertices:v.co-=laser_pivot
        part(u.name+'_LASER_OPTICS',laser,(0,0,0),laser_parts,'laser_optics')
        node(u.name+'_LASER_MUZZLE',laser,(0,0,0),'laser_muzzle')
        connector=node(u.name+'_CONNECTOR',u,(0,1.04,1.65),'connector')
        bellows=[]
        for j in range(7):
            bellows.append(cyl(u.name+'_bellow'+str(j),(0,j*.185,0),.62 if j%2==0 else .57,.185,dark,10,'Y'))
        for y in [0,1.11]:
            bellows.append(cyl(u.name+'_collar',(0,y,0),.68,.13,edge,12,'Y'))
        for side in [-1,1]:
            bellows.append(c.beam(u.name+'_cable',(side*.54,.03,-.28),(side*.54,1.08,-.28),.07,dark))
        part(u.name+'_CONNECTOR_MESH',connector,(0,0,0),bellows,'connector_bellows')
        connectors.append(connector)
    else:
        # Broad crab-like foremask, one central projector, surrounding ocular emitters.
        objs.extend([smooth(c.ico('FZ_HEAD_mask',(0,1.01,1.60),(1.06,.49,.79),shell,2)),
                     smooth(c.ico('FZ_HEAD_lens_housing',(0,1.28,1.65),(.58,.30,.58),dark,2))])
        central_pivot=Vector((0,1.66,1.65))
        central=node('FZ_HEAD_CENTRAL_LASER',u,central_pivot,'laser_aim_pivot')
        central_parts=[ring('FZ_HEAD_lens_rim',(0,1.61,1.65),.46,.071,edge,28,5,'Y'),
                       cyl('FZ_HEAD_lens',(0,1.635,1.65),.385,.05,glow,24,'Y'),
                       ring('FZ_HEAD_lens_iris',(0,1.65,1.65),.20,.025,dark,20,4,'Y')]
        for o in central_parts:
            for v in o.data.vertices:v.co-=central_pivot
        part('FZ_HEAD_CENTRAL_OPTICS',central,(0,0,0),central_parts,'laser_optics')
        node('FZ_HEAD_CENTRAL_MUZZLE',central,(0,0,0),'laser_muzzle')
        for side in [-1,1]:
            objs.append(tube('FZ_HEAD_mandible',[(side*.75,.86,1.29),(side*1.05,1.59,.99),(side*.71,2.09,.48)], [.22,.26,.038],edge,8))
            objs.append(cyl('FZ_HEAD_aux_lens',(side*.77,1.20,2.16),.135,.11,glow,12,'Y'))
        # Six segmented flexible laser stalks, each with an independent pivot and muzzle socket.
        for j,(side,start,end) in enumerate([
                (-1,(-.51,-.36,2.20),(-1.40,.43,4.04)),(1,(.51,-.36,2.20),(1.40,.43,4.04)),
                (-1,(-.82,.20,2.04),(-2.34,1.02,3.13)),(1,(.82,.20,2.04),(2.34,1.02,3.13)),
                (-1,(-1,.54,1.68),(-2.25,1.90,2.03)),(1,(1,.54,1.68),(2.25,1.90,2.03))]):
            start=Vector(start);end=Vector(end)
            middle=(start+end)/2+Vector((side*.35,-.46,.45));points=[]
            for k in range(9):
                t=k/8;points.append((1-t)**2*start+2*(1-t)*t*middle+t*t*end)
            arm=node(f'FZ_HEAD_EMITTER_{j+1:02d}',u,start,'laser_arm')
            arm_parts=[tube('stalk',points,[.11]*9,dark,8)]
            for k,p in enumerate(points[1:-1]):arm_parts.append(smooth(c.ico('stalk_joint',p,(.143,.143,.143),edge,1)))
            arm_parts.extend([smooth(c.ico('emitter_housing',end,(.25,.32,.25),shell,2)),
                              cyl('emitter_barrel',end+Vector((0,.24,0)),.22,.19,dark,12,'Y'),
                              ring('emitter_rim',end+Vector((0,.35,0)),.17,.035,edge,16,5,'Y'),
                              cyl('emitter_optic',end+Vector((0,.38,0)),.14,.045,glow,16,'Y')])
            # Mesh is local to arm pivot. The socket is independently addressable.
            for o in arm_parts:
                for v in o.data.vertices:v.co-=start
            part(arm.name+'_MESH',arm,(0,0,0),arm_parts,'laser_arm_mesh')
            muzzle=node(arm.name+'_MUZZLE',arm,end-start+Vector((0,.405,0)),'laser_muzzle')
            muzzle['visual_only']='No gameplay shot timing or damage contract established'
            emitters.append(arm)
    part(u.name+'_SHELL',u,(0,0,0),objs,'shell')
    for side in [-1,1]:
        for j,y in enumerate([-.62,.55] if i else [-.78,.15,.84]):make_leg(u,j+1,side,y,i==0)

# Neutral geometry GLB and native .blend preserve all physical parts and pivots.
bpy.context.scene.render.fps=30
bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=120

def set_leg_pose(leg,hip,knee,toe):
    for obj,rest_a,rest_b,a,b in [(leg['upper'],leg['hip'],leg['knee'],hip,knee),(leg['lower'],leg['knee'],leg['toe'],knee,toe)]:
        obj.location=a;obj.rotation_mode='QUATERNION';obj.rotation_quaternion=(rest_b-rest_a).rotation_difference(b-a)
    leg['foot'].location=toe

def preview_pose(time):
    """In-place joint exercise; planted feet stay fixed. Not a gameplay movement clip."""
    phase=time*math.tau/4
    for i,u in enumerate(units):
        u.location=(.25*math.sin(phase-i*.70),-i*3.2,0)
        u.rotation_euler=(0,0,.035*math.cos(phase-i*.70))
    bpy.context.view_layer.update()
    for connector,u in zip(connectors,units[1:]):
        i=units.index(u);prev=units[i-1]
        # Aim toward the previous unit's rear socket. The bellows may stretch 5% in this inspection pose.
        target=u.matrix_world.inverted()@(prev.matrix_world@Vector((0,-1.05,1.65)))
        delta=target-connector.location
        connector.rotation_mode='QUATERNION';connector.rotation_quaternion=Vector((0,1,0)).rotation_difference(delta)
        connector.scale=(1,delta.length/1.11,1)
    for leg in legs:
        u=leg['unit'];i=units.index(u)
        # A small toe lift previews the separate foot; otherwise world-space foot contact is held.
        neutral=Vector((leg['toe'].x,-i*3.2+leg['toe'].y,leg['toe'].z))
        foot=u.matrix_world.inverted()@neutral
        hip=leg['hip'];a=(leg['knee']-hip).length;b=(leg['toe']-leg['knee']).length
        delta=foot-hip;distance=delta.length;direction=delta.normalized()
        along=(a*a-b*b+distance*distance)/(2*distance)
        height=math.sqrt(max(0,a*a-along*along))
        pole=leg['knee']-hip;perp=(pole-direction*pole.dot(direction)).normalized()
        knee=hip+direction*along+perp*height
        set_leg_pose(leg,hip,knee,foot)
    for j,arm in enumerate(emitters):arm.rotation_euler=(.06*math.sin(phase+j*.7),.03*math.cos(phase+j),.10*math.sin(phase+j*.8))

animated=units+connectors+[x for leg in legs for x in [leg['upper'],leg['lower'],leg['foot']]]+emitters
for frame in range(0,121,2):
    preview_pose(frame/30)
    for o in animated:
        o.keyframe_insert('location',frame=frame)
        o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)
        if o in connectors:o.keyframe_insert('scale',frame=frame)
for o in animated:
    action=o.animation_data.action
    action.name=o.name+'_ArticulationPreview'
    track=o.animation_data.nla_tracks.new();track.name='ArticulationPreview'
    strip=track.strips.new(action.name,0,action);strip.action_frame_start=0;strip.action_frame_end=120
    o.animation_data.action=None

# Stop NLA evaluation for neutral export; the optional preview clip is exported separately.
for o in animated:o.animation_data.use_nla=False
for i,u in enumerate(units):u.location=(0,-i*3.2,0);u.rotation_euler=(0,0,0)
for connector in connectors:connector.rotation_quaternion=(1,0,0,0);connector.scale=(1,1,1)
for leg in legs:set_leg_pose(leg,leg['hip'],leg['knee'],leg['toe'])
for arm in emitters:arm.rotation_euler=(0,0,0)
bpy.context.view_layer.update()

def inspect_scene():
    pts=[];tris=0;vertices=0;nonfinite=0;degenerate=0;names=[]
    for o in parts:
        o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles);vertices+=len(o.data.vertices)
        for tri in o.data.loop_triangles:degenerate+=int(tri.area<1e-10)
        for v in o.data.vertices:
            p=o.matrix_world@v.co;pts.append(p);nonfinite+=int(not all(math.isfinite(v) for v in p))
        names.append(o.name)
    bounds={'min':[min(p[i] for p in pts) for i in range(3)],'max':[max(p[i] for p in pts) for i in range(3)]}
    return dict(triangles=tris,vertices=vertices,meshes=len(parts),materials=len(MATERIALS),bones=0,nonfinite=nonfinite,degenerate=degenerate,bounds_blender=bounds)

metrics=inspect_scene()
assert len(units)==8 and len(legs)==34 and len(connectors)==7
assert metrics['nonfinite']==0 and metrics['degenerate']==0,metrics
assert abs(metrics['bounds_blender']['min'][2])<1e-5,metrics
assert all(o.matrix_world.determinant()>0 for o in parts)
glb=HERE/'foundry_zero_segmented_v1.glb'
bpy.ops.object.select_all(action='DESELECT')
for o in [root]+list(root.children_recursive):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_texcoords=False)
for o in animated:o.animation_data.use_nla=True
bpy.context.scene.frame_set(0)
bpy.ops.export_scene.gltf(filepath=str(HERE/'foundry_zero_articulation_preview.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_texcoords=False)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'foundry_zero_segmented_v1.blend'))

contract={'asset':glb.name,'root':'FOUNDRY_ZERO_ROOT','format':'glTF 2.0 rigid mesh hierarchy; no skin or bones',
          'units':[{'name':u.name,'index':i,'kind':'head' if i==0 else 'body','neutral_translation_gltf':[0,0,3.2*i]} for i,u in enumerate(units)],
          'unit_pitch_m':3.2,'unit_origin':'ground below center; native unit scales all 1','forward':'glTF -Z; Blender +Y',
          'connector_pivot_gltf':[0,1.65,-1.04],'previous_rear_socket_gltf':[0,1.65,1.05],
          'connector_nominal_length_m':1.11,'connector_axis':'local -Z; endpoints 0 to -1.11; extend scale.z',
          'runtime_placement':'Clone FZ_HEAD or each FZ_BODY_nn with children. Reset extracted root translation to authoritative node position and yaw to node heading + PI. Child part transforms stay local. Do not apply whole-scene ArticulationPreview to game-state-driven roots.',
          'parts':{'shell':'<unit>_SHELL','connector':'<body>_CONNECTOR','legs':'<unit>_LEG_[LR][1..2]; head [1..3]','leg_rigid_parts':['HIP','UPPER','LOWER','FOOT'],'head_emitters':'FZ_HEAD_EMITTER_01..06','muzzle':'<emitter>_MUZZLE / FZ_HEAD_CENTRAL_MUZZLE'},
          'combat_lasers':{'head':{'pivot':'FZ_HEAD_CENTRAL_LASER','muzzle':'FZ_HEAD_CENTRAL_MUZZLE','unit_local_muzzle_gltf':[0,1.65,-1.66]},'body':{'pivot':'FZ_BODY_nn_LASER','muzzle':'FZ_BODY_nn_LASER_MUZZLE','unit_local_muzzle_gltf':[0,2.68,-.62]},'aim':'Muzzle is at pivot origin and does not translate when local -Z is aimed; short optics rotate, static housing stays on shell'},
          'disconnect':'Hide the connector on a chain-leading body. Preserve its body and legs. Removing any unit does not reparent or renumber the others.',
          'animation':'ArticulationPreview is a 4 second in-place inspection exercise with world-planted feet. It is not a specified locomotion speed, combat ability or attack timing.',
          'scaling_warning':'Integrated first version; shared ground movement and head/body hit volumes still require final integration validation.'}
(HERE/'structure-contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2),encoding='utf-8')
report={'blender':bpy.app.version_string,'source':metrics,'unit_count':len(units),'body_count':7,'head_count':1,'connector_count':len(connectors),'leg_count':len(legs),'emitter_arm_count':len(emitters),
        'seed':'none; deterministic geometry','glb_bytes':glb.stat().st_size,'glb_sha256':hashlib.sha256(glb.read_bytes()).hexdigest(),
        'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'helper_sha256':hashlib.sha256((HERE/'phase1_common.py').read_bytes()).hexdigest(),
        'checks':['8 independent units','7 independent front connectors','34 independent articulated legs','6 independently pivoted laser organs','finite positions','positive transforms','no degenerate triangles','neutral ground min 0'],
        'limitations':['Integrated first-version production permitted by user; final game validation owned by integration lead','Gameplay movement and attacks authored separately','Standard rigid GLTFLoader plus rigid-part batching required; legacy skinned loader incompatible','Runtime performance and head/body collision correspondence validated separately']}
(HERE/'blender-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('FOUNDRY_CANDIDATE',json.dumps(metrics),glb.stat().st_size)
