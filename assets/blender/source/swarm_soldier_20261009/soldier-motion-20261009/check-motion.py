import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Quaternion
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-polished-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE' and not o.hide_render);body=bpy.data.objects['Body']
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
# Select the actual boot sole vertices in rest space, separately for each foot.
soles={side:[v.index for v in body.data.vertices if (body.matrix_world@v.co).z<.06 and (body.matrix_world@v.co).x*(1 if side=='L' else -1)>0] for side in ['L','R']}
report={'units':'metres','note':'Geometric sampling of animated soles; in-place cycles require matching game travel speed. This does not by itself certify visual quality.','clips':{}}
report['blendSha256']=hashlib.sha256((p/'soldier-polished-candidate.blend').read_bytes()).hexdigest()
for action in [a for a in bpy.data.actions if a.name.startswith('Soldier_')]:
 rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 rows=[];first={};last={};contacts=[]
 for f in range(math.ceil(action.frame_range[0]),math.floor(action.frame_range[1])+1):
  s.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();obj=body.evaluated_get(dg);mesh=obj.to_mesh();feet={}
  for side,indices in soles.items():
   coords=[obj.matrix_world@mesh.vertices[i].co for i in indices];low=sorted(coords,key=lambda v:v.z)[:max(1,len(coords)//10)];centre=sum(low,Vector())/len(low)
   feet[side]=list(centre)
  obj.to_mesh_clear();rows.append({'frame':f,'feet':feet})
  if action.name.startswith(('Soldier_Rifle_','Soldier_Shotgun_','Soldier_Rocket_')):
   inverse=rig.pose.bones['RightHandWeaponSocket'].matrix.inverted()
   contacts.append({side:list(inverse@rig.pose.bones['hand.'+side].head) for side in ['L','R']})
  poses={b.name:list(b.rotation_quaternion) for b in rig.pose.bones}
  if not first:first=poses
  last=poses
 floor=[min(r['feet']['L'][2],r['feet']['R'][2]) for r in rows]
 diffs={n:Quaternion(q).rotation_difference(Quaternion(last[n])).angle*180/math.pi for n,q in first.items()}
 diffs={n:min(v,360-v) for n,v in diffs.items()}
 report['clips'][action.name]={'frames':len(rows),'lowestSole':min(floor),'highestLowerSole':max(floor),'loopMaxAngleDegrees':max(diffs.values()),'loopWorstBone':max(diffs,key=diffs.get),'samples':rows}
 if contacts:report['clips'][action.name]['wristDriftFromFirstInWeaponFrame']={side:max((Vector(row[side])-Vector(contacts[0][side])).length for row in contacts) for side in ['L','R']}
(p/'motion-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps({n:{k:v for k,v in d.items() if k!='samples'} for n,d in report['clips'].items()},indent=2))
