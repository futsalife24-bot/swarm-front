"""Read-only comparison of candidate to protected source; inspect real keyframes."""
import bpy,json,hashlib,struct,math,sys
from pathlib import Path
from mathutils import Matrix,Quaternion
Q=Path(__file__).resolve().parent;R=Q.parents[4]
def geom(o):
 h=hashlib.sha256()
 for v in o.data.vertices:h.update(struct.pack('<3f',*v.co))
 for p in o.data.polygons:h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
 return h.hexdigest()
def binds(r):return {b.name:{'matrix':[list(row) for row in b.matrix_local],'parent':b.parent.name if b.parent else None} for b in r.data.bones}
def actions():
 out={}
 for a in bpy.data.actions:
  curves=[]
  for layer in a.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      curves.append((fc.data_path,fc.array_index,[(list(k.co),list(k.handle_left),list(k.handle_right),k.interpolation) for k in fc.keyframe_points]))
  out[a.name]={'sha256':hashlib.sha256(json.dumps(curves,sort_keys=True).encode()).hexdigest(),'curves':len(curves),'fingerCurves':sum(any(f in p for f in ['Thumb','Index','Middle','Ring','Little']) for p,_,_ in curves)}
 return out
bpy.ops.wm.open_mainfile(filepath=str(R/'assets/blender/source/standard_trooper_v4.blend'))
source={o.name:geom(o) for o in bpy.data.objects if o.type=='MESH'};act=actions();base=binds(next(o for o in bpy.data.objects if o.type=='ARMATURE'))
candidate=sys.argv[sys.argv.index('--source')+1] if '--source' in sys.argv else 'trooper_stage2_fitted.blend'
bpy.ops.wm.open_mainfile(filepath=str(Q/candidate))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');now=binds(rig)
assert all(source[n]==geom(bpy.data.objects[n]) for n in source)
assert act==actions(), 'Original action curve data changed'
changed=[n for n in base if base[n]!=now[n]]
assert len(now)==57 and all(n.startswith(('Thumb','Index','Middle','Ring','Little','BackWeaponSocket')) for n in changed)
meshes={};rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
rig.data.pose_position='POSE';bpy.context.view_layer.update()
for o in bpy.data.objects:
 if o.type!='MESH' or o.hide_render or o.name.startswith('Weapon'):continue
 if not any(m.type=='ARMATURE' for m in o.modifiers):continue
 maxw=0
 for v in o.data.vertices:
  assert all(math.isfinite(c) for c in v.co)
  ws=[g.weight for g in v.groups if g.weight>1e-7]
  assert ws and len(ws)<=4 and abs(sum(ws)-1)<1e-5,(o.name,v.index,ws)
  maxw=max(maxw,len(ws))
 meshes[o.name]={'vertices':len(o.data.vertices),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'maxInfluences':maxw}
isolation=[]
for side in ['L','R']:
 o=bpy.data.objects['Study_Glove_'+side];dep=bpy.context.evaluated_depsgraph_get();before=[v.co.copy() for v in o.evaluated_get(dep).data.vertices]
 for finger in ['Index','Middle','Ring','Little','Thumb']:
  n=finger+'1_'+side;b=rig.pose.bones[n];b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion((1,0,0),.8);bpy.context.view_layer.update()
  after=[v.co.copy() for v in o.evaluated_get(dep).data.vertices];moved=[i for i,(p,q) in enumerate(zip(before,after)) if (p-q).length>1e-6]
  assert moved
  assert all(any(o.vertex_groups[g.group].name.startswith(finger) and g.weight>1e-7 for g in o.data.vertices[i].groups) for i in moved)
  isolation.append({'side':side,'finger':finger,'movedVertices':len(moved),'unrelatedVerticesMoved':0});b.matrix_basis=Matrix.Identity(4);bpy.context.view_layer.update()
hashes=json.loads((Q.parent/'stage1/protected-hashes-before.json').read_text(encoding='utf-8-sig'))
assert all(hashlib.sha256(Path(e['Path']).read_bytes()).hexdigest().upper()==e['Hash'] for e in hashes)
out={'candidate':candidate,'originalMeshGeometryUnchanged':True,'originalFilesUnchanged':True,'originalActionCurveHashes':act,'boneCount':len(now),'changedBinds':changed,'unchangedBinds':[n for n in base if n not in changed],'candidateMeshes':meshes,'individualFingerIsolation':isolation,'constraints':{b.name:[c.type for c in b.constraints] for b in rig.pose.bones if b.constraints},'drivers':len(rig.animation_data.drivers),'limits':'Static poses and finger isolation only. Existing action data preserved, not yet revalidated for updated fingers/sockets. Full stage3 animation and stage4 GLB/runtime tests pending.'}
(Q/'stage2-validation.json').write_text(json.dumps(out,indent=2));print('VALIDATION PASS',len(meshes),'meshes',len(changed),'changed binds',len(act),'unchanged original actions')
