"""Stage 3 P3-01. Bake candidate switch poses; original 15 Actions untouched."""
import bpy,sys,math,json,importlib.util,numpy as np
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
Q=Path(__file__).resolve().parent;P=Q.parent/'stage2'
rocket_x=float(sys.argv[sys.argv.index('--rocket-x')+1]) if '--rocket-x' in sys.argv else .225
assert rocket_x in [.225,.275,.325,.375]
if rocket_x!=.225:assert (Q/'rocket-mount-trial-approval.md').exists()
OUT=(Q/(sys.argv[sys.argv.index('--out')+1] if '--out' in sys.argv else '.')).resolve();assert OUT.is_relative_to(Q);OUT.mkdir(parents=True,exist_ok=True)
if OUT!=Q:
 for script_name in ['build_switch.py','skin_clearance_solver.py','restore_axilla_weights.py']:(OUT/script_name).write_text((Q/script_name).read_text(),encoding='utf-8')
sys.argv.extend(['--source','trooper_stage2_refined.blend'])
sp=importlib.util.spec_from_file_location('stage2_poses',P/'render_poses.py');p=importlib.util.module_from_spec(sp);sp.loader.exec_module(p)
rig=p.rig;s=p.s
weights_spec=importlib.util.spec_from_file_location('axilla',Q/'restore_axilla_weights.py');weights_module=importlib.util.module_from_spec(weights_spec);weights_spec.loader.exec_module(weights_module);weights_module.apply(OUT/'axilla-weight-change.json')
weapon_cloud=None;previous_elbow=None;previous_elbow_left=None
motion_frame=None;elbow_options={'R':{},'L':{}}
assert (Q/'mount-change-approval.md').exists()
before={b.name:[list(r) for r in b.matrix_local] for b in rig.data.bones};old_parent=[list(r) for r in rig.data.bones['Chest'].matrix_local.inverted()@rig.data.bones['BackWeaponSocket'].matrix_local]
bpy.context.view_layer.objects.active=rig;rig.hide_set(False);rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT');b=rig.data.edit_bones['BackWeaponSocket'];m=Matrix.Translation(Vector((.005,-.300,1.37)))@Matrix.Rotation(-math.pi/2,4,'X');b.matrix=m;b.length=.1;bpy.ops.object.mode_set(mode='OBJECT')
assert all(before[b.name]==[list(r) for r in b.matrix_local] for b in rig.data.bones if b.name!='BackWeaponSocket')
rocket_before=rig.data.bones['BackWeaponSocket_2'].matrix_local.copy()
if rocket_x!=.225:
 bpy.ops.object.mode_set(mode='EDIT');b=rig.data.edit_bones['BackWeaponSocket_2'];length=b.length;m=b.matrix.copy();m.translation.x=rocket_x;b.matrix=m;b.length=length;bpy.ops.object.mode_set(mode='OBJECT')
 assert all(before[b.name]==[list(r) for r in b.matrix_local] for b in rig.data.bones if b.name not in ['BackWeaponSocket','BackWeaponSocket_2'])
 rocket_mount=bpy.data.objects['Trial_BackMount_Rocket'];rocket_mount.data=rocket_mount.data.copy();anchor=.225-.0325
 for v in rocket_mount.data.vertices:v.co.x=anchor+(v.co.x-anchor)*(1+(rocket_x-.225)/.065)
