"""兵士GLBの体積判定前提を調べる。頂点は書換えず、解析上だけ溶接する。"""
import json
import struct
from collections import Counter
from pathlib import Path
import numpy as np

root=Path('.')
path=root/'public/assets/characters/swarm-soldier.glb'
data=path.read_bytes(); json_size=struct.unpack_from('<I',data,12)[0]
g=json.loads(data[20:20+json_size]);blob=memoryview(data)[20+json_size+8:]
types={5121:np.dtype('u1'),5123:np.dtype('<u2'),5125:np.dtype('<u4'),5126:np.dtype('<f4')}
sizes={'SCALAR':1,'VEC3':3,'VEC4':4}
def read(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dtype=types[a['componentType']];width=sizes[a['type']]
 start=v.get('byteOffset',0)+a.get('byteOffset',0); stride=v.get('byteStride',dtype.itemsize*width)
 return np.ndarray((a['count'],width),dtype=dtype,buffer=blob,offset=start,strides=(stride,dtype.itemsize)).copy()

def stats(points,indices,joints,weights,mode):
 # Weld coincident positions with compatible skinning; also show a looser position-only upper bound.
 if mode=='raw': remap=np.arange(len(points));unique=len(points);representatives=points
 else:
  key=np.rint(points*1_000_000).astype(np.int64)
  if mode=='skin': key=np.column_stack((key,joints,np.rint(weights*1_000_000).astype(np.int64)))
  _,first,remap=np.unique(key,axis=0,return_index=True,return_inverse=True);unique=int(remap.max()+1);representatives=points[first]
 tri=remap[indices.reshape(-1,3)]
 degenerate=np.any(np.sort(tri,axis=1)[:,1:]==np.sort(tri,axis=1)[:,:-1],axis=1)
 tri=tri[~degenerate]
 edges=np.concatenate((tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]));edges.sort(axis=1)
 edges,counts=np.unique(edges,axis=0,return_counts=True)
 parent=np.arange(unique)
 def find(i):
  while parent[i]!=i:
   parent[i]=parent[parent[i]];i=parent[i]
  return i
 for a,b in edges:
  x,y=find(a),find(b)
  if x!=y:parent[y]=x
 roots=np.array([find(i) for i in range(unique)])
 counts_per_root=Counter(roots[edges[:,0]].tolist());boundary=Counter(roots[edges[counts==1,0]].tolist());nonmanifold=Counter(roots[edges[counts>2,0]].tolist())
 comps=[{'vertices':int(np.count_nonzero(roots==r)),'edges':n,'boundaryEdges':boundary[r],'nonmanifoldEdges':nonmanifold[r]} for r,n in counts_per_root.items()]
 comps.sort(key=lambda c:c['edges'],reverse=True)
 # Broad rest-pose torso box; not a semantic skin or back surface segmentation.
 mid=representatives[edges[counts==1]].mean(axis=1)
 torso=(np.abs(mid[:,0])<=.35)&(mid[:,1]>=.8)&(mid[:,1]<=1.45)&(np.abs(mid[:,2])<=.25)
 return {'vertices':unique,'triangles':len(tri),'degenerateTriangles':int(degenerate.sum()),'edges':len(edges),'boundaryEdges':int((counts==1).sum()),'boundaryEdgesTorsoBox':int(torso.sum()),'nonmanifoldEdges':int((counts>2).sum()),'components':len(comps),'closedManifoldComponents':sum(c['boundaryEdges']==0 and c['nonmanifoldEdges']==0 for c in comps),'largestComponents':comps[:8]}

# 既知形状で、閉じた四面体と欠けた面が同じ扱いにならないことを確認。
tetra=np.array([[0,0,0],[1,0,0],[0,1,0],[0,0,1]],dtype=float)
closed=np.array([0,2,1,0,1,3,0,3,2,1,2,3]);opened=closed[:-3]
dummy=np.zeros((4,4));c=stats(tetra,closed,dummy,dummy,'raw');o=stats(tetra,opened,dummy,dummy,'raw')
assert c['boundaryEdges']==0 and c['nonmanifoldEdges']==0 and c['closedManifoldComponents']==1
assert o['boundaryEdges']==3 and o['closedManifoldComponents']==0
rows=[]
for m in g['meshes']:
 for p in m['primitives']:
  a=p['attributes'];pos=read(a['POSITION']);joints=read(a['JOINTS_0']);weights=read(a['WEIGHTS_0']);indices=read(p['indices']).reshape(-1)
  rows.append({'mesh':m['name'],'raw':stats(pos,indices,joints,weights,'raw'),'weldSkin':stats(pos,indices,joints,weights,'skin'),'weldPositionOnly':stats(pos,indices,joints,weights,'position')})
out={'scope':'Rest-pose mesh topology. Weld uses 1 micrometre rounded positions and, for weldSkin, matching joints and 1e-6 rounded weights. Torso box is broad and not a semantic skin/back segmentation. No deformation, self-intersection, closed-volume or actual game conclusion.','analyticControls':{'closedTetrahedronBoundaryEdges':c['boundaryEdges'],'openedTetrahedronBoundaryEdges':o['boundaryEdges']},'rows':rows}
dest=root/'dist-validation/weapon-body-topology-probe';dest.mkdir(parents=True,exist_ok=True);(dest/'report.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
for r in rows:
 print(r['mesh'],{k:{x:r[k][x] for x in ['vertices','triangles','boundaryEdges','nonmanifoldEdges','components','closedManifoldComponents']} for k in ['raw','weldSkin','weldPositionOnly']})
