"""CALYX candidate. Own output directory only. Blender +Y forward, Z up.
Uses existing phase1 mesh primitives, with original botanical geometry and rig.
"""
import bpy, math, json, sys, random, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P))
import phase1_common as c
random.seed(24)
root=c.setup('calyx')
scene=bpy.context.scene
scene.render.fps=30
materials=[c.mat('bark',(.24,.045,.033),0,.78),c.mat('bark_light',(.35,.082,.046),0,.78),c.mat('ivory',(.62,.46,.27),0,.8),c.mat('veins',(.20,.055,.035),0,.82),c.mat('pollen',(.42,.25,.045),0,.92)]
objects=[];bones={};soft_weights={}
def tag(o,bone):
    o['part']=bone;objects.append(o);return o
def mesh(name,v,f,mat,bone):return tag(c.mesh(name,v,f,materials[mat]),bone)
def orb(name,p,s,mat,bone,sub=2):
    o=tag(c.ico(name,p,s,materials[mat],sub),bone)
    for f in o.data.polygons:f.use_smooth=True
    return o
def tube(name,pts,rads,mat,bone,sides=8):
    pts=list(map(Vector,pts));v=[];f=[];previous_a=None
    for i,p in enumerate(pts):
        d=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        a=(previous_a-d*previous_a.dot(d)) if previous_a is not None else d.cross(Vector((0,0,1)))
        if a.length<.01:a=d.cross(Vector((0,1,0)))
        a.normalize();previous_a=a.copy();b=d.cross(a).normalized()
        for j in range(sides):
            t=j*math.tau/sides;r=rads[i]*(1+.008*math.sin(j*3+i))
            v.append(p+r*(math.cos(t)*a+math.sin(t)*b))
    for i in range(len(pts)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;f.append((a,b,b+sides,a+sides))
    f.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))])
    o=mesh(name,v,f,mat,bone)
    for p in o.data.polygons:p.use_smooth=True
    return o
def bone(name,head,tail,parent=None):bones[name]=(Vector(head),Vector(tail),parent)
bone('Root',(0,0,0),(0,0,.25))
bone('Body',(0,0,.9),(0,0,1.3),'Root')
orb('flower_base',(0,0,1.02),(.37,.37,.23),0,'Body')
tube('stem',[(0,0,.73),(0,0,.94),(0,0,1.12)],[.19,.24,.25],0,'Body',12)
# Single inner bud: an enclosed core, distinct from the five moving outer petals.
core_v=[(0,0,1.09)];core_f=[];rings=18;segments=24
for i in range(1,rings):
    t=i/rings;radius=.45*math.sin(math.pi*t)**.8*(1-.12*t)
    for j in range(segments):
        angle=j*math.tau/segments;rr=radius*(1+.025*math.sin(angle*7+t*5))
        core_v.append((rr*math.sin(angle),rr*math.cos(angle),1.09+1.16*t))
top=len(core_v);core_v.append((0,0,2.25))
for j in range(segments):
    k=(j+1)%segments;core_f.append((0,1+k,1+j))
    for i in range(rings-2):
        a=1+i*segments+j;b=1+i*segments+k;core_f.append((a,b,b+segments,a+segments))
    core_f.append((1+(rings-2)*segments+j,1+(rings-2)*segments+k,top))
core=mesh('central_inner_bud',core_v,core_f,0,'Body')
for face in core.data.polygons:face.use_smooth=True
petals={}
for number,angle in [(1,0),(2,-72),(3,-144),(4,144),(5,72)]:
    a=math.radians(angle);r=Vector((math.sin(a),math.cos(a),0));side=Vector((math.cos(a),-math.sin(a),0))
    pivot=r*.19+Vector((0,0,1.04));name='P'+str(number)
    bone(name,pivot,pivot+Vector((0,0,.25)),'Body');petals[name]=(r,side,pivot)
    def surface(t,u,inner=False):
        radial=.012+.18*(1-t)+.66*math.sin(math.pi*t)**.72
        z=1.04+1.26*t
        radial+=.015*(1-u*u)*math.sin(math.pi*t)
        if inner:radial-=.028
        theta=u*.625
        return (r*math.cos(theta)+side*math.sin(theta))*max(.003,radial)+Vector((0,0,z))
    verts=[];faces=[];N=20;W=12
    for inner in [False,True]:
        for i in range(N+1):
            for j in range(W+1):verts.append(surface(i/N,j/W*2-1,inner))
    stride=(N+1)*(W+1)
    for layer in range(2):
        for i in range(N):
            for j in range(W):
                k=layer*stride+i*(W+1)+j;q=(k,k+1,k+W+2,k+W+1)
                faces.append(q if layer==0 else tuple(reversed(q)))
    border=list(range(W+1))+[i*(W+1)+W for i in range(1,N+1)]+[N*(W+1)+j for j in range(W-1,-1,-1)]+[i*(W+1) for i in range(N-1,0,-1)]
    for i,k in enumerate(border):
        j=border[(i+1)%len(border)];faces.append((k,j,j+stride,k+stride))
    o=mesh(name+'_shell',verts,faces,0,name);o.data.materials.append(materials[2]);o.data.materials.append(materials[1])
    for i,f in enumerate(o.data.polygons):
        f.material_index=1 if N*W<=i<2*N*W else 0;f.use_smooth=True
    # Sparse botanical ribs keep the broad petal silhouette clean.
    for u in [-.50,0,.50]:
        pts=[surface(.08+.84*i/18,u)+r*.004 for i in range(19)]
        tube(name+'_vein',pts,[.0035]*19,1,name,5)
    tube(name+'_hinge',[pivot,surface(.06,0)],[.055,.045],0,name,10)
