"""Local pose-ready glove surfaces: explicit joint loops and stable palm.
The remeshed attempt stays hidden as diagnostic evidence. Finger roots overlap
inside the palm rather than exposing open seams. No bone changes in this step.
"""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
report=[]
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
for side,sign in [('L',-1),('R',1)]:
 old=bpy.data.objects['Study_Glove_'+side];old.name='Diagnostic_Remesh_Glove_'+side;old.hide_render=True;old.hide_set(True)
 verts=[];faces=[];weights=[]
 def surface(rings,ns,ws):
  start=len(verts)
  for ring,w in zip(rings,ws):verts.extend(ring);weights.extend([w]*ns)
  faces.append(tuple(start+i for i in reversed(range(ns))))
  for j in range(len(rings)-1):
   for i in range(ns):a=start+j*ns+i;b=start+j*ns+(i+1)%ns;faces.append((a,b,b+ns,a+ns))
  faces.append(tuple(start+(len(rings)-1)*ns+i for i in range(ns)))
 # Tapered palm/cuff. The palm stays stable while the articulated fingers flex.
 rows=[(.797,.036,.027),(.806,.047,.032),(.837,.052,.034),(.868,.051,.034),(.890,.038,.030),(.908,.026,.027)]
 rings=[]
 for z,rx,ry in rows:
  ring=[]
  for i in range(32):
   a=i*math.tau/32;c=math.cos(a);v=math.sin(a);width=rx+(.017*math.exp(-((z-.857)/.028)**2) if c*sign<0 else 0);ring.append((sign*.399+width*math.copysign(abs(c)**.75,c),.056+ry*math.copysign(abs(v)**.75,v),z))
  rings.append(ring)
 surface(rings,32,[{'Hand_'+side:1}]*len(rings))
 for finger in ['Index','Middle','Ring','Little','Thumb']:
  bs=[rig.data.bones[f'{finger}{k}_{side}'] for k in range(1,4)];a=bs[0].head_local;end=bs[-1].tail_local;axis=(end-a).normalized();length=(end-a).length;front=Vector((0,1,0));front=(front-axis*front.dot(axis)).normalized();lateral=axis.cross(front).normalized()
  l1=(bs[1].head_local-a).length;l2=(bs[2].head_local-a).length
  us=sorted(set([-.014,-.006,0,.007,l1-.009,l1,l1+.009,l2-.008,l2,l2+.008,length-.004,length]))
  rings=[];ws=[]
  for u in us:
   t=max(0,min(1,u/length));r=(.0125 if finger=='Thumb' else .0095)*(1-.20*t)
   if u<0:r*=1.18
   if u==length:r*=.55
   c=a+axis*u;rings.append([c+r*(front*math.cos(i*math.tau/16)+lateral*math.sin(i*math.tau/16)) for i in range(16)])
   if u<.008:
    k=smooth((u+.008)/.016);w={'Hand_'+side:1-k,bs[0].name:k}
   elif u<l1-.009:w={bs[0].name:1}
   elif u<l1+.009:
    k=smooth((u-(l1-.009))/.018);w={bs[0].name:1-k,bs[1].name:k}
   elif u<l2-.008:w={bs[1].name:1}
   elif u<l2+.008:
    k=smooth((u-(l2-.008))/.016);w={bs[1].name:1-k,bs[2].name:k}
   else:w={bs[2].name:1}
   ws.append(w)
  surface(rings,16,ws)
 me=bpy.data.meshes.new('JointLoopGlove_'+side);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Study_Glove_'+side,me);bpy.context.scene.collection.objects.link(o);o.parent=rig;o.data.materials.append(bpy.data.materials['Study_Glove'])
 for p in me.polygons:p.use_smooth=True
 for i,ws in enumerate(weights):
  for n,w in ws.items():
   if w>1e-7:(o.vertex_groups.get(n) or o.vertex_groups.new(name=n)).add([i],w,'REPLACE')
 m=o.modifiers.new('Joint loop linear skin','ARMATURE');m.object=rig;m.use_deform_preserve_volume=False
 report.append({'side':side,'vertices':len(verts),'triangles':sum(len(f)-2 for f in faces),'topology':'closed palm and five closed joint-loop fingers; roots overlap within palm; no external open boundaries','weights':'palm Hand only, each finger blends only own chain and Hand at root'})
(Q/'glove-topology.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(Q/'trooper_stage2_fitted.blend'))