rocket_after=rig.data.bones['BackWeaponSocket_2'].matrix_local.copy();chest_inv=rig.data.bones['Chest'].matrix_local.inverted()
(OUT/'rocket-bind-comparison.json').write_text(json.dumps({'coordinateSpace':'armature local, meters','rocketX':rocket_x,'beforeArmature':[list(r) for r in rocket_before],'afterArmature':[list(r) for r in rocket_after],'beforeChestParent':[list(r) for r in chest_inv@rocket_before],'afterChestParent':[list(r) for r in chest_inv@rocket_after],'other56IncludingApprovedRiflePreserved':True,'mount':'outer end extended from fixed inner x=.1925; no weapon object translation offset'},indent=2))
mount=bpy.data.objects['Trial_BackMount_Rifle'];mount.data=mount.data.copy()
for v in mount.data.vertices:v.co.y=-.118+(v.co.y+.118)*1.5
(OUT/'approved-bind-change.json').write_text(json.dumps({'bone':'BackWeaponSocket','coordinateSpace':'armature local, meters','beforeArmature':before['BackWeaponSocket'],'afterArmature':[list(r) for r in rig.data.bones['BackWeaponSocket'].matrix_local],'beforeChestParent':old_parent,'afterChestParent':[list(r) for r in rig.data.bones['Chest'].matrix_local.inverted()@rig.data.bones['BackWeaponSocket'].matrix_local],'other56BindsUnchanged':True,'mount':'Trial_BackMount_Rifle depth extended 56mm toward rear from fixed front y=-.118m','weaponLocalOffset':'identity in Blender; runtime weapon GLB axis cancellation remains separate'},indent=2))
def stable_arm_to(side,target,rotation,pole_point=None):
 global previous_elbow,previous_elbow_left
 names=['UpperArm_'+side,'LowerArm_'+side,'Hand_'+side];a=rig.pose.bones[names[0]].head.copy();l1=rig.data.bones[names[0]].length;l2=rig.data.bones[names[1]].length;d=target-a;dist=min(d.length,l1+l2-.0001);axis=d.normalized();along=(l1*l1-l2*l2+dist*dist)/(2*dist);height=math.sqrt(max(0,l1*l1-along*along));pole=(Vector(pole_point) if pole_point is not None else Vector((.55 if side=='R' else -.55,-.2,1.2)))-a;pole=(pole-axis*pole.dot(axis)).normalized();k=a+axis*along+pole*height;end=a+axis*dist;x=axis.cross(pole).normalized()
 if weapon_cloud is not None:
  ref=pole.copy();other=axis.cross(ref);best=(float('inf'),None,None);options=[]
  for i in range(64):
   angle=2*math.pi*i/64;radial=ref*math.cos(angle)+other*math.sin(angle);candidate=a+axis*along+radial*height;cost=0
   for u,v,r in [(a,candidate,.110),(candidate,end,.103)]:
    u=np.asarray(u);v=np.asarray(v);line=v-u;length2=float(np.dot(line,line));tseg=np.clip((weapon_cloud-u)@line/length2,0,1);near=u+tseg[:,None]*line;distance=np.linalg.norm(weapon_cloud-near,axis=1);radius=r*(1-(.65 if np.linalg.norm(v-np.asarray(end))<1e-5 else .15)*tseg)
    cost+=float(np.sum(np.maximum(0,radius-distance)**2))*250
   cost+=60*max(0,.22-(candidate.x if side=='R' else -candidate.x))**2
   options.append((cost,candidate.copy(),radial.copy(),axis.copy(),a.copy(),end.copy()))
   prior=previous_elbow if side=='R' else previous_elbow_left
   if prior is not None:cost+=(candidate-prior).length_squared*.12
   cost+=(candidate-k).length_squared*.015
   if cost<best[0]:best=(cost,candidate,radial)
  k=best[1];pole=best[2];x=axis.cross(pole).normalized()
  if side=='R':previous_elbow=k.copy()
  else:previous_elbow_left=k.copy()
  if motion_frame is not None:elbow_options[side][motion_frame]=options
 for n,start,finish in [(names[0],a,k),(names[1],k,end)]:
  y=(finish-start).normalized();z=x.cross(y).normalized();mat=Matrix((x,y,z)).transposed().to_4x4();mat.translation=start;rig.pose.bones[n].matrix=mat;bpy.context.view_layer.update()
 mat=rotation.to_matrix().to_4x4()@rig.data.bones[names[2]].matrix_local.to_3x3().to_4x4();mat.translation=end;rig.pose.bones[names[2]].matrix=mat;bpy.context.view_layer.update()
