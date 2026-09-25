"""HARROW v10: dragon torso and independently timed aerial wing imitation.
Run with Blender 5.2 --background --factory-startup --threads 6 --python.
The accepted static generator is preserved verbatim in geometry_source.py.
"""
import bpy, bmesh, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
from math import sin, cos, pi
P=Path(__file__).resolve().parent
src=(P/'geometry_source.py').read_text(encoding='utf-8').split('# Material groups inside semantic collections')[0]
def replace(a,b):
 global src
 assert a in src, a
 src=src.replace(a,b)
# Capture fabricated components before material batching, to preserve rigid parts.
replace('M={}; G={}', 'M={}; G={}; CHUNKS=[]')
replace(' k=(region,mat,smooth)', ' CHUNKS.append((region,mat,smooth,[tuple(x) for x in v],list(f)))\n k=(region,mat,smooth)')
replace(' # Mandible drops', " region='Jaw'\n # Mandible drops")
replace(' for j in range(12):\n  t=j/11;x=-5.26', " region='Skull'\n for j in range(12):\n  t=j/11;x=-5.26")
replace(' for j in range(11):\n  t=j/10;x=-5.13', " region='Jaw'\n for j in range(11):\n  t=j/10;x=-5.13")
replace(' # nostril cavities', " region='Skull'\n # nostril cavities")
replace('bone((-5.18,-.11', "region='Jaw'\nbone((-5.18,-.11")
replace('for j in range(5):\n x=-4.94', "region='Skull'\nfor j in range(5):\n x=-4.94")
# Explicit articulation groups; decoration follows the same segment as its spar.
replace("  if hind:\n   hip=", "  limb_region=region\n  region=limb_region+'|0'\n  if hind:\n   hip=")
replace('  for a,b in zip(pts,pts[1:]):', "  for segment,(a,b) in enumerate(zip(pts,pts[1:])):\n   region=limb_region+'|'+str(segment)")
replace('  for p,r in zip(pts,[.29,.23,.19,.18]):joint(p,r)', "  for segment,(p,r) in enumerate(zip(pts,[.29,.23,.19,.18])):\n   region=limb_region+'|'+str(segment);joint(p,r)")
replace('  for aa,bb,rr in [(Vector(hip),a,.27),(a,b,.23),(b,Vector(wrist),.19)]:', "  for segment,(aa,bb,rr) in enumerate([(Vector(hip),a,.27),(a,b,.23),(b,Vector(wrist),.19)]):\n   region=limb_region+'|'+str(segment)")
replace('  for t in (.22,.72):orb', "  region=limb_region+'|1'\n  for t in (.22,.72):orb")
replace('  wx,wy,wz=wrist', "  region=limb_region+'|3'\n  wx,wy,wz=wrist")
replace(" region='Wing mechanism'+('.L' if s<0 else '.R')", " side='.L' if s<0 else '.R'\n region='Wing upper'+side")
replace(' for a,b,r in [(shoulder,elbow,.29),(elbow,wrist,.205)]:', " for segment,(a,b,r) in enumerate([(shoulder,elbow,.29),(elbow,wrist,.205)]):\n  region=('Wing upper' if segment==0 else 'Wing fore')+side")
replace(' joint(wrist,.29)', " region='Wing fore'+side")
replace(" region='Wing blades'+('.L' if s<0 else '.R')", " region='Wing fan'+side")
replace(' # Layer of shorter inward secondaries', " region='Wing secondary'+side\n # Layer of shorter inward secondaries")
ns={'__file__':str(P/'geometry_source.py')};exec(compile(src,'geometry_source.py','exec'),ns)
M=ns['M']; chunks=ns['CHUNKS']
# Replace cylindrical spars, pistons and their ornaments with rectangular cassettes.
chunks[:]=[c for c in chunks if not c[0].startswith(('Wing upper','Wing fore'))]
ns['material']('HOUND white shell',(.72,.75,.73),.36,.47)
ns['material']('HOUND black inset',(.035,.046,.052),.52,.49)
ns['material']('HOUND cyan slit',(.03,.78,.94),.0,.4,.65)
def cassette(part,center,direction,length,width,depth,mat):
 d=Vector(direction).normalized();x=Vector((1,0,0));x=(x-d*x.dot(d)).normalized();y=d.cross(x)
 # Eight-corner rectangular section: shallow chamfers, flat broad faces.
 r=.10;section=[(-.5+r,-.5),(.5-r,-.5),(.5,-.5+r),(.5,.5-r),(.5-r,.5),(-.5+r,.5),(-.5,.5-r),(-.5,-.5+r)]
 vs=[tuple(Vector(center)+x*(a*width)+y*(b*depth)+d*(z*length/2)) for z in (-1,1) for a,b in section]
 fs=[tuple(reversed(range(8))),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
 chunks.append((part,mat,False,vs,fs))
hound_part=json.loads((P/'hound-part.json').read_text(encoding='utf-8'))
support_instances=[];reinforcement_instances=[]
for s,side in [(-1,'.L'),(1,'.R')]:
 q=list(map(Vector,[(-1,.71*s,3.25),(.04,1.49*s,4.36),(-.45,3.12*s,6.83)]))
 for i,(a,b) in enumerate(zip(q,q[1:])):
  part=('Wing upper' if i==0 else 'Wing fore')+side
  # Deliberately uneven joints: 2 reused assemblies below elbow + 4 above.
  stations=([a,a.lerp(b,.46)+Vector((-.15,s*.09,.06)),b] if i==0 else
   [a,a.lerp(b,.22)+Vector((.13,s*.08,0)),a.lerp(b,.50)+Vector((-.14,-s*.06,.02)),a.lerp(b,.73)+Vector((.10,s*.07,-.02)),b])
  for j,(aa,bb) in enumerate(zip(stations,stations[1:])):
   d=(bb-aa).normalized();y=Vector((0,s,0));y=(y-d*y.dot(d)).normalized();x=y.cross(d)
   R=Matrix((x,y,d)).transposed()@Matrix.Rotation(math.radians([9,-11,7,-8][j]),3,'Z')
   length=(bb-aa).length*1.12;c=(aa+bb)/2
   for component in hound_part['parts']:
    vs=[tuple(c+R@Vector(v)*length) for v in component['vertices']]
    chunks.append((part,component['material'],False,vs,component['faces']))
   support_instances.append({'side':side,'bone':part,'index':j+(0 if i==0 else 2),'start':list(aa),'end':list(bb),'length_scale':length,'roll_degrees':[9,-11,7,-8][j]})
   if j: cassette(part,aa,d,.16,.19,.17,'HOUND black inset')
 cassette('Wing fan'+side,q[2],q[2]-q[1],.17,.22,.20,'HOUND black inset')
 # Misunderstood structural imitation: irregular oblique overlays, not a clean truss.
 # Each overlay stays wholly on its parent articulated segment.
 for k,(segment,t,length,angle,lateral) in enumerate([(0,.29,.92,39,-.09),(0,.69,.85,-32,.10),(1,.20,1.03,-41,-.12),(1,.47,.96,33,.13),(1,.77,1.07,-28,-.10)]):
  a,b=q[segment],q[segment+1];d=(b-a).normalized();y=Vector((0,s,0));y=(y-d*y.dot(d)).normalized();x=y.cross(d)
  part=('Wing upper' if segment==0 else 'Wing fore')+side
  # Asymmetry in placement and obliquity, with the same reclaimed component.
  theta=angle+(7 if s>0 and k%2==0 else -4 if s>0 else 0)
  c=a.lerp(b,t+( .025 if s>0 and k%2 else 0))+x*lateral+y*(.13+.025*(k%2))
  R=Matrix((x,y,d)).transposed()@Matrix.Rotation(math.radians(theta),3,'Y')@Matrix.Rotation(math.radians(-6 if k%2 else 9),3,'Z')
  for component in hound_part['parts']:
   vs=[tuple(c+R@Vector(v)*length) for v in component['vertices']]
   chunks.append((part,component['material'],False,vs,component['faces']))
  reinforcement_instances.append({'side':side,'bone':part,'index':k,'center':list(c),'length_scale':length,'oblique_degrees':theta})
(P/'support-reuse.json').write_text(json.dumps({'source':hound_part['source'],'source_sha256':hound_part['source_sha256'],'source_parts':[c['name'] for c in hound_part['parts']],'instances':support_instances,'per_wing':6,'reinforcements':reinforcement_instances,'reinforcements_per_wing':5,'geometry':'Actual HOUND three-component assemblies. Six primary supports plus five irregular oblique overlays per wing. Each follows its articulated parent; no alternating cyan blocks.'},indent=2),encoding='utf-8')
raw=[Vector(v) for _,_,_,vs,_ in chunks for v in vs]
factor=14/(max(v.x for v in raw)-min(v.x for v in raw))
zmin=min(v.z for v in raw)*factor;zmax=max(v.z for v in raw)*factor
def base(p):
 p=Vector(p)*factor;p.z=(p.z-zmin)*7.5/(zmax-zmin);return p
center=base((-.4,0,2.6))
def slim(p):return Vector((p.x,p.y*.75,center.z+(p.z-center.z)*.80))
def nearest(p,chain):
 best=None
 for i,(a,b) in enumerate(zip(chain,chain[1:])):
  d=b-a;t=max(0,min(1,(p-a).dot(d)/d.length_squared));dist=(p-a-d*t).length_squared
  if best is None or dist<best[0]:best=(dist,i,t)
 return best[1:]
neck0=list(map(base,ns['NP']));tail0=list(map(base,ns['TP']))
neck=[p+(slim(neck0[0])-neck0[0])*max(0,1-i/3) for i,p in enumerate(neck0)]
tail=[p+(slim(tail0[0])-tail0[0])*max(0,1-i/2) for i,p in enumerate(tail0)]
legs={};wing={}
for s,side in [(-1,'.L'),(1,'.R')]:
 for hind in [False,True]:
  name=('Hindlimb' if hind else 'Forelimb')+side
  q=[(1.05,s*.73,2.63),(1.55,s*1.03,1.76),(2.51,s*1.04,.98),(2.05,s*1.20,.52)] if hind else [(-1.55,s*.78,2.84),(-1.76,s*1.03,1.82),(-2.47,s*1.22,1.15),(-2.88,s*1.33,.61)]
  old=list(map(base,q));delta=slim(old[0])-old[0]
  new=[old[i]+delta*[1,.35,0,0][i] for i in range(4)]
  legs[name]=(old,new)
 shoulder=base((-1,.71*s,3.25))
 wing[side]=[slim(shoulder)+1.5*(base(q)-shoulder) for q in [(-1,.71*s,3.25),(.04,1.49*s,4.36),(-.45,3.12*s,6.83)]]
def morph(p,part):
 if part.startswith('PRISM shoulder'):return Vector(p)
 p=base(p)
 if part.startswith(('Wing','Launcher')):
  s=-1 if part.endswith('.L') else 1;q=base((-1,.71*s,3.25));return slim(q)+1.5*(p-q)
 if part.startswith(('Body','Shoulder','Ventral','Pectoral','Dorsal')):return slim(p)
 if part.startswith(('Forelimb','Hindlimb')):
  old,new=legs[part.split('|')[0]];i,t=nearest(p,old)
  if part.startswith('Hindlimb') and part.endswith('|0'):
   axis=(old[1]-old[0]).normalized();c=old[0]+axis*(p-old[0]).dot(axis);p=c+(p-c)*.5
  return p+(new[i]-old[i]).lerp(new[i+1]-old[i+1],t)
 if part in ('Neck','Tail'):
  old,new=(neck0,neck) if part=='Neck' else (tail0,tail);i,t=nearest(p,old)
  if part=='Neck':
   c=old[i].lerp(old[i+1],t);p=c+(p-c)*.5
  return p+(new[i]-old[i]).lerp(new[i+1]-old[i+1],t)
 return p
# Actual articulated skeleton, no per-object animation substitutes.
arm=bpy.data.armatures.new('HARROW skeleton');rig=bpy.data.objects.new('HARROW • ANOMALY',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
spec={}
def bone(name,a,b,parent=None):
 e=arm.edit_bones.new(name);e.head=a;e.tail=b
 if parent:e.parent=arm.edit_bones[parent]
 e.use_deform=True;spec[name]=(Vector(a),Vector(b),parent)
bone('Root',(0,0,0),(0,0,.6));bone('Torso',center,center+Vector((0,0,1)),'Root')
for i in range(6):bone('Neck.%02d'%i,neck[i],neck[i+1],'Torso' if i==0 else 'Neck.%02d'%(i-1))
bone('Head',neck[-1],base((-5.15,0,4.5)),'Neck.05');bone('Jaw',base((-4.04,0,4.62)),base((-5.1,0,4.08)),'Head')
for name,(old,q) in legs.items():
 for i in range(3):bone(name+'.%d'%i,q[i],q[i+1],'Torso' if i==0 else name+'.%d'%(i-1))
 bone(name+'.3',q[3],q[3]+Vector((-.65,0,0)),name+'.2')
for side,q in wing.items():
 bone('Wing upper'+side,q[0],q[1],'Torso');bone('Wing fore'+side,q[1],q[2],'Wing upper'+side);bone('Wing fan'+side,q[2],q[2]+Vector((1,0,0)),'Wing fore'+side)
for i in range(7):bone('Tail.%02d'%i,tail[i],tail[i+1],'Torso' if i==0 else 'Tail.%02d'%(i-1))
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True;arm.display_type='OCTAHEDRAL'
rest={b.name:b.matrix_local.copy() for b in arm.bones}
inv={n:m.inverted() for n,m in rest.items()}
for p in rig.pose.bones:p.rotation_mode='QUATERNION'
rig['name']='HARROW';rig['name_ja']='ハロウ';rig['classification']='ANOMALY / observational designation'
rig['forward']='Blender -X; glTF -X. Standalone asset; game-axis adapter required.'
rig['revision']='v9';rig['v4_torso_reference_width_ratio']=.75;rig['v4_torso_reference_depth_ratio']=.8;rig['wing_scale']=1.5
rig['v4_neck_reference_radial_ratio']=.5;rig['thigh_radial_ratio']=.5
rig['body_surface']='One continuous loft from torso through neck, with smoothly blended skinning.'
rig['locomotion']='In-place -X; authored speed 0.3282051282051282 m/s, game scale 1.95, world speed 0.64 m/s, 4.2 second stride cycle. External translation required.'
# Bind by semantic part. Neck/tail skin blends neighbouring links; rigid shells stay rigid.
def chainweights(p,q,prefix):
 i,t=nearest(p,q);u=i+t-.5;i0=max(0,min(len(q)-2,math.floor(u)));i1=max(0,min(len(q)-2,math.floor(u)+1));f=u-math.floor(u)
 if i0==i1:return {prefix+'%02d'%i0:1.}
 return {prefix+'%02d'%i0:1-f,prefix+'%02d'%i1:f}
prism=json.loads((P/'prism-core.json').read_text(encoding='utf-8'))
for n,props in prism['materials'].items():ns['material'](n,props['color'],props['metal'],props['rough'],props['em'])
for s,side in [(-1,'.L'),(1,'.R')]:
 c=slim(base((-1.42,s*.66,2.94)));c.y=s*.69
 rotation=Matrix.Rotation(pi if s<0 else 0,3,'Z')
 for component in prism['parts']:
  vs=[tuple(c+rotation@Vector(v)*.95) for v in component['vertices']]
  chunks.append(('PRISM shoulder'+side,component['material'],False,vs,component['faces']))
groups={}
for part,mat,sm,vs,fs in chunks:
 if part=='Body' or part.startswith('Shoulder.') or part in ('Ventral armour','Pectoral chevrons'):continue
 if part=='Neck' and mat.startswith(('Gold','Ivory')):continue
 v=[morph(p,part) for p in vs];mid=sum(v,Vector())/len(v)
 if part.startswith(('Forelimb','Hindlimb')):weights=[{part.replace('|','.'):1}]*len(v)
 elif part.startswith('Wing'):weights=[{part.replace('secondary','fore'):1}]*len(v)
 elif part.startswith('Launcher'):weights=[{'Wing fan'+part[-2:]:1}]*len(v)
 elif part in ('Neck','Tail'):
  q,prefix=(neck,'Neck.') if part=='Neck' else (tail,'Tail.')
  flexible=mat in ('Gold underhide','Joint recess') or (part=='Neck' and len(vs)>180)
  if flexible:weights=[chainweights(p,q,prefix) for p in v]
  else:
   ww=chainweights(mid,q,prefix);n=max(ww,key=ww.get);weights=[{n:1}]*len(v)
 elif part=='Skull':weights=[{'Head':1}]*len(v)
 elif part=='Jaw':weights=[{'Jaw':1}]*len(v)
 else:weights=[{'Torso':1}]*len(v)
 k=(part,mat,sm)
 if k not in groups:groups[k]=[[],[],[]]
 vv,ff,ww=groups[k];offset=len(vv);vv.extend(v);ff.extend([tuple(x+offset for x in face) for face in fs]);ww.extend(weights)
import sys
sys.path.insert(0,str(P))
from unified_body import build as build_unified_body
from wing_imitation import flap as imitation_flap, DURATION as FLIGHT_DURATION, SCHEDULES
model=[build_unified_body(rig,M,base,slim,neck,chainweights,P)]
for (part,mat,sm),(v,f,w) in groups.items():
 mesh=bpy.data.meshes.new(part+' / '+mat);mesh.from_pydata(v,[],f);mesh.materials.append(M[mat]);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
 for poly in mesh.polygons:poly.use_smooth=sm
 ob=bpy.data.objects.new(part+' / '+mat,mesh);bpy.context.collection.objects.link(ob);ob.parent=rig
 for n in sorted({n for d in w for n in d}):ob.vertex_groups.new(name=n)
 for i,weights in enumerate(w):
  for n,weight in weights.items():
   if weight>0:ob.vertex_groups[n].add([i],weight,'REPLACE')
 mod=ob.modifiers.new('HARROW skeletal deformation','ARMATURE');mod.object=rig;model.append(ob)
# Contact landmarks: lowest model points on each of the four rigid foot groups.
contacts={}
for name in legs:
 pts=[v.co.copy() for o in model if o.name.startswith(name+'|3 /') for v in o.data.vertices]
 low=min(v.z for v in pts);contacts[name]=[list(v) for v in pts if v.z<low+.0001]
# Analytic matrices with deterministic FABRIK limb solve, baked at 30 fps.
def around(point,axis,angle):return Matrix.Translation(point)@Matrix.Rotation(angle,4,axis)@Matrix.Translation(-point)
def smooth(a):return a*a*(3-2*a)
def bump(u,a,b,c):
 if u<a or u>c:return 0
 return smooth((u-a)/(b-a)) if u<b else 1-smooth((u-b)/(c-b))
def solve(q,start,end):
 p=[x.copy() for x in q];p[0]=start.copy();lengths=[(q[i+1]-q[i]).length for i in range(3)]
 for _ in range(120):
  p[3]=end.copy()
  for i in (2,1,0):p[i]=p[i+1]+(p[i]-p[i+1]).normalized()*lengths[i]
  p[0]=start.copy()
  for i in (0,1,2):p[i+1]=p[i]+(p[i+1]-p[i]).normalized()*lengths[i]
  if (p[3]-end).length<1e-7:break
 return p
def align(name,a,b):
 qa,qb,_=spec[name];rot=(qb-qa).rotation_difference(b-a).to_matrix().to_4x4()
 return Matrix.Translation(a)@rot@Matrix.Translation(-qa)@rest[name]
FPS=40;TIME_SCALE=1.75;GAME_SCALE=1.95;WALK_SPEED=.64/GAME_SCALE;STANCE=.72
durations={k:v*TIME_SCALE for k,v in {'Idle':4.,'Locomotion':2.4,'Attack':3.,'Threat':4.,'AirThreat':4.,'Spin':3.6,'Takeoff':2.,'Flight':2.4,'Glide':1.2,'Dive':.8,'StaggerFall':1.5,'Land':1.}.items()}
durations['Dive']=.9  # Approved fast strike after the deliberate glide warning.
durations['Spin']=3.0
durations['Flight']=FLIGHT_DURATION
SPIN_WIND=1.15;SPIN_TURN=1.05;SPIN_END=SPIN_WIND+SPIN_TURN
# Convex hulls give the exact minimum of the rigid wing geometry under any
# articulated pose, without rescanning every feather vertex during bisection.
wing_hulls={}
for side in ('.L','.R'):
 for part in ('upper','fore','fan'):
  bn='Wing '+part+side
  pts=[v.co.copy() for o in model if any(g.name==bn for g in o.vertex_groups) and o.name.startswith(('Wing','Launcher')) for v in o.data.vertices]
  bm=bmesh.new()
  for p in pts:bm.verts.new(p)
  result=bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False)
  wing_hulls[bn]=[v.co.copy() for v in result['geom'] if isinstance(v,bmesh.types.BMVert)]
  bm.free()

def spin_state(t):
 # One authority-owned turn. These local poses supply intent and inertia only.
 coil=bump(t,0.,1.00,1.48)
 sweep=smooth(max(0,min(1,(t-.85)/.30)))*(1-smooth(max(0,min(1,(t-2.20)/.48))))
 brake=bump(t,1.97,2.30,3.)
 settle=bump(t,2.20,2.53,3.)
 return coil,sweep,brake,settle

def spin_wing(side,torso,coil,sweep,brake,t):
 sign=-1 if side=='.L' else 1
 fore=-sign*(.075*sweep-.13*coil)
 fan=-sign*.10*brake
 q=wing[side]
 def mats(angle):
  upper=torso@around(q[0],'X',-sign*angle)@around(q[0],'Z',sign*(.06*coil-.045*sweep))
  lower=upper@around(q[1],'X',fore)
  end=lower@around(q[2],'X',-sign*.35*sweep)@around(q[2],'Z',fan)
  return { 'Wing upper'+side:upper, 'Wing fore'+side:lower, 'Wing fan'+side:end }
 def low(angle):
  transforms=mats(angle)
  return min((transforms[n]@p).z for n in transforms for p in wing_hulls[n])
 # A raised outside wing displays the wind-up; both wings then skim the floor.
 reach=max(coil*.78,sweep,brake*.92)
 raised=coil*(1-smooth(max(0,min(1,(t-.78)/.37))))
 target=.025+(1-reach)*4.2+(1.30*raised if side=='.R' else .12*raised)
 lo,hi=-.30,1.30
 for _ in range(24):
  mid=(lo+hi)*.5
  if low(mid)>target:lo=mid
  else:hi=mid
 angle=(lo+hi)*.5
 # Rest endpoints are exact so interruption/recovery blends remain continuous.
 angle*=max(coil,sweep,brake)
 return {n:m@rest[n] for n,m in mats(angle).items()}
# Anatomical shoulder rotation lowers the outer wing surface to ground Z=.02.
# The authority owns horizontal spin, altitude and vertical movement.
spin_angles={}
for side in ('.L','.R'):
 pivot=wing[side][0];sign=1 if side=='.L' else -1
 points=[v.co.copy() for o in model if o.name.startswith(('Wing','Launcher')) and side in o.name for v in o.data.vertices]
 def wing_floor(angle):
  return min(pivot.z+sin(sign*angle)*(p.y-pivot.y)+cos(angle)*(p.z-pivot.z) for p in points)
 lo,hi=0.,1.6
 assert wing_floor(lo)>.02 and wing_floor(hi)<.02
 for iteration in range(50):
  mid=(lo+hi)*.5
  if wing_floor(mid)>.02:lo=mid
  else:hi=mid
 spin_angles[side]=(lo+hi)*.5
phase={'Forelimb.L':0.,'Hindlimb.R':.25,'Forelimb.R':.5,'Hindlimb.L':.75}
target_log={}; actions=[]
def pose(clip,t):
 duration=durations[clip];u=t/duration;cycle=2*pi*u
 attack=bump(u,.30,.43,.70) if clip=='Attack' else 0
 anticipation=bump(u,.06,.27,.38) if clip=='Attack' else 0
 gape=bump(u,.25,.36,.45) if clip=='Attack' else 0
 threat=bump(u,.08,.5,.91) if clip in ('Threat','AirThreat') else 0
 breath=sin(cycle)*.045 if clip=='Idle' else 0
 coil,sweep,brake,settle=spin_state(t) if clip=='Spin' else (0,0,0,0)
 air=smooth(u) if clip=='Takeoff' else 1-smooth(u) if clip=='Land' else 1 if clip in ('Flight','AirThreat','Glide','Dive','StaggerFall') else 0
 hover=air if clip in ('Takeoff','Flight','AirThreat') else 1-smooth(u) if clip=='Glide' else 0
 # Front is -X: a positive torso pitch raises the chest. Neck/head counterbend
 # separately so the face stays trained down at the target, rather than skyward.
 pitch=.95*hover if clip in ('Takeoff','Flight','AirThreat') else -.16*air if clip=='Land' else .95*hover-.32*(1-hover) if clip=='Glide' else -.32-.50*smooth(u) if clip=='Dive' else .20*sin(pi*u) if clip=='StaggerFall' else 0
 downstroke=smooth(u/.35) if u<=.35 else 1-smooth((u-.35)/.65)
 flap=.38*(1-2*downstroke)
 bob=.04*(1-cos(cycle*2)) if clip=='Locomotion' else breath
 lean=.16*anticipation-.43*attack
 # A lower support posture gives the long stride enough extension without
 # detaching rigid claws; a local recoil lift keeps the tail above ground.
 posture=-.30 if clip=='Locomotion' else .60*sin(pi*u) if clip=='StaggerFall' else 0
 translation=Vector((lean,0,bob-.16*attack+.055*threat+posture+2.25*hover))
 posem={'Root':rest['Root'],'Torso':Matrix.Translation(translation)@around(center,'Y',-.015*attack+pitch)@rest['Torso']}
 if clip=='Spin':
  twist=-.36*coil+.14*sweep-.08*brake
  translation=Vector((-.12*coil+.10*brake,.16*coil-.10*brake,-.55*coil-.27*sweep-.20*brake))
  posem['Torso']=Matrix.Translation(translation)@around(center,'Z',twist)@around(center,'Y',-.12*coil-.015*sweep+.035*brake)@around(center,'X',.04*coil-.03*brake)@rest['Torso']
  for side in ('.L','.R'):posem.update(spin_wing(side,posem['Torso']@inv['Torso'],coil,sweep,brake,t))
 # FK neck, head, tail and wings: local pivots but rotations about body-world axes.
 for n,(a,b,parent) in spec.items():
  if n in posem or n.startswith(('Forelimb','Hindlimb')):continue
  delta=posem[parent]@inv[parent];r=Matrix.Identity(4)
  if n.startswith('Neck.'):
   i=int(n[-2:]);r=around(a,'Y',.012*sin(cycle-i*.22)*(1 if clip in ('Idle','Locomotion') else sin(pi*u)**2)+.057*anticipation-.074*attack+.016*threat-.09*hover)
   if clip=='Spin':r=around(a,'Z',.047*coil-.026*sweep+.035*brake-.017*settle)@around(a,'Y',-.028*coil-.012*sweep+.021*brake)
  elif n=='Head':r=around(a,'Z',.075*sin(cycle)*hover)@around(a,'Y',.26*anticipation-.40*attack+.040*threat-.48*hover)
  elif n=='Jaw':r=around(a,'Y',.070*(1-cos(cycle)) if clip=='Idle' else -.49*anticipation-.34*gape+.14*attack-.10*threat)
  elif n.startswith('Tail.'):
   i=int(n[-2:]);r=around(a,'Y',-.17*hover)@around(a,'Z',(.025 if clip=='Idle' else .04)*sin(cycle-i*.5)*(1 if clip in ('Idle','Locomotion') else sin(pi*u)**2))
   if clip=='Spin':
    lag=bump(t,.12+i*.026,1.12+i*.026,1.75+i*.035)
    recoil=bump(t,1.75+i*.022,2.24+i*.032,3.)
    r=around(a,'Y',-.017*sweep-.012*brake)@around(a,'Z',.052*lag-.040*recoil)
  elif n.startswith('Wing'):
   sign=-1 if n.endswith('.L') else 1
   wave=(1-cos(cycle))*.5
   amplitude=.24 if clip=='Idle' else .36 if clip=='Locomotion' else 0
   spread=-amplitude*wave+.30*attack-.24*anticipation-.38*threat
   if air:
    independent=flap if clip=='Takeoff' else imitation_flap('.L' if sign<0 else '.R',t,durations[clip],clip=='Flight')
    spread=(-.30+independent)*air if clip in ('Flight','AirThreat','Takeoff') else (-.36+.12*sin(pi*u))*air if clip=='Land' else (-.30+.38)*hover-.36*(1-hover)
    if clip=='AirThreat':spread-=.08*threat
    if clip=='StaggerFall':spread=-.40+.32*sin(pi*u)
    if 'upper' in n:r=around(a,'X',sign*spread)
    elif 'fore' in n:r=around(a,'X',sign*spread*.35)
    else:r=around(a,'Z',sign*(.12*air+.13*sin(cycle)*hover+.12*threat if clip=='AirThreat' else .12*air+.13*sin(cycle)*hover))
   elif 'upper' in n:r=around(a,'X',sign*spread)
   elif 'fore' in n:r=around(a,'X',sign*(spread*.68))
   else:r=around(a,'Z',sign*(amplitude*.6*sin(cycle)-.24*attack+.18*anticipation+.30*threat))
  posem[n]=delta@r@rest[n]
 targets={};stance={}
 for name,(old,q) in legs.items():
  target=q[3].copy();planted=True
  if clip=='Spin':
   # Feet stay anchored during the coil. Short alternating pivot steps during
   # the sweep and a larger final brake plant keep the legs from frozen skating.
   diagonal=name in ('Forelimb.L','Hindlimb.R')
   step=bump(t,1.12 if diagonal else 1.57,1.34 if diagonal else 1.77,1.57 if diagonal else 1.97)
   stop=bump(t,1.97 if diagonal else 2.38,2.14 if diagonal else 2.60,2.38 if diagonal else 2.82)
   foot_twist=twist*sweep*.55
   target=around(Vector((0,0,0)),'Z',foot_twist)@target
   target.z+=.22*step+.14*stop
   target.x+=(.14 if name.startswith('Hindlimb') else -.12)*brake
   planted=step+stop<1e-7
  if air:
   tuck=1.05+1.25*smooth(u) if clip=='Dive' else 1.05
   if name.startswith('Forelimb'):
    target.z+=(tuck*(1-hover)+1.65*hover)*air
    target.x+=(.30*(1-hover)+.65*hover)*air
   else:
    target.z+=(tuck*(1-hover)+.12*hover)*air
    target.x+=(.30*(1-hover)-.12*hover)*air
   target=(posem['Torso']@inv['Torso'])@target;planted=False
  if clip=='Locomotion':
   ph=(u+phase[name])%1.;duty=STANCE;stride=WALK_SPEED*duration*duty
   if ph<duty:target.x+=stride*(ph/duty-.5)
   else:
    v=(ph-duty)/(1-duty);target.x+=stride*(.5-smooth(v));target.z+=.48*sin(pi*v)**2;planted=False
  start=(posem['Torso']@inv['Torso'])@q[0];solved=solve(q,start,target)
  for i in range(3):posem[name+'.%d'%i]=align(name+'.%d'%i,solved[i],solved[i+1])
  # Preserve horizontal claw contact independently of upper-limb bending.
  claw_pitch=(-.48 if name.startswith('Forelimb') else -.60)*hover
  posem[name+'.3']=around(target,'Y',claw_pitch)@Matrix.Translation(target-q[3])@rest[name+'.3'];targets[name]=list(target);stance[name]=planted
 for n,m in posem.items():
  parent=spec[n][2]
  rig.pose.bones[n].matrix_basis=inv[n]@rest[parent]@posem[parent].inverted()@m if parent else inv[n]@m
 bpy.context.view_layer.update()
 return {'targets':targets,'stance':stance,'max_limb_error':max((Vector(targets[n])-solve(q,(posem['Torso']@inv['Torso'])@q[0],Vector(targets[n]))[-1]).length for n,(old,q) in legs.items())}
scene=bpy.context.scene;scene.render.fps=FPS;rig.animation_data_create()
for clip,duration in durations.items():
 action=bpy.data.actions.new(clip);rig.animation_data.action=action;target_log[clip]=[]
 for f in range(round(duration*FPS)+1):
  scene.frame_set(f);entry=pose(clip,f/FPS);target_log[clip].append(entry)
  for pb in rig.pose.bones:
   pb.keyframe_insert('location',frame=f,group=pb.name);pb.keyframe_insert('rotation_quaternion',frame=f,group=pb.name);pb.keyframe_insert('scale',frame=f,group=pb.name)
 action.use_fake_user=True;actions.append(action)
 track=rig.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,0,action);track.mute=True