for i in range(5):
    a=i*math.tau/5
    loc=(math.sin(a)*.16,math.cos(a)*.16,1.19)
    orb('pollen_sac_'+str(i+1),loc,(.105,.10,.16),4,'Body')
    for j in range(7):
        b=j*math.tau/7
        orb('dry_pollen_grain',(loc[0]+.07*math.sin(b),loc[1]+.065*math.cos(b),1.22+.06*math.sin(j*2)),(.022,.022,.029),4,'Body',1)
legs={}
for name,hip,foot in [('FL',(-.16,-.06,.86),(-.88,.02,.075)),('FR',(.16,-.06,.86),(.88,.02,.075)),('Rear',(0,-.17,.86),(0,-.77,.075))]:
    hip=Vector(hip);foot=Vector(foot);rad=Vector((foot.x,foot.y,0)).normalized()
    # A single cubic root: no knee, ankle, segmented joint or rigid hinge.
    tip=foot+rad*.20;tip.z=.026
    p1=hip+rad*.62+Vector((0,0,-.26))
    p2=tip-rad*.22;p2.z=.026
    def curve(t):return hip*(1-t)**3+p1*(3*(1-t)**2*t)+p2*(3*(1-t)*t*t)+tip*t**3
    middle=curve(.5);legs[name]=(hip,middle,foot,rad)
    bone(name+'_upper',hip,curve(.33),'Root')
    bone(name+'_lower',curve(.33),curve(.67),'Root')
    bone(name+'_foot',foot,foot+Vector((0,.15,0)),'Root')
    pts=[curve(i/48) for i in range(49)]
    radii=[.070*(1-i/48)**.8+.009 for i in range(49)]
    o=tube(name+'_continuous_root',pts,radii,3,name+'_upper',12)
    weights=[]
    for i in range(len(pts)):
        t=i/48
        w={name+'_upper':(1-t)**2,name+'_lower':2*t*(1-t),name+'_foot':t*t}
        weights.extend([w]*12)
    soft_weights[o.name]=weights

# Rigid articulation retains semantic groups after material batching.
arm=bpy.data.armatures.new('CALYX_rig');rig=bpy.data.objects.new('CALYX_rig',arm);bpy.context.collection.objects.link(rig);rig.parent=root
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(h,t,parent) in bones.items():
    b=arm.edit_bones.new(name);b.head=h;b.tail=t
    if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rest={b.name:b.matrix_local.copy() for b in arm.bones}
for o in objects:
    if o.name in soft_weights:
        groups={n:o.vertex_groups.new(name=n) for n in bones}
        for i,weights in enumerate(soft_weights[o.name]):
            for n,w in weights.items():
                if w>0:groups[n].add([i],w,'REPLACE')
    else:o.vertex_groups.new(name=o['part']).add(list(range(len(o.data.vertices))),1,'REPLACE')
    o.parent=rig;mod=o.modifiers.new('skin','ARMATURE');mod.object=rig
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='CALYX_skin'
# Portable vertex pigment: dry, uneven bark shading is carried by the GLB.
colors=skin.data.color_attributes.new(name='BarkPigment',type='BYTE_COLOR',domain='CORNER')
for poly in skin.data.polygons:
    base=skin.data.materials[poly.material_index].diffuse_color
    for li in poly.loop_indices:
        x,y,z=skin.data.vertices[skin.data.loops[li].vertex_index].co
        noise=math.sin(x*81+math.sin(z*39))*math.sin(y*73+z*61);broad=math.sin(x*14+y*11+z*19)
        grain=math.sin(z*143+x*17+y*21)*math.sin(x*61+y*73)
        shade=.94+.025*noise+.055*broad+.015*grain;colors.data[li].color=(*[base[i]*max(.25,shade) for i in range(3)],1)
