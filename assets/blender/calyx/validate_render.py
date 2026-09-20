import bpy, json, math, hashlib, sys
from pathlib import Path
from mathutils import Vector, Matrix
P=Path(__file__).resolve().parent
# Fresh-process reopen of native file, then independent GLB import.
bpy.ops.wm.open_mainfile(filepath=str(P/'calyx.blend'))
assert len([o for o in bpy.data.objects if o.type=='ARMATURE'])==1
native={'bones':len(next(o for o in bpy.data.objects if o.type=='ARMATURE').data.bones)}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(P/'calyx.glb'))
scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE');skins=[o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
actions={a.name.split('_')[-1]:a for a in bpy.data.actions}
print('ACTIONS',list(actions))
tracks={t.name:t for t in rig.animation_data.nla_tracks}
def choose(name,t):
    rig.animation_data.action=None
    for track in tracks.values():track.mute=track.name!=name
    scene.frame_set(1+round(t*30));bpy.context.view_layer.update()
def points():
    dg=bpy.context.evaluated_depsgraph_get();pts=[]
    for o in skins:
        eo=o.evaluated_get(dg);me=eo.to_mesh();pts.extend(eo.matrix_world@v.co for v in me.vertices);eo.to_mesh_clear()
    return pts
rig.animation_data.action=None
for tr in tracks.values():tr.mute=True
for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();p=points();bounds=[[min(v[i] for v in p) for i in range(3)],[max(v[i] for v in p) for i in range(3)]]
mins={};slip=[];mesh_slip=[];loops={};max_root_rotation=0;tilts=[]
tip_indices={n:[] for n in ['FL','FR','Rear']};offset=0
for o in skins:
    for n in tip_indices:
        group=o.vertex_groups.get(n+'_foot')
        if group:tip_indices[n].extend(offset+v.index for v in o.data.vertices if any(g.group==group.index and g.weight>.99999 for g in v.groups))
    offset+=len(o.data.vertices)
assert all(tip_indices.values())
for name,duration in {'Idle':4,'Locomotion':6,'Slam':2.2,'PollenShot':2.8}.items():
    assert name in tracks,(name,list(tracks))
    samples=[];previous={};previous_tips={}
    for f in range(round(duration*30)+1):
        t=f/30;choose(name,t)
        pts=points();assert all(math.isfinite(x) for v in pts for x in v)
        samples.append(min(v.z for v in pts))
        now={n:(rig.matrix_world@rig.pose.bones[n+'_foot'].matrix).translation.copy() for n in ['FL','FR','Rear']}
        tips={n:sum((pts[i] for i in indices),Vector())/len(indices) for n,indices in tip_indices.items()}
        for n in ['FL','FR','Rear']:
            ref=rig.pose.bones[n+'_upper'].matrix@rig.data.bones[n+'_upper'].matrix_local.inverted()
            for part in ['upper','lower','foot']:
                pb=rig.pose.bones[n+'_'+part]
                transform=pb.matrix@pb.bone.matrix_local.inverted()
                max_root_rotation=max(max_root_rotation,transform.to_quaternion().rotation_difference(ref.to_quaternion()).angle)
        if name=='Locomotion' and f:
            body_transform=rig.pose.bones['Body'].matrix@rig.data.bones['Body'].matrix_local.inverted()
            axis=body_transform.to_3x3()@Vector((0,0,1))
            tilts.append(math.degrees(math.acos(max(-1,min(1,axis.normalized().z)))))
            for i,n in enumerate(now):
                desired={'FL':-math.pi/3,'FR':math.pi/3,'Rear':math.pi}[n]
                phase=((t*math.tau/6-desired+math.pi/3)%math.tau)/math.tau
                old=(((t-1/30)*math.tau/6-desired+math.pi/3)%math.tau)/math.tau
                if phase<1/3 and old<1/3 and phase>=old:
                    slip.append((now[n]-previous[n]+Vector((.65/30,0,0))).length)
                    mesh_slip.append((tips[n]-previous_tips[n]+Vector((.65/30,0,0))).length)
        if f==0:first=[v.copy() for v in pts]
        if f==round(duration*30):loops[name]=max((a-b).length for a,b in zip(first,pts))
        previous=now
        previous_tips=tips
    mins[name]=min(samples)
report=dict(glb_sha256=hashlib.sha256((P/'calyx.glb').read_bytes()).hexdigest(),native_reopened=native,glb_reimport=True,bones=len(rig.data.bones),bounds=bounds,clip_min_z=mins,max_stance_world_slip_m=max(slip),loop_vertex_error=loops,checks='Every authored 30fps frame; finite skinned vertices and ground penetration; locomotion foot bones plus nominal forward travel. Not continuous mesh collision or game integration.')
choose('Slam',1.0);impact=[]
for o in skins:
    group=o.vertex_groups.get('P1')
    if group:
        eo=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=eo.to_mesh()
        impact.extend(eo.matrix_world@me.vertices[v.index].co for v in o.data.vertices if any(g.group==group.index and g.weight>.99 for g in v.groups))
        eo.to_mesh_clear()
report['slam_p1_min_z_at_1s']=min(v.z for v in impact)
report['root_joint_rotation_max_rad']=max_root_rotation
report['max_stance_root_tip_world_slip_m']=max(mesh_slip)
report['locomotion_bud_tilt_degrees']=[min(tilts),max(tilts)]
report['checks']='Every authored 30fps frame; finite vertices, floor clearance, loops, root tips plus nominal +X lateral travel at 0.65m/s. Relative rotation between handles on each root (not global body spin). Circular world-path curvature and continuous collision are separate integration concerns.'
(P/'validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
assert min(mins.values())>=-.001,mins
assert 0 <= report['slam_p1_min_z_at_1s'] <= .03,report['slam_p1_min_z_at_1s']
assert max(slip)<.001,max(slip)
assert max(loops.values())<.001,loops
assert max_root_rotation<.001,max_root_rotation
assert max(mesh_slip)<.001,max(mesh_slip)
assert all(abs(a-45)<.001 for a in tilts)
if '--check-only' in sys.argv:sys.exit(0)
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.resolution_x=850;scene.render.resolution_y=750;scene.render.resolution_percentage=100
world=bpy.data.worlds.new('Studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.24,.20,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5;scene.world=world
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02));floor=bpy.context.object;m=bpy.data.materials.new('floor');m.diffuse_color=(.13,.15,.12,1);floor.data.materials.append(m)
for pos,power,size in [((3,4,6),650,4),((-3,1,4),400,3),((1,-4,5),700,3)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.6
for name,pos,clip,t in [('hero',(3,5,3),'Idle',0),('front',(0,6,1.4),'Idle',0),('side',(6,0,1.4),'Idle',0),('back',(0,-6,1.4),'Idle',0),('spin0',(3,5,3),'Locomotion',0),('spin1',(3,5,3),'Locomotion',1),('spin2',(3,5,3),'Locomotion',2),('slam',(3,5,3),'Slam',1),('pollen',(3,5,3),'PollenShot',1.6)]:
    choose(clip,t);cam.location=pos;cam.rotation_euler=(Vector((0,0,1.15))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(P/(name+'.png'));bpy.ops.render.render(write_still=True)