# Use a continuous elbow-plane frame instead of shortest rotation from rest,
# which becomes singular as the arm passes opposite its rest direction.
def smooth_elbows(action):
 selected={}
 for side in ['R','L']:
  opts=elbow_options[side];dp=np.array([x[0] for x in opts[0]]);parents={}
  for f in range(1,61):
   prev=np.array([tuple(x[1]) for x in opts[f-1]]);cur=np.array([tuple(x[1]) for x in opts[f]]);px=np.array([tuple(x[3].cross(x[2]).normalized()) for x in opts[f-1]]);cx=np.array([tuple(x[3].cross(x[2]).normalized()) for x in opts[f]]);distance=np.sum((prev[:,None,:]-cur[None,:,:])**2,axis=2);angle=1-np.clip(px@cx.T,-1,1);cost=dp[:,None]+distance*30+angle*3;parents[f]=np.argmin(cost,axis=0);dp=np.min(cost,axis=0)+np.array([x[0] for x in opts[f]])
  at=int(np.argmin(dp));chosen={60:at}
  for f in range(60,0,-1):at=int(parents[f][at]);chosen[f-1]=at
  selected[side]=chosen
 previous={};transport={}
 for f in range(61):
  rig.animation_data.action=action;s.frame_set(f);bpy.context.view_layer.update();hands={side:rig.pose.bones['Hand_'+side].matrix.copy() for side in ['R','L']};sockets={n:rig.pose.bones[n].matrix.copy() for n in ['RightHandWeaponSocket','LeftHandSupportSocket']};rig.animation_data.action=None
  for side in ['R','L']:
   _,k,pole,axis,a,end=elbow_options[side][f][selected[side][f]];x=axis.cross(pole).normalized()
   for n,start,finish in [('UpperArm_'+side,a,k),('LowerArm_'+side,k,end)]:
    y=(finish-start).normalized();qref=rig.data.bones[n].matrix_local.to_quaternion();reference_y=qref@Vector((0,1,0))
    if n.startswith('LowerArm') or reference_y.dot(y)<-.9995:qref=transport.get(n,reference_rotations[source][n]);reference_y=qref@Vector((0,1,0))
    rot=reference_y.rotation_difference(y)@qref;transport[n]=rot.copy();mat=rot.to_matrix().to_4x4();mat.translation=start;rig.pose.bones[n].matrix=mat;bpy.context.view_layer.update()
   rig.pose.bones['Hand_'+side].matrix=hands[side];bpy.context.view_layer.update()
  for n,m in sockets.items():rig.pose.bones[n].matrix=m
  bpy.context.view_layer.update();locals_out={n:rig.pose.bones[n].matrix_basis.copy() for n in ['UpperArm_R','LowerArm_R','Hand_R','UpperArm_L','LowerArm_L','Hand_L','RightHandWeaponSocket','LeftHandSupportSocket']};rig.animation_data.action=action
  for n in ['UpperArm_R','LowerArm_R','Hand_R','UpperArm_L','LowerArm_L','Hand_L','RightHandWeaponSocket','LeftHandSupportSocket']:
   b=rig.pose.bones[n];loc,rot,scale=locals_out[n].decompose()
   if n in previous and previous[n].dot(rot)<0:rot.negate()
   previous[n]=rot.copy();b.location=loc;b.rotation_quaternion=rot;b.scale=scale
   for data in ['location','rotation_quaternion','scale']:b.keyframe_insert(data,frame=f,group=n)
 rig.animation_data.action=None
def snapshot():return {b.name:b.matrix_basis.copy() for b in rig.pose.bones}
def restore(mats):
 for n,m in mats.items():rig.pose.bones[n].matrix_basis=m
 bpy.context.view_layer.update()
def mixmat(a,b,t):
 la,qa,sa=a.decompose();lb,qb,sb=b.decompose()
 if abs(qa.dot(qb))<1e-4:
  rel=qa.inverted()@qb;axis=Vector((rel.x,rel.y,rel.z)).normalized();first=next(i for i in range(3) if abs(axis[i])>.001)
  if axis[first]<0:axis=-axis
  rot=qa@Quaternion(axis,math.pi*t)
 else:rot=qa.slerp(qb,t)
 return Matrix.LocRotScale(la.lerp(lb,t),rot,sa.lerp(sb,t))
