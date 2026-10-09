import bpy,json,math
from pathlib import Path
from mathutils import Vector
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p.parent/'soldier-rig-20261009/weighted.blend'))
r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE' and not o.hide_render)
body=bpy.data.objects['Body'];head=bpy.data.objects['Head']
r.animation_data_clear()
for b in r.pose.bones:
 b.rotation_mode='QUATERNION';b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
report={'reason':'小指の骨が前腕上にあり、掌の方向推定と指ウェイトが誤っていた','bones':{},'verticesChanged':0}
bpy.ops.object.select_all(action='DESELECT');r.hide_set(False);r.select_set(True);bpy.context.view_layer.objects.active=r
bpy.ops.object.mode_set(mode='EDIT')
for side,sign in [('L',1),('R',-1)]:
 points=[(.750,.067,1.235),(.782,.070,1.230),(.809,.072,1.225),(.826,.072,1.225)]
 for i,seg in enumerate(['proximal','intermediate','distal']):
  b=r.data.edit_bones['little_'+seg+'.'+side]
  report['bones'][b.name]={'beforeHead':list(b.head),'beforeTail':list(b.tail)}
  b.head=r.matrix_world.inverted()@Vector((points[i][0]*sign,*points[i][1:]));b.tail=r.matrix_world.inverted()@Vector((points[i+1][0]*sign,*points[i+1][1:]))
  b.align_roll(Vector((0,0,1)))
  report['bones'][b.name].update(afterHead=list(b.head),afterTail=list(b.tail))
bpy.ops.object.mode_set(mode='OBJECT')
def distance(point,a,b):
 d=b-a;t=max(0,min(1,(point-a).dot(d)/d.length_squared));return (point-a-t*d).length
for v in body.data.vertices:
 co=body.matrix_world@v.co;side='L' if co.x>0 else 'R';old=[(body.vertex_groups[w.group].name,w.weight) for w in v.groups]
 # Only repair the misplaced small-finger region and its old false influences.
 if not (abs(co.x)>.715 and co.y>.049) and not any(n.startswith('little_') and w>.001 for n,w in old):continue
 if abs(co.x)<.70:
  groups=[('lower_arm.'+side,max(0,min(1,(.65-abs(co.x))/.035))),('hand.'+side,max(0,min(1,(abs(co.x)-.615)/.035)))]
 else:
  names=['hand.'+side]+[f+'_'+seg+'.'+side for f in ['ring','little'] for seg in ['proximal','intermediate','distal']]
  ds=sorted((distance(co,r.matrix_world@r.data.bones[n].head_local,r.matrix_world@r.data.bones[n].tail_local),n) for n in names)
  groups=[(n,math.exp(-((d-ds[0][0])/.010)**2)) for d,n in ds[:3]]
 total=sum(w for n,w in groups)
 for g in body.vertex_groups:g.remove([v.index])
 for n,w in groups:
  if w/total>.005:body.vertex_groups[n].add([v.index],w/total,'REPLACE')
 report['verticesChanged']+=1
# Retain only the user's output, never the kit's hidden donor or fitted copies.
for o in list(bpy.data.objects):
 if o not in [r,body,head]:bpy.data.objects.remove(o,do_unlink=True)
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
bpy.ops.outliner.orphans_purge(do_local_ids=True,do_linked_ids=False,do_recursive=True)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(p/'soldier-rig-input.blend'))
(p/'hand-rig-repair.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('HAND_RIG_REPAIRED',report['verticesChanged'])
