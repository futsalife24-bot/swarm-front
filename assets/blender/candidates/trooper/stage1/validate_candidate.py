import bpy,json,hashlib,struct,math
from pathlib import Path
Q=Path(__file__).resolve().parent;R=Q.parents[4]
def fingerprint(o):
 h=hashlib.sha256()
 for v in o.data.vertices:h.update(struct.pack('<3f',*v.co))
 for p in o.data.polygons:h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
 return h.hexdigest()
def bones(rig):return {b.name:{'matrix':[list(r) for r in b.matrix_local],'parent':b.parent.name if b.parent else None} for b in rig.data.bones}
bpy.ops.wm.open_mainfile(filepath=str(R/'assets/blender/source/standard_trooper_v4.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');original=bones(rig)
old={o.name:fingerprint(o) for o in bpy.data.objects if o.type=='MESH'};actions=sorted(a.name for a in bpy.data.actions)
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_anatomy_stage1.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
assert original==bones(rig)
assert old=={n:fingerprint(bpy.data.objects[n]) for n in old}
assert actions==sorted(a.name for a in bpy.data.actions)
body=bpy.data.objects['Study_Body'];arm_count=0
for v in body.data.vertices:
 assert all(math.isfinite(c) for c in v.co)
 if abs(v.co.x)>.32 and .88<v.co.z<1.2:
  ns=[body.vertex_groups[g.group].name for g in v.groups if g.weight>1e-7]
  assert all(('Arm' in n or 'Hand' in n) for n in ns),(list(v.co),ns)
  arm_count+=1
assert arm_count>20
geometry={o.name:fingerprint(o) for o in bpy.data.objects if o.name.startswith('Study_') and o.type=='MESH'}
report={'originalBoneMatricesParentsPreserved':True,'allOriginalMeshesPreserved':True,'originalActionsPreserved':True,'forearmRegionVerticesChecked':arm_count,'candidateGeometry':geometry,'restPoseOnly':True}
report['renderEvidence']='Current revision rendered directly before save; closeups from reopened saved blend.'
report['protectedFileHashesUnchanged']=all(hashlib.sha256(Path(e['Path']).read_bytes()).hexdigest().upper()==e['Hash'] for e in json.loads((Q/'protected-hashes-before.json').read_text(encoding='utf-8-sig')))
assert report['protectedFileHashesUnchanged']
(Q/'reopen-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
