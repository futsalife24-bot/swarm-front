"""Restore smooth shoulder skinning from preserved pre-waist body, no geometry edits."""
import bpy,json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
def apply(output):
 o=bpy.data.objects['Study_Body'];old=bpy.data.objects['Diagnostic_Body_PreJointLoops'];o.data=o.data.copy();old.data.calc_loop_triangles();tris=[list(t.vertices) for t in old.data.loop_triangles];vs=[v.co.copy() for v in old.data.vertices];tree=BVHTree.FromPolygons(vs,tris,all_triangles=True);changed=0
 def sm(t):t=max(0,min(1,t));return t*t*(3-2*t)
 for v in o.data.vertices:
  x,y,z=v.co;amount=sm((abs(x)-.175)/.065)*sm((z-1.08)/.06)*(1-sm((z-1.44)/.04))
  if amount<1e-7:continue
  hit=tree.find_nearest(v.co);ids=tris[hit[2]];a,b,c=[vs[i] for i in ids];v0=b-a;v1=c-a;v2=hit[0]-a;d00=v0.dot(v0);d01=v0.dot(v1);d11=v1.dot(v1);d20=v2.dot(v0);d21=v2.dot(v1);den=d00*d11-d01*d01
  if abs(den)<1e-14:continue
  b1=(d11*d20-d01*d21)/den;b2=(d00*d21-d01*d20)/den;b0=1-b1-b2;prior={}
  for i,w in zip(ids,[b0,b1,b2]):
   for g in old.data.vertices[i].groups:
    n=old.vertex_groups[g.group].name;prior[n]=prior.get(n,0)+max(0,w)*g.weight
  current={o.vertex_groups[g.group].name:g.weight for g in v.groups};merged={n:current.get(n,0)*(1-amount)+prior.get(n,0)*amount for n in set(current)|set(prior)};chosen=sorted(((n,w) for n,w in merged.items() if w>1e-7),key=lambda x:x[1],reverse=True)[:4];total=sum(w for _,w in chosen)
  for g in o.vertex_groups:g.remove([v.index])
  for n,w in chosen:o.vertex_groups[n].add([v.index],w/total,'REPLACE')
  changed+=1
 neighbors=[[] for v in o.data.vertices]
 for e in o.data.edges:
  a,b=e.vertices;neighbors[a].append(b);neighbors[b].append(a)
 masks={v.index:sm((abs(v.co.x)-.15)/.09)*sm((v.co.z-1.08)/.08)*(1-sm((v.co.z-1.42)/.06)) for v in o.data.vertices}
 weights=[{g.group:g.weight for g in v.groups} for v in o.data.vertices]
 for _ in range(8):
  nxt=[dict(w) for w in weights]
  for i,amount in masks.items():
   if amount<1e-7 or not neighbors[i]:continue
   mean={}
   for j in neighbors[i]:
    for g,w in weights[j].items():mean[g]=mean.get(g,0)+w/len(neighbors[i])
   blend=amount*.35;ws={g:weights[i].get(g,0)*(1-blend)+mean.get(g,0)*blend for g in set(weights[i])|set(mean)};items=sorted(ws.items(),key=lambda x:x[1],reverse=True)[:4];total=sum(w for _,w in items);nxt[i]={g:w/total for g,w in items if w>1e-7}
  weights=nxt
 for i,amount in masks.items():
  if amount<1e-7:continue
  for g in o.vertex_groups:g.remove([i])
  for g,w in weights[i].items():o.vertex_groups[g].add([i],w,'REPLACE')
 output.write_text(json.dumps({'restoredVertices':changed,'smoothedVertices':sum(a>1e-7 for a in masks.values()),'smoothingIterations':8,'mesh':'Study_Body','geometryChanged':False,'source':'preserved Diagnostic_Body_PreJointLoops barycentric surface weights + local neighbor smoothing','blendRegion':'abs(x) .15-.24m; z fade1.08-1.16 and1.42-1.48; no change below1.08m','maximumInfluences':4,'reason':'Stage2 waist weight hard boundary x=.26 crossed inner upper arm; adjacent vertices moved 0.33m across a 0.006m edge in reach pose.'},indent=2))