for m in materials:
    attr=m.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='BarkPigment'
    m.node_tree.links.new(attr.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for b in rig.pose.bones:b.rotation_mode='QUATERNION'
def around(p,q):return Matrix.Translation(p)@q.to_matrix().to_4x4()@Matrix.Translation(-p)
def align(name,a,b):
    h,t,_=bones[name];q=(t-h).rotation_difference(b-a)
    return Matrix.Translation(a)@q.to_matrix().to_4x4()@Matrix.Translation(-h)@rest[name]
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
contacts=[]
body_vertices={name:[] for name in ['Body',*petals]}
for v in skin.data.vertices:
    name=skin.vertex_groups[v.groups[0].group].name
    if name in body_vertices:body_vertices[name].append(v.co.copy())
def pose(mode,t):
    tilt=0;opening=0;slam=0;bob=0
    if mode=='Idle':bob=.008*math.sin(t*math.tau/4)
    if mode=='Locomotion':bob=.015*math.sin(t*math.tau*3/2)
    if mode=='Slam':
        charge=smooth((t-.12)/.43);hit=smooth((t-.68)/.32);recover=smooth((t-1.12)/1.08)
        opening=.62*charge*(1-recover);slam=(-.42*charge-2.12*hit)*(1-recover);bob=-.025*hit*(1-recover)
    if mode=='PollenShot':
        charge=smooth(t/1.25);recover=smooth((t-1.65)/1.15)
        tilt=.18*charge*(1-recover);opening=.90*charge*(1-recover)
    B=Matrix.Translation((0,0,bob))@around(Vector((0,0,.9)),Quaternion((1,0,0),tilt))
    rig.pose.bones['Root'].matrix=rest['Root'];rig.pose.bones['Body'].matrix=B@rest['Body'];bpy.context.view_layer.update()
    for name,(r,side,p) in petals.items():
        ang=-opening if name!='P1' else (slam if mode=='Slam' else -opening)
        rig.pose.bones[name].matrix=B@around(p,Quaternion(side,ang))@rest[name]
    if mode=='Slam':
        bpy.context.view_layer.update()
        transforms={name:rig.pose.bones[name].matrix@rest[name].inverted() for name in body_vertices}
        lowest=min((transforms[name]@v).z for name,verts in body_vertices.items() for v in verts)
        lift=max(0,.015-lowest)
        if lift:
            correction=Matrix.Translation((0,0,lift));B=correction@B
            poses={name:rig.pose.bones[name].matrix.copy() for name in body_vertices}
            rig.pose.bones['Body'].matrix=correction@poses['Body'];bpy.context.view_layer.update()
            for name in petals:rig.pose.bones[name].matrix=correction@poses[name]
    for index,(name,(h,k,f,rad)) in enumerate(legs.items()):
        hip=B@h;foot=f.copy();planted=True
        if mode=='Locomotion':
            phase=(t/2+index/3)%1;travel=.65*2*2/3
            if phase<2/3:foot.y+=travel*(.5-phase/(2/3))
            else:
                u=(phase-2/3)*3;foot.y+=travel*(-.5+smooth(u));foot.z+=.16*math.sin(math.pi*u)**2;planted=False
        # Smooth polynomial displacement over the entire root. No joint rotations.
        hd=hip-h;fd=foot-f
        sway=rad*(.035*math.sin(t*math.tau/2+index*math.tau/3)) if mode=='Locomotion' else Vector((0,0,0))
        rig.pose.bones[name+'_upper'].matrix=Matrix.Translation(hd)@rest[name+'_upper']
        rig.pose.bones[name+'_lower'].matrix=Matrix.Translation((hd+fd)*.5+sway)@rest[name+'_lower']
        rig.pose.bones[name+'_foot'].matrix=Matrix.Translation(fd)@rest[name+'_foot']
        if mode=='Locomotion':contacts.append(dict(t=t,leg=name,planted=planted,foot=list(foot)))
    bpy.context.view_layer.update()
rig.animation_data_create();durations={'Idle':4,'Locomotion':2,'Slam':2.2,'PollenShot':2.8}
for name,duration in durations.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame in range(round(duration*30)+1):
        scene.frame_set(frame);pose(name,frame/30)
        for pb in rig.pose.bones:
            for prop in ['location','rotation_quaternion','scale']:pb.keyframe_insert(prop,frame=frame,group=pb.name)
    action.use_fake_user=True;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
rig.animation_data.action=None
for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();scene.frame_set(0);scene.frame_start=0;scene.frame_end=120
root['motion_contract']=json.dumps(dict(clips=durations,forward='GLB -Z',locomotion_speed=.65,root_motion=False,slam_impact=1.0,pollen_release=1.6))
bpy.ops.wm.save_as_mainfile(filepath=str(P/'calyx.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in [root,rig,skin]:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(P/'calyx.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False,export_texcoords=False)
raw=(P/'calyx.glb').read_bytes();doc=json.loads(raw[20:20+int.from_bytes(raw[12:16],'little')]);tri=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
report=dict(blender=bpy.app.version_string,triangles=tri,bones=len(bones),materials=len(doc['materials']),clips=[a['name'] for a in doc['animations']],bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),nominal_speed=.65)
assert set(report['clips'])==set(durations)
(P/'build-report.json').write_text(json.dumps(report,indent=2));(P/'contact-targets.json').write_text(json.dumps(contacts))
print(json.dumps(report))
