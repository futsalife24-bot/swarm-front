"""Choose continuous elbow paths using actual linear-skinned sleeve/armor vertices.

Weapon solids are conservative analytical envelopes of the existing parts.
No mesh or bone-rest changes; hand and attachment matrices remain fixed.
"""
import bpy,math,json,numpy as np
from mathutils import Matrix,Vector,Quaternion

def box_sdf(p,c,h,angle=0):
 q=p-np.array(c)
 if angle:
  ca,sa=math.cos(angle),math.sin(angle);q=q@np.array(((1,0,0),(0,ca,-sa),(0,sa,ca)))
 d=np.abs(q)-np.array(h)
 return np.linalg.norm(np.maximum(d,0),axis=1)+np.minimum(np.max(d,axis=1),0)

def tube_sdf(p,start,end,r,z):
 d=np.stack((np.linalg.norm(p[:,[0,2]]-np.array((0,z)),axis=1)-r,np.abs(p[:,1]-(start+end)*.5)-(end-start)*.5),axis=1)
 return np.linalg.norm(np.maximum(d,0),axis=1)+np.minimum(np.max(d,axis=1),0)

def weapon_sdf(p,kind):
 if kind=='rifle':
  d=[box_sdf(p,(0,.07,.035),(.0335,.15,.05)),box_sdf(p,(0,-.20,.05),(.0325,.115,.0525)),box_sdf(p,(0,-.014,-.068),(.025,.0335,.0575),.24),box_sdf(p,(0,.30,.035),(.0375,.10,.0415)),box_sdf(p,(0,.102,-.099),(.0235,.0445,.081),-.15),tube_sdf(p,.38,.66,.024,.043),box_sdf(p,(0,.076,.116),(.0225,.038,.0235))]
 else:
  d=[tube_sdf(p,-.30,.607,.092,.09),tube_sdf(p,-.31,-.23,.111,.09),tube_sdf(p,.48,.60,.103,.09),box_sdf(p,(0,0,-.045),(.026,.034,.075)),box_sdf(p,(0,.28,-.045),(.03,.0325,.075)),box_sdf(p,(.108,.18,.16),(.0285,.06,.0335))]
 return np.minimum.reduce(d)

def collect_skin(rig,side):
 names=['UpperArm_'+side,'LowerArm_'+side];verts=[];weights=[]
 for o in bpy.data.objects:
  if o.type!='MESH' or o.hide_render or o.name.startswith(('Weapon_','Diagnostic','Study_Glove')):continue
  if not any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers):continue
  ids={g.index:g.name for g in o.vertex_groups};to_rig=rig.matrix_world.inverted()@o.matrix_world
  for v in o.data.vertices:
   groups={ids[g.group]:g.weight for g in v.groups if g.weight>0 and ids[g.group] in rig.data.bones}
   if not any(groups.get(n,0)>.0001 for n in names):continue
   point=to_rig@v.co;verts.append((*point,1));weights.append(groups)
 x=np.array(verts);by_bone={}
 for name in rig.data.bones.keys():
  w=np.array([v.get(name,0) for v in weights]);idx=np.flatnonzero(w)
  if len(idx):by_bone[name]=(idx,w[idx])
 return x,by_bone

