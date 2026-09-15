import bpy, json, hashlib, math
from pathlib import Path
from mathutils import Matrix
Q=Path(__file__).resolve().parent
manifest=json.loads((Q/'motion-manifest.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(Q/'trooper_stage4_candidate.blend'))
rig=bpy.data.objects['STANDARD_TROOPER_RIG'];s=bpy.context.scene
for t in rig.animation_data.nla_tracks:t.mute=True
for name,wanted in manifest['originalActionsPreserved'].items():
 a=bpy.data.actions[name];rows=[]
 for l in a.layers:
  for st in l.strips:
   for bag in st.channelbags:
    for fc in bag.fcurves:rows.append((fc.data_path,fc.array_index,[(list(k.co),list(k.handle_left),list(k.handle_right),k.interpolation) for k in fc.keyframe_points]))
 assert hashlib.sha256(json.dumps(rows).encode()).hexdigest()==wanted,name
report={'savedBlendReopened':True,'original15FullCurveHashesMatch':True,'boneCount':len(rig.data.bones),'clips':[],'maximumScaleError':0}
for e in manifest['clips']:
 rig.animation_data.action=None
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 rig.animation_data.action=bpy.data.actions[e['name']];end=round(e['duration']*60);first=None;last=None
 for f in range(end+1):
  s.frame_set(f);bpy.context.view_layer.update()
  for b in rig.pose.bones:
   assert all(math.isfinite(v) for row in b.matrix for v in row)
   report['maximumScaleError']=max(report['maximumScaleError'],max(abs(x-1) for x in b.scale))
  mats={b.name:b.matrix.copy() for b in rig.pose.bones}
  if f==0:first=mats
  last=mats
 row={'clip':e['name'],'framesChecked':end+1,'finite':True}
 if e['loop']:row['loopMaximumMatrixDifference']=max(abs(first[n][r][c]-last[n][r][c]) for n in first for r in range(4) for c in range(4))
 report['clips'].append(row)
assert report['maximumScaleError']<1e-4
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();zs=[]
for name in manifest['exportedMeshes']:
 o=bpy.data.objects[name].evaluated_get(dg);mesh=o.to_mesh();zs.extend((o.matrix_world@v.co).z for v in mesh.vertices);o.to_mesh_clear()
report['restSoleZ']=min(zs);report['restHeight']=max(zs)-min(zs);report['restTopZ']=max(zs)
assert abs(report['restHeight']-1.8665)<.002
(Q/'saved-candidate-validation.json').write_text(json.dumps(report,indent=2))
print('SAVED CANDIDATE VALIDATED',report['boneCount'],len(report['clips']),report['restHeight'])