def smooth(t):return max(0,min(1,t))**2*(3-2*max(0,min(1,t)))
def M(pos,q):return Matrix.LocRotScale(Vector(pos),q,Vector((1,1,1)))
def path(keys,t):
 for (ta,a),(tb,b) in zip(keys,keys[1:]):
  if ta<=t<=tb:return mixmat(a,b,smooth((t-ta)/(tb-ta)))
 return keys[-1][1].copy()
held={};poses={};body={};support={};reference_rotations={}
for kind in ['rifle','rocket']:
 p.sample('Weapon_Idle_Rocket' if kind=='rocket' else 'Weapon_Idle_Rifle',0)
 if kind=='rifle':
  gun=rig.pose.bones['RightHandWeaponSocket'].matrix.copy();gun.translation.y+=.080
  # A mild bladed upper-body pose brings the support shoulder forward while
  # the butt meets the shooting shoulder. Back mounts follow the same chest.
  head_rotation=rig.pose.bones['Head'].matrix.to_quaternion();spine=rig.pose.bones['Spine'];pivot=spine.head.copy();spine.matrix=Matrix.Translation(pivot)@Matrix.Rotation(-.30,4,'Z')@Matrix.Translation(-pivot)@spine.matrix;bpy.context.view_layer.update()
  head=rig.pose.bones['Head'];head.matrix=Matrix.Translation(head.head)@head_rotation.to_matrix().to_4x4();bpy.context.view_layer.update();p.back_rest()
  rig.pose.bones['RightHandWeaponSocket'].matrix=gun;bpy.context.view_layer.update()
 body[kind]=snapshot();p.static_grip(kind);gun=rig.pose.bones['RightHandWeaponSocket'].matrix.copy()
 if kind=='rocket':gun.translation.z+=.020
 p.pistol_grasp(gun,kind=kind)
 if kind=='rocket':p.pistol_grasp(gun,side='L',forward=.28,kind=kind)
 rig.pose.bones['RightHandWeaponSocket'].matrix=gun;bpy.context.view_layer.update();held[kind]=gun;poses[kind]=snapshot();reference_rotations[kind]={n:rig.pose.bones[n].matrix.to_quaternion() for n in ['UpperArm_R','LowerArm_R','UpperArm_L','LowerArm_L']};support[kind]=(rig.pose.bones['Hand_L'].head.copy()+Vector((0,0,-.020 if kind=='rifle' else 0)),rig.pose.bones['Hand_L'].matrix.to_quaternion()@rig.data.bones['Hand_L'].matrix_local.to_quaternion().inverted())