def solve(rig,action,output):
 scene=bpy.context.scene;restinv={b.name:np.array(b.matrix_local.inverted()) for b in rig.data.bones};skin={side:collect_skin(rig,side) for side in ['R','L']};options={'R':{},'L':{}};frames={};counts={s:len(skin[s][0]) for s in skin}
 mounts=[]
 for name in ['Trial_BackMount_Rifle','Trial_BackMount_Rocket']:
  obj=bpy.data.objects[name];points=np.array([tuple(obj.matrix_world@v.co) for v in obj.data.vertices]);lo=points.min(axis=0);hi=points.max(axis=0);mounts.append(((lo+hi)*.5,(hi-lo)*.5))
 for f in range(61):
  rig.animation_data.action=action;scene.frame_set(f);bpy.context.view_layer.update()
  mats={b.name:b.matrix.copy() for b in rig.pose.bones};frames[f]=mats
  weapons={k:mats['RightHandWeaponSocket'] if (k=='rifle' and f<27) or (k=='rocket' and f>=36) else mats['BackWeaponSocket' if k=='rifle' else 'BackWeaponSocket_2'] for k in ['rifle','rocket']}
  weapon_inv={k:np.array(m.inverted()) for k,m in weapons.items()}
  mount_inv=np.linalg.inv(np.array(mats['Chest'])@restinv['Chest'])
  for side in ['R','L']:
   un,ln,hn='UpperArm_'+side,'LowerArm_'+side,'Hand_'+side;a=mats[un].translation;end=mats[hn].translation;current_elbow=mats[ln].translation;axis=(end-a).normalized();dist=(end-a).length;l1=rig.data.bones[un].length;l2=rig.data.bones[ln].length;along=(l1*l1-l2*l2+dist*dist)/(2*dist);height=math.sqrt(max(0,l1*l1-along*along));radial=(current_elbow-a-axis*along).normalized();perp=axis.cross(radial).normalized()
   x,weights=skin[side];constant=np.zeros_like(x)
   for name,(idx,w) in weights.items():
    if name not in [un,ln]:constant[idx]+=(x[idx]@(np.array(mats[name])@restinv[name]).T)*w[:,None]
   opts=[]
   for i in range(32):
    angle=i*math.tau/32;k=a+axis*along+(radial*math.cos(angle)+perp*math.sin(angle))*height;transforms={};points=constant.copy()
    for name,start,finish in [(un,a,k),(ln,k,end)]:
     q=mats[name].to_quaternion()
     if name==ln:q=mats[hn].to_quaternion()@rig.data.bones[hn].matrix_local.to_quaternion().inverted()@rig.data.bones[ln].matrix_local.to_quaternion()
     old_y=q@Vector((0,1,0));new_y=(finish-start).normalized();rot=old_y.rotation_difference(new_y)@q;mat=rot.to_matrix().to_4x4();mat.translation=start;transforms[name]=mat
     if name==un:
      idx,w=weights[name];points[idx]+=(x[idx]@(np.array(mat)@restinv[name]).T)*w[:,None]
    lower_base=transforms[ln].to_quaternion();lower_y=(end-k).normalized()
    for roll_index in range(8):
     lower_q=Quaternion(lower_y,roll_index*math.pi/4)@lower_base;lower_mat=lower_q.to_matrix().to_4x4();lower_mat.translation=k;trial_points=points.copy();idx,w=weights[ln];trial_points[idx]+=(x[idx]@(np.array(lower_mat)@restinv[ln]).T)*w[:,None]
     cost=0;depth=0
     for kind,inv in weapon_inv.items():
      local=(trial_points@inv.T)[:,:3];sd=weapon_sdf(local,kind);penetration=np.maximum(0,.002-sd);cost+=float(np.sum(penetration**2))*6000;depth=max(depth,float(np.max(np.maximum(0,-sd))))
     local=(trial_points@mount_inv.T)[:,:3]
     for center,half in mounts:
      sd=box_sdf(local,center,half);penetration=np.maximum(0,.002-sd);cost+=float(np.sum(penetration**2))*6000;depth=max(depth,float(np.max(np.maximum(0,-sd))))
     cost+=80*max(0,.10-(k.x if side=='R' else -k.x))**2
     cost+=(k-current_elbow).length_squared*.6
     opts.append({'cost':cost,'elbow':k.copy(),'mats':{un:transforms[un],ln:lower_mat},'depth':depth})
   options[side][f]=opts
 selected={};metrics=[]
 for side in ['R','L']:
  opts=options[side];dp=np.array([o['cost'] for o in opts[0]]);parents={}
  for f in range(1,61):
   p=np.array([tuple(o['elbow']) for o in opts[f-1]]);c=np.array([tuple(o['elbow']) for o in opts[f]]);cost=dp[:,None]+np.sum((p[:,None]-c[None,:])**2,axis=2)*45
   for name in ['UpperArm_'+side,'LowerArm_'+side]:
    pq=np.array([tuple(o['mats'][name].to_quaternion()) for o in opts[f-1]]);cq=np.array([tuple(o['mats'][name].to_quaternion()) for o in opts[f]]);angles=2*np.arccos(np.clip(np.abs(pq@cq.T),0,1));cost+=angles**2*8+np.maximum(0,angles-.65)**2*5000
   parents[f]=np.argmin(cost,axis=0);dp=np.min(cost,axis=0)+np.array([o['cost'] for o in opts[f]])
  at=int(np.argmin(dp));selected[side]={60:at}
  for f in range(60,0,-1):at=int(parents[f][at]);selected[side][f-1]=at
 previous={}
 for f in range(61):
  rig.animation_data.action=action;scene.frame_set(f);bpy.context.view_layer.update();rig.animation_data.action=None
  for side in ['R','L']:
   opt=options[side][f][selected[side][f]]
   for n,m in opt['mats'].items():rig.pose.bones[n].matrix=m;bpy.context.view_layer.update()
   rig.pose.bones['Hand_'+side].matrix=frames[f]['Hand_'+side];bpy.context.view_layer.update()
   metrics.append({'frame':f,'side':side,'selected':selected[side][f],'envelopeDepth':opt['depth'],'cost':opt['cost'],'minimumFrameCost':min(o['cost'] for o in options[side][f]),'minimumFrameDepth':min(o['depth'] for o in options[side][f])})
  for n in ['RightHandWeaponSocket','LeftHandSupportSocket']:rig.pose.bones[n].matrix=frames[f][n]
  bpy.context.view_layer.update();names=['UpperArm_R','LowerArm_R','Hand_R','UpperArm_L','LowerArm_L','Hand_L','RightHandWeaponSocket','LeftHandSupportSocket'];local={n:rig.pose.bones[n].matrix_basis.copy() for n in names};rig.animation_data.action=action
  for n in names:
   loc,q,scale=local[n].decompose();b=rig.pose.bones[n]
   if n in previous and previous[n].dot(q)<0:q.negate()
   previous[n]=q.copy();b.location=loc;b.rotation_quaternion=q;b.scale=scale
   for field in ['location','rotation_quaternion','scale']:b.keyframe_insert(field,frame=f,group=n)
 rig.animation_data.action=None
 output.write_text(json.dumps({'skinVertexCounts':counts,'method':'actual LBS sleeve/armor vertices vs conservative weapon solids; 32 elbow positions x 8 forearm rolls per side/frame; global temporal path with large rotation penalty; original hand/socket world matrices preserved','frames':metrics},indent=2))
