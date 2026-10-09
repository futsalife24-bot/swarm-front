import bpy,json,math,hashlib,sys,numpy as np
from pathlib import Path
from mathutils import Vector
p=Path(__file__).resolve().parent
p=next((Path(a.split('=',1)[1]) for a in sys.argv if a.startswith('--directory=')),p)
exported='--exported' in sys.argv
if exported:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=60
 bpy.ops.import_scene.gltf(filepath=str(p/'swarm-soldier.glb'))
else:bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-polished-candidate.blend'))
s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(r.animation_data.nla_tracks):r.animation_data.nla_tracks.remove(tr)
# glTF importer adds an Icosphere in glTF_not_exported for bone display.
# Only the two actual character meshes belong to this geometry contract.
meshNames=['SoldierMesh_Body','SoldierMesh_Head'] if exported else ['Body','Head']
meshes=[bpy.data.objects[n] for n in meshNames]
assert all(any(m.type=='ARMATURE' for m in o.modifiers) for o in meshes)
report={'sourceSha256':hashlib.sha256((p/('swarm-soldier.glb' if exported else 'soldier-polished-candidate.blend')).read_bytes()).hexdigest(),'exported':exported,'clips':{}}
for name in ['Down','Dodge_Roll','Jump_Start','Jump_Land','Walk','Sprint']:
 runtime={'Walk':'UAL_Walk','Sprint':'UAL_sprint','Dodge_Roll':'Trial_Dodge_Roll'}
 a=bpy.data.actions[runtime.get(name,name) if exported else 'Soldier_'+name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];rows=[]
 for quarter in range(round(a.frame_range[0]*4),round(a.frame_range[1]*4)+1):
  f=quarter/4;s.frame_set(math.floor(f),subframe=f%1);dg=bpy.context.evaluated_depsgraph_get();lowest=1e9;count=0
  for obj in meshes:
   evaluated=obj.evaluated_get(dg);mesh=evaluated.to_mesh()
   coordinates=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',coordinates)
   row=np.array(evaluated.matrix_world[2]);z=coordinates.reshape(-1,3)@row[:3]+row[3]
   lowest=min(lowest,float(z.min()));count+=int(np.count_nonzero(z<-.002));evaluated.to_mesh_clear()
  rows.append({'frame':f,'lowest':lowest,'verticesBelowGround':count})
 report['clips'][name]={'minimum':min(row['lowest'] for row in rows),'worstVertexCount':max(row['verticesBelowGround'] for row in rows),'samples':rows}
(p/('exported-ground-check.json' if exported else 'body-ground-check.json')).write_text(json.dumps(report,indent=2))
print(json.dumps({k:{n:v for n,v in d.items() if n!='samples'} for k,d in report['clips'].items()}))
if '--strict' in sys.argv:
 assert all(d['minimum']>=-.002 for d in report['clips'].values()),'Body penetrates ground beyond 2mm tolerance'