# Solve both grip profiles in their reachable held pose before caching.
right_grip={k:{n:m for n,m in poses[k].items() if n.endswith('_R') and n.startswith(('Thumb','Index','Middle','Ring','Little'))} for k in poses}
p.arm_to=stable_arm_to
records=[];max_reach=0
cloud_local={k:np.array([tuple(v.co) for v in p.weapons[k].data.vertices],dtype=float) for k in held}
for source,dest,actionname in [('rifle','rocket','Trial_Switch_1_to_2'),('rocket','rifle','Trial_Switch_2_to_1')]:
 action=bpy.data.actions.new(actionname);action.use_fake_user=True;previous_rot={};previous_elbow=None;previous_elbow_left=None
 if source=='rocket':
  # Reverse the verified spatial path, with event-preserving time remapping.
  for f in range(61):
   u=f/60;forward=1-u/.45*.4 if u<=.45 else 1.05-u if u<=.60 else .45*(1-(u-.60)/.40);at=max(0,min(60,forward*60));rig.animation_data.action=bpy.data.actions['Trial_Switch_1_to_2'];s.frame_set(math.floor(at),subframe=at-math.floor(at));bpy.context.view_layer.update();rig.animation_data.action=None
   mats=snapshot();rig.animation_data.action=action
   for b in rig.pose.bones:
    loc,rot,scale=mats[b.name].decompose()
    if b.name in previous_rot and rot.dot(previous_rot[b.name])<0:rot.negate()
    previous_rot[b.name]=rot.copy();b.rotation_mode='QUATERNION';b.location=loc;b.rotation_quaternion=rot;b.scale=scale
    for data in ['location','rotation_quaternion','scale']:b.keyframe_insert(data,frame=f,group=b.name)
   rig.animation_data.action=None
   if f in [27,36]:
    wk=source if f==27 else dest;bn='BackWeaponSocket' if wk=='rifle' else 'BackWeaponSocket_2';delta=rig.pose.bones[bn].matrix.inverted()@rig.pose.bones['RightHandWeaponSocket'].matrix;records.append({'action':actionname,'frame':f,'sourceSeconds':f/60,'runtimeSeconds':f/120,'weapon':wk,'from':'RightHandWeaponSocket' if f==27 else bn,'to':bn if f==27 else 'RightHandWeaponSocket','sameTimePositionError':delta.translation.length,'sameTimeAngleErrorDegrees':math.degrees(delta.to_quaternion().angle)})
  for layer in action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for k in fc.keyframe_points:k.interpolation='LINEAR'
  track=rig.animation_data.nla_tracks.new();track.name=actionname;track.strips.new(actionname,0,action);track.mute=True
  continue
 gunkeys=[]
 for f in range(61):
  motion_frame=f;t=f/60;s.frame_set(f);rig.animation_data.action=None
  restore({n:mixmat(body[source][n],body[dest][n],smooth(t/.25)) for n in body[source]});p.back_rest()
  shrug=smooth(t/.28)*(1-smooth((t-.78)/.22));cl=rig.pose.bones['Clavicle_R'];pivot=cl.head.copy();cl.matrix=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-12)*shrug,4,'Z')@Matrix.Rotation(math.radians(-20)*shrug,4,'Y')@Matrix.Translation(-pivot)@cl.matrix;bpy.context.view_layer.update()
  racks={k:rig.pose.bones['BackWeaponSocket' if k=='rifle' else 'BackWeaponSocket_2'].matrix.copy() for k in held};old=racks[source];new=racks[dest];q=old.to_quaternion()
  def transit(rack,heldmat,weapon_kind):
   rx,ry,rz=rack.translation;rq=rack.to_quaternion()
   travel=rig.data.bones['BackWeaponSocket_2'].matrix_local.to_quaternion()
   if weapon_kind=='rocket':
    return [heldmat,M((.59,.30,1.42),heldmat.to_quaternion()),M((.72,-.04,1.43),Quaternion((0,0,1),-math.pi/2)),M((.44,-.43,1.43),travel),M((rx,-.43,rz),rq),rack]
   return [heldmat,M((.42,.40,1.36),heldmat.to_quaternion()),M((.63,-.04,1.43),travel),M((.44,-.39,1.43),travel),M((rx,-.39,rz),rq),rack]
  out=transit(old,held[source],source);inc=transit(new,held[dest],dest)
  def wrist_stage(pos,rot):return M(Vector(pos)-rot@Vector((.05,-.048,-.065)),rot)
  midq=mixmat(old,new,.5).to_quaternion()
  keys=list(zip([0,.10,.25,.36,.41,.45],out))+[(.49,wrist_stage((.14,-.38,1.45),old.to_quaternion())),(.525,wrist_stage((.39,-.36,1.47),midq)),(.56,wrist_stage((.385,-.17,1.44),new.to_quaternion())),(.60,new)]+list(zip([.65,.70,.80,.90,1.0],list(reversed(inc[:-1]))))
  keys.append((.05,M((.235,.44,1.34),held[source].to_quaternion())));keys.sort(key=lambda item:item[0])
  gun=path(keys,t);kind=source if t<.525 else dest
  clouds=[]
  for wk in [source,dest]:
   wm=gun if (wk==source and t<.45) or (wk==dest and t>=.60) else racks[wk];clouds.append(cloud_local[wk]@np.array(wm.to_3x3()).T+np.array(wm.translation))
  weapon_cloud=np.vstack(clouds)
  pole=Vector((.62,-.08,1.12))
  p.pistol_grasp(gun,kind=kind,pole_point=pole)
  desired=gun@Vector((.05,-.048,-.065));error=(rig.pose.bones['Hand_R'].head-desired).length;max_reach=max(max_reach,error)
  # Open after fixation, close before draw; finger transforms remain local.
  release=smooth((t-.45)/.035)*(1-smooth((t-.565)/.035))
  for n in right_grip[source]:
   m=mixmat(right_grip[source][n],right_grip[dest][n],smooth((t-.49)/.07));rig.pose.bones[n].matrix_basis=mixmat(m,Matrix.Identity(4),release*.88)
  # Supporting hand leaves early and returns only when weapon is in front.
  away=smooth(t/.10)*(1-smooth((t-.88)/.12));lpos,lrot=support[source if t<.5 else dest];target=lpos.lerp(Vector((-.34,.20,1.12)),away);rot=lrot.slerp(Quaternion((1,0,0),math.pi/2),away)
  p.arm_to('L',target,rot,Vector((-.55,.03,1.13)))
  for n in poses[source]:
   if n.endswith('_L') and n.startswith(('Thumb','Index','Middle','Ring','Little')):rig.pose.bones[n].matrix_basis=mixmat(mixmat(poses[source][n],poses[dest][n],smooth((t-.3)/.4)),Matrix.Identity(4),away*.70)
  rig.pose.bones['RightHandWeaponSocket'].matrix=gun;bpy.context.view_layer.update()
  # Normalize quaternion signs for linear per-frame interpolation.
  rig.animation_data.action=action
  for b in rig.pose.bones:
   mat=b.matrix_basis.copy();loc,rot,scale=mat.decompose()
   if b.name in previous_rot and rot.dot(previous_rot[b.name])<0:rot.negate()
   previous_rot[b.name]=rot.copy();b.rotation_mode='QUATERNION';b.location=loc;b.rotation_quaternion=rot;b.scale=scale
   for data in ['location','rotation_quaternion','scale']:b.keyframe_insert(data,frame=f,group=b.name)
  rig.animation_data.action=None
  if f in [27,36]:
   rack=old if f==27 else new;delta=rack.inverted()@gun;records.append({'action':actionname,'frame':f,'sourceSeconds':f/60,'runtimeSeconds':f/120,'weapon':source if f==27 else dest,'from':'RightHandWeaponSocket' if f==27 else ('BackWeaponSocket' if dest=='rifle' else 'BackWeaponSocket_2'),'to':('BackWeaponSocket' if source=='rifle' else 'BackWeaponSocket_2') if f==27 else 'RightHandWeaponSocket','sameTimePositionError':delta.translation.length,'sameTimeAngleErrorDegrees':math.degrees(delta.to_quaternion().angle)})
 smooth_elbows(action);motion_frame=None
 skin_spec=importlib.util.spec_from_file_location('skin_clearance',Q/'skin_clearance_solver.py');skin_module=importlib.util.module_from_spec(skin_spec);skin_spec.loader.exec_module(skin_module);skin_module.solve(rig,action,OUT/'skin-clearance-solver.json')
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
 track=rig.animation_data.nla_tracks.new();track.name=actionname;track.strips.new(actionname,0,action);track.mute=True
p.reset();restore(poses['rifle']);p.equip('rifle','rocket');s.frame_start=0;s.frame_end=60;s.render.fps=60
rig['stage3_switch_runtime_duration']=.5;rig['stage3_switch_events']='holster=.45; draw=.60; slots rifle=0,rocket=1'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'trooper_stage3_animated.blend'))
(OUT/'switch-events.json').write_text(json.dumps({'events':records,'maxRightWristIKError':max_reach,'sourceDuration':1,'runtimeDuration':.5,'fps':60,'originalActionsPreserved':True,'binding':'Rendered weapons use runtime-equivalent socket matrices by phase; object parent changes are not a glTF animation channel.'},indent=2))
print('SWITCH BAKE COMPLETE',max_reach,records)