rig.animation_data.action=None
for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
scene.frame_set(0);bpy.context.view_layer.update()
# Studio is explicitly excluded from export.
scene.unit_settings.system='METRIC';scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.32,.36,.41,1);bg.inputs[1].default_value=.45;scene.view_settings.view_transform='AgX'
studio=bpy.data.collections.new('Studio • not exported');scene.collection.children.link(studio)
def move_studio(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 studio.objects.link(o)
floor=ns['material']('Studio ground',(.13,.16,.18),0,.8)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.018));ground=bpy.context.object;ground.name='Studio ground';ground.data.materials.append(floor);move_studio(ground)
def area(n,p,power,size,color):
 d=bpy.data.lights.new(n,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(n,d);studio.objects.link(o);o.location=p;o.rotation_euler=(Vector((1,0,4))-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm key',(-9,-12,17),4500,10,(1,.91,.76));area('Cool rim',(6,9,15),5200,9,(.72,.84,1));area('Front',(-11,3,8),2400,7,(1,.97,.9));area('Wing fill',(6,-10,11),3200,8,(1,1,1))
def cam(n,p,target,scale):
 d=bpy.data.cameras.new(n);d.type='ORTHO';d.ortho_scale=scale;o=bpy.data.objects.new(n,d);studio.objects.link(o);o.location=p;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
cams={'hero':cam('hero',(-15,-24,13),(1,0,4.5),24),'front':cam('front',(-28,0,5),(0,0,5),23),'side':cam('side',(1,-30,5),(1,0,5),18),'back':cam('back',(28,0,5),(0,0,5),23),'top':cam('top',(1,0,30),(1,0,0),24),'head':cam('head',(-9,-9,6.1),(-4.3,0,4.66),3.8),'wing':cam('wing',(3,-18,12),(1.4,-5,7.5),13)}
scene.camera=cams['hero'];scene.frame_start=0;scene.frame_end=120
im=bpy.data.images.load(str(P/'reference.jpg'));im.pack()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in model:o.select_set(True)
bpy.context.view_layer.objects.active=rig
# Save source in a clean rest pose; select an action in the Action editor to play.
bpy.ops.wm.save_as_mainfile(filepath=str(P/'harrow.blend'))
bpy.ops.export_scene.gltf(filepath=str(P/'harrow.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False,export_extras=True)
coords=[v.co for o in model for v in o.data.vertices]
def bounds(v):return {ax:[min(p[i] for p in v),max(p[i] for p in v)] for i,ax in enumerate('xyz')}
body_before=[base(v) for part,mat,sm,vs,fs in chunks if part=='Body' for v in vs];body_after=[slim(v) for v in body_before]
stats={'name':'HARROW','revision':'v5','blender':bpy.app.version_string,'meshes':len(model),'bones':len(arm.bones),'vertices':sum(len(o.data.vertices) for o in model),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in model),'bounds':bounds(coords),'body_before':bounds(body_before),'body_after':bounds(body_after),'wing_scale_about_attachment':1.5,'old_wing_roots':[list(base((-1,s*.71,3.25))) for s in [-1,1]],'new_wing_roots':[list(wing[s][0]) for s in ['.L','.R']],'clips':durations,'fps':FPS,'locomotion_speed_m_s':.16,'stance_fraction':.76,'contacts':contacts,'max_solver_error':max(e['max_limb_error'] for entries in target_log.values() for e in entries),'neck_radial_ratio':.5,'thigh_radial_ratio':.5,'scope':'Standalone rigged asset; game integration, collision, LOD and performance budget not accepted.'}
stats['v4_reference_body_before']=stats.pop('body_before');stats['v4_reference_body_after']=stats.pop('body_after');stats['v4_reference_neck_radial_ratio']=stats.pop('neck_radial_ratio')
stats['continuous_body']=json.loads((P/'continuous-body.json').read_text());stats['prism_source_sha256']=prism['source_sha256'];stats['prism_instances']=2
stats.update(revision='v9',locomotion_speed_m_s=WALK_SPEED,stance_fraction=STANCE,game_scale=GAME_SCALE,world_walk_speed_m_s=.64,time_scale=TIME_SCALE,walk_cycle_world_distance=.64*durations['Locomotion'],swing_lift=.48,spin_shoulder_angles=spin_angles,spin_timing={'wind':SPIN_WIND,'turn':SPIN_TURN,'end':SPIN_END,'duration':3.},missiles_per_wing=5,scope='Spin-only game integration candidate. Root heading and altitude are authority-owned; one smoothstep turn from 1.15 to 2.20 seconds. Other v8 clips and geometry retained.')
stats.update(revision='v10',scope='Dragon torso and core-supported aerial wing imitation candidate. Not installed in the game.',wing_schedules=SCHEDULES,flight_mechanism='Internal torso core supports altitude independently of either wing; wings imitate flight.',randomness='Independent seeded variable-duration cycles, baked in a 16.8-second GLB loop; not runtime random.')
(P/'build-report.json').write_text(json.dumps(stats,indent=2),encoding='utf-8');(P/'animation-targets.json').write_text(json.dumps(target_log),encoding='utf-8')
print('HARROW_BUILD',json.dumps({k:v for k,v in stats.items() if k not in ('contacts',)}))
