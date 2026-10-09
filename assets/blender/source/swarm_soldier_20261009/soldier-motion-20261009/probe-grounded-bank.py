"""Test a continuous body bank with close, rigid back mounts before authoring.

Unlike the rejected fixed-angle probe, solve the phase-dependent angle while
preserving the original body's lowest point. Does not save a modified model.
"""
import bpy, json, math, numpy as np
from pathlib import Path
from mathutils import Matrix
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-roll-grips-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
runtime=json.loads((p/'switch-runtime-geometry.json').read_text())
mounts=json.loads((p/'back-mount-close-candidate.json').read_text())['mounts']
def mat(v):return np.array(v).reshape(4,4).T
idleChest=mat(runtime['poses'][0]['sockets']['Chest'])
back={n:np.linalg.inv(idleChest)@mat(row['idleWorldMatrix']) for n,row in mounts.items()}
# Probe entirely in runtime coordinates: Y up, Z travel. Weapon vertices were
# extracted after the exact runtime weapon-root rotation.
basis=np.array([[-1,0,0,0],[0,0,1,0],[0,1,0,0],[0,0,0,1]],dtype=float)
weapons={kind:np.array([v for mesh in meshes for v in mesh['vertices']]) for kind,meshes in runtime['weapons'].items()}
angles=np.arange(-90,91,5,dtype=float)
rotations=np.array([[[math.cos(math.radians(a)),-math.sin(math.radians(a)),0],[math.sin(math.radians(a)),math.cos(math.radians(a)),0],[0,0,1]] for a in angles])
transition=.0001*(angles[:,None]-angles[None,:])**2
transition[np.abs(angles[:,None]-angles[None,:])>15]=1e12
report={'scope':__doc__,'actions':{}}
for actionName in ['Soldier_Dodge_Roll','Soldier_Dodge_Roll_Shotgun','Soldier_Dodge_Roll_Rocket']:
 action=bpy.data.actions[actionName];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 frames=np.linspace(action.frame_range[0],action.frame_range[1],89)
 lows=[];shifts=[];bodyLows=[]
 for f in frames:
  s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
  dg=bpy.context.evaluated_depsgraph_get();parts=[]
  for name in ['Body','Head']:
   obj=bpy.data.objects[name].evaluated_get(dg);mesh=obj.to_mesh();co=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',co)
   m=basis@np.array(obj.matrix_world);parts.append(co.reshape(-1,3)@m[:3,:3].T+m[:3,3]);obj.to_mesh_clear()
  body=np.concatenate(parts);bodyLow=body[:,1].min();bodyLows.append(float(bodyLow))
  pivot=(basis@np.array(rig.matrix_world)@np.array(rig.pose.bones['hips'].matrix))[:3,3]
  chest=basis@np.array(rig.matrix_world)@np.array(rig.pose.bones['chest'].matrix)
  held=basis@np.array(rig.matrix_world)@np.array(rig.pose.bones['RightHandWeaponSocket'].matrix)
  heldKind='rocket' if actionName.endswith('Rocket') else 'shotgun' if actionName.endswith('Shotgun') else 'rifle'
  groups=[(held,weapons[heldKind])]+[(chest@m,co) for m in back.values() for co in weapons.values()]
  points=np.concatenate([co@m[:3,:3].T+m[:3,3] for m,co in groups])
  angleLows=[];angleShifts=[]
  for rot in rotations:
   shift=bodyLow-((body-pivot)@rot[1]+pivot[1]).min()
   angleShifts.append(float(shift));angleLows.append(float(((points-pivot)@rot[1]+pivot[1]+shift).min()))
  lows.append(angleLows);shifts.append(angleShifts)
 lows=np.array(lows);cost=1e7*np.maximum(0,.005-lows)**2+.00002*angles[None,:]**2
 zero=int(np.where(angles==0)[0][0]);cost[0,:]=1e12;cost[0,zero]=0;cost[-1,:]=1e12;cost[-1,zero]=0
 previous=np.empty_like(cost,dtype=int);score=cost[0].copy()
 for i in range(1,len(frames)):
  allScores=score[:,None]+transition;previous[i]=np.argmin(allScores,axis=0);score=cost[i]+np.min(allScores,axis=0)
 path=[int(np.argmin(score))]
 for i in range(len(frames)-1,0,-1):path.append(int(previous[i,path[-1]]))
 path.reverse()
 rows=[{'frame':float(f),'angle':float(angles[j]),'equipmentMinimum':float(lows[i,j]),'bodyMinimum':bodyLows[i],'groundShift':shifts[i][j],'bestPossibleMinimum':float(lows[i].max())} for i,(f,j) in enumerate(zip(frames,path))]
 report['actions'][actionName]={'minimum':min(r['equipmentMinimum'] for r in rows),'unavoidableMinimum':min(r['bestPossibleMinimum'] for r in rows),'maximumAngle':max(abs(r['angle']) for r in rows),'samples':rows}
 print(actionName,json.dumps({k:v for k,v in report['actions'][actionName].items() if k!='samples'}),flush=True)
(p/'grounded-bank-probe.json').write_text(json.dumps(report,indent=2))
