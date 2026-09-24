"""One continuous torso-to-neck skin; shared rows for scales and throat armor."""
import bpy,bmesh,math,json
from mathutils import Vector
from math import sin,cos,pi

def build(rig,M,base,slim,neck,chainweights,P):
 profiles=[(slim(base((x,0,z))),w,h) for x,z,w,h in [(1.55,2.60,.018,.025),(1.30,2.60,.32,.46),(.65,2.60,.61,.78),(-.40,2.62,.66,.83),(-1.12,2.74,.57,.73)]]
 profiles += [(neck[0],.43,.56)]+[(p,r,r) for p,r in zip(neck[1:],[.31,.275,.235,.20,.17,.155])]
 dense=[]
 for k in range(len(profiles)-1):
  pp=[profiles[max(0,min(len(profiles)-1,k+j))] for j in (-1,0,1,2)]
  for j in range(24):
   t=j/24
   def cubic(v):return .5*(2*v[1]+(-v[0]+v[2])*t+(2*v[0]-5*v[1]+4*v[2]-v[3])*t*t+(-v[0]+3*v[1]-3*v[2]+v[3])*t*t*t)
   dense.append((cubic([p[0] for p in pp]),max(.01,cubic([p[1] for p in pp])),max(.01,cubic([p[2] for p in pp]))))
 dense.append(profiles[-1]);arc=[0.]
 for a,b in zip(dense,dense[1:]):arc.append(arc[-1]+(b[0]-a[0]).length)
 rows=[];j=0;N=math.ceil(arc[-1]/.115)
 for i in range(N+1):
  s=arc[-1]*i/N
  while j<len(arc)-2 and arc[j+1]<s:j+=1
  t=(s-arc[j])/(arc[j+1]-arc[j]);a,b=dense[j:j+2];rows.append((a[0].lerp(b[0],t),a[1]*(1-t)+b[1]*t,a[2]*(1-t)+b[2]*t))
 axes=[];rowweights=[]
 first=(neck[1]-neck[0]).normalized()
 for i,(c,w,h) in enumerate(rows):
  d=(rows[min(i+1,N)][0]-rows[max(0,i-1)][0]).normalized();axes.append((Vector((0,1,0)),Vector((0,1,0)).cross(d).normalized()))
  influence=max(0,min(1,((c-neck[0]).dot(first)+.6)/1.05));influence=influence*influence*(3-2*influence)
  ww={n:v*influence for n,v in chainweights(c,neck,'Neck.').items()};ww['Torso']=1-influence;rowweights.append({n:v for n,v in ww.items() if v>1e-8})
 def sample(i,phi,lift=0):
  i=max(0,min(N-.000001,i));a=int(i);t=i-a
  c=rows[a][0].lerp(rows[a+1][0],t);w=rows[a][1]*(1-t)+rows[a+1][1]*t;h=rows[a][2]*(1-t)+rows[a+1][2]*t
  u=axes[a][0];v=axes[a][1].lerp(axes[a+1][1],t).normalized();normal=(u*cos(phi)/w+v*sin(phi)/h).normalized()
  return c+u*(w*cos(phi))+v*(h*sin(phi))+normal*lift
 vertices=[];faces=[];materials=[];smooth=[];weights=[]
 def component(vs,fs,mat,ww,sm=False):
  off=len(vertices);vertices.extend(vs);faces.extend([tuple(off+x for x in f) for f in fs]);materials.extend([mat]*len(fs));smooth.extend([sm]*len(fs));weights.extend([ww.copy() for v in vs])
 # Connected skin: shared rings and closed end caps, not overlapping ellipsoids.
 sides=64
 for i in range(N+1):
  vertices.extend([sample(i,2*pi*j/sides) for j in range(sides)]);weights.extend([rowweights[i].copy() for _ in range(sides)])
 for i in range(N):
  for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
 faces.extend([tuple(reversed(range(sides))),tuple(range(N*sides,(N+1)*sides))]);materials.extend([0]*len(faces));smooth.extend([True]*len(faces))
 core_vertex_count=len(vertices);core_face_count=len(faces)
 for i,(c,w,h) in enumerate(rows[1:-1],1):
  count=max(12,round(2*pi*math.sqrt((w*w+h*h)/2)/.15));dp=2*pi/count
  for j in range(count):
   phi=dp*(j+.5*(i%2))
   if sin(phi)<-.62:continue
   shape=[(0,-.64,.006),(-.58,-.25,.011),(-.57,.28,.019),(0,.78,.022),(.57,.28,.019),(.58,-.25,.011),(0,.08,.020),(0,0,-.008)]
   vs=[sample(i+dy,phi+dx*dp,lift) for dx,dy,lift in shape];fs=[]
   for k in range(6):fs.extend([(k,(k+1)%6,6),((k+1)%6,k,7)])
   component(vs,fs,1 if (i*37+j*17)%23==0 else 0,rowweights[i])
  # Continuous throat-to-belly chevrons use the same surface/rows and weights.
  if i%2==0:
   for j in range(6):
    a=-pi/2-.96+j*1.92/6;b=a+1.92/6
    shift=lambda p:.42*(1-abs(p+pi/2)/.96)
    top=[sample(i-.75+shift(a),a,.024),sample(i-.75+shift(b),b,.024),sample(i+.77+shift(b),b,.034),sample(i+.77+shift(a),a,.034)]
    bottom=[p+(c-p).normalized()*.028 for p in top];fs=[(0,1,2,3),(7,6,5,4)]+[(k,(k+1)%4,(k+1)%4+4,k+4) for k in range(4)]
    component(top+bottom,fs,2,rowweights[i])
 me=bpy.data.meshes.new('Unified neck torso skin');me.from_pydata(vertices,[],faces);me.update()
 for n in ['Gold scales','Gold variations','Ivory • ceramic bone']:me.materials.append(M[n])
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
 for p,mat,sm in zip(me.polygons,materials,smooth):p.material_index=mat;p.use_smooth=sm
 o=bpy.data.objects.new('Unified neck + torso',me);bpy.context.collection.objects.link(o);o.parent=rig
 for n in sorted({n for w in weights for n in w}):o.vertex_groups.new(name=n)
 for i,ww in enumerate(weights):
  for n,w in ww.items():o.vertex_groups[n].add([i],w,'REPLACE')
 mod=o.modifiers.new('Continuous torso neck skinning','ARMATURE');mod.object=rig
 o['continuous_core_vertices']=core_vertex_count;o['continuous_core_faces']=core_face_count
 # Independent edge-incidence and connected-component check on the base skin.
 edges={};adj=[set() for _ in range(core_vertex_count)]
 for f in faces[:core_face_count]:
  for a,b in zip(f,f[1:]+f[:1]):edges[tuple(sorted((a,b)))]=edges.get(tuple(sorted((a,b))),0)+1;adj[a].add(b);adj[b].add(a)
 seen={0};todo=[0]
 while todo:
  for b in adj[todo.pop()]-seen:seen.add(b);todo.append(b)
 assert len(seen)==core_vertex_count and all(v==2 for v in edges.values())
 (P/'continuous-body.json').write_text(json.dumps({'core_vertices':core_vertex_count,'core_faces':core_face_count,'core_connected_components':1,'nonmanifold_core_edges':0,'rows':N+1,'single_blender_object':o.name,'weights':'Continuous Torso to Neck chain transition; decorations share sampled surface and row weights.','note':'Scales and ventral armor are surface shells in the same object; the skin core is one closed connected mesh.'},indent=2),encoding='utf-8')
 return o
