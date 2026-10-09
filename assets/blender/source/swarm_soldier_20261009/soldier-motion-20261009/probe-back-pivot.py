"""背面の接続位置を維持し、回避中の武器の向きを連続経路で調整する制作候補。体の持ち上げ・非表示・拡縮は行わない。"""
import bpy, math, json, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
p=Path(__file__).resolve().parent
repo=next((root for root in p.parents if (root/'public/assets/weapons/realism-v2').is_dir()),Path('C:/Users/futsa/Documents/Codex/2026-10-09/swarm-soldier-motion'))
bpy.ops.wm.open_mainfile(filepath=str(p/'soldier-switch-support-candidate.blend'))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
body=[bpy.data.objects[n] for n in ['Body','Head']]
idle=bpy.data.actions['Soldier_Rifle_Idle'];rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];s.frame_set(0);bpy.context.view_layer.update()
runtimeBasis=Matrix(((-1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))
runtime=json.loads((p/'switch-runtime-geometry.json').read_text())
search=json.loads((p/'back-mount-floor-search.json').read_text())
def from_values(v):return Matrix([v[i:i+4] for i in range(0,16,4)]).transposed()
idleChest=from_values(runtime['poses'][0]['sockets']['Chest'])
chosen={name:next(r for r in search['results'] if r['socket']==name) for name in ['BackWeaponSocket','BackWeaponSocket_2']}
back={name:idleChest.inverted()@from_values(row['idleWorldMatrix']) for name,row in chosen.items()}
weapons={}
for kind in ['rifle','shotgun','rocket']:
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(repo/f'public/assets/weapons/realism-v2/{kind}_0.glb'))
 imported=set(bpy.data.objects)-before;vertices=[]
 for obj in imported:
  if obj.type!='MESH':continue
  co=np.empty(len(obj.data.vertices)*3,dtype=np.float32);obj.data.vertices.foreach_get('co',co)
  m=np.array(obj.matrix_world);vertices.append(co.reshape(-1,3)@m[:3,:3].T+m[:3,3])
 weapons[kind]=np.concatenate(vertices)
 for obj in imported:bpy.data.objects.remove(obj,do_unlink=True)



a=bpy.data.actions['Soldier_Dodge_Roll'];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
angles=[(x,y,z) for x in range(-90,91,15) for y in range(-90,91,30) for z in range(-90,91,30)]
rots=np.array([(Matrix.Rotation(math.radians(x),4,'X')@Matrix.Rotation(math.radians(y),4,'Y')@Matrix.Rotation(math.radians(z),4,'Z')).to_3x3() for x,y,z in angles])
vertices=np.concatenate(list(weapons.values())).T
results=[]
for pivotY in [-.14,0,.04,.08,.12,.20,.28]:
 pivot=np.array([0,pivotY,0]);translations=pivot[None,:]-rots@pivot
 samples=[]
 for i in range(41):
  f=a.frame_range[0]+(a.frame_range[1]-a.frame_range[0])*i/40;s.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
  world=np.array(rig.matrix_world@rig.pose.bones['chest'].matrix@back['BackWeaponSocket_2'])
  z=np.einsum('j,njk->nk',world[2,:3],rots)
  floors=(z@vertices).min(axis=1)+translations@world[2,:3]+world[2,3]
  idx=int(floors.argmax());samples.append({'fraction':i/40,'bestFloor':float(floors[idx]),'angles':angles[idx]})
 row={'pivotY':pivotY,'worstBestFloor':min(r['bestFloor'] for r in samples),'samples':samples};results.append(row)
 print(pivotY,row['worstBestFloor'],flush=True)
(p/'back-pivot-feasibility.json').write_text(json.dumps({'scope':'Left back mount roll, independent per-frame orientation upper bound at 41 samples; no continuity or body-intersection proof','results':results},indent=2))
