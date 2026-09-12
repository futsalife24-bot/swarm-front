import bpy,json,struct
from pathlib import Path
from mathutils import Vector
Q=Path(__file__).resolve().parent
R=Q.parents[4]
bpy.ops.wm.open_mainfile(filepath=str(R/'assets/blender/source/standard_trooper_v4.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rig.data.pose_position='REST'
bpy.context.view_layer.update()
report={'source':bpy.data.filepath,'bones':{},'meshes':[],'actions':[a.name for a in bpy.data.actions]}
for b in rig.data.bones:
 report['bones'][b.name]={'head':list(b.head_local),'tail':list(b.tail_local),'parent':b.parent.name if b.parent else None,'matrix':[list(r) for r in b.matrix_local]}
for o in bpy.data.objects:
 if o.type!='MESH':continue
 pts=[o.matrix_world@v.co for v in o.data.vertices]
 ws=[sum(g.weight for g in v.groups) for v in o.data.vertices]
 adjacency={v.index:set() for v in o.data.vertices}
 for e in o.data.edges:
  a,b=e.vertices;adjacency[a].add(b);adjacency[b].add(a)
 unseen=set(adjacency);islands=[]
 while unseen:
  stack=[unseen.pop()];size=0
  while stack:
   v=stack.pop();size+=1
   for n in adjacency[v]:
    if n in unseen:unseen.remove(n);stack.append(n)
  islands.append(size)
 report['meshes'].append({'name':o.name,'vertices':len(pts),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'components':len(islands),'bounds':[[min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]],'materials':[m.name for m in o.data.materials],'weightErrors':sum(abs(w-1)>1e-5 for w in ws) if o.parent==rig else None,'maxInfluences':max((len(v.groups) for v in o.data.vertices),default=0)})
data=(R/'public/assets/characters/standard_trooper_v4.glb').read_bytes();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);report['glb']={'nodes':len(doc['nodes']),'bones':[doc['nodes'][i]['name'] for i in doc['skins'][0]['joints']],'meshes':[m['name'] for m in doc['meshes']],'actions':[a['name'] for a in doc['animations']]}
(Q/'source-inspection.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'meshes':report['meshes'],'boneCount':len(report['bones']),'glbBones':len(report['glb']['bones'])}))
