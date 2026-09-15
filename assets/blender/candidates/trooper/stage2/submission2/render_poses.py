"""Reopen stage 2; diagnose static poses, never edit the original actions."""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
Q=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(Q/(sys.argv[sys.argv.index('--source')+1] if '--source' in sys.argv else 'trooper_stage2_fitted.blend')))
s=bpy.context.scene;rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='POSE'
for t in rig.animation_data.nla_tracks:t.mute=True
cam=s.camera;s.render.resolution_x=720;s.render.resolution_y=800;s.cycles.samples=24;cam.data.ortho_scale=2.35
weapons={k:bpy.data.objects['Weapon_'+k] for k in ['rifle','rocket','shotgun']}
armor=[o for o in bpy.data.collections['STAGE2_ARMOR'].objects if not o.name.startswith('Diagnostic')]
def reset():
 rig.animation_data.action=None
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 for o in weapons.values():o.hide_render=True
 bpy.context.view_layer.update()
def sample(name,frame):
 reset();rig.animation_data.action=bpy.data.actions[name];s.frame_set(frame);bpy.context.view_layer.update();rig.animation_data.action=None
 back_rest()
def back_rest():
 for n in ['BackWeaponSocket','BackWeaponSocket_2']:
  rig.pose.bones[n].matrix=rig.pose.bones['Chest'].matrix@rig.data.bones['Chest'].matrix_local.inverted()@rig.data.bones[n].matrix_local
 bpy.context.view_layer.update()
def arm_to(side,target,rotation,pole_point=None):
 names=['UpperArm_'+side,'LowerArm_'+side,'Hand_'+side];a=rig.pose.bones[names[0]].head.copy();old_elbow=rig.pose.bones[names[0]].tail.copy();l1=rig.data.bones[names[0]].length;l2=rig.data.bones[names[1]].length;d=target-a;dist=min(d.length,l1+l2-.0001);axis=d.normalized();along=(l1*l1-l2*l2+dist*dist)/(2*dist);height=math.sqrt(max(0,l1*l1-along*along));pole=old_elbow-a;pole=(pole-axis*pole.dot(axis)).normalized();k=a+axis*along+pole*height;end=a+axis*dist
 if pole_point is not None:
  pole=pole_point-a;pole=(pole-axis*pole.dot(axis)).normalized();k=a+axis*along+pole*height
 for n,p,q in [(names[0],a,k),(names[1],k,end)]:
  rest=rig.data.bones[n].matrix_local;mat=Matrix.Translation(p)@(rest.to_3x3()@Vector((0,1,0))).rotation_difference(q-p).to_matrix().to_4x4()@rest.to_3x3().to_4x4();rig.pose.bones[n].matrix=mat;bpy.context.view_layer.update()
 mat=rotation.to_matrix().to_4x4()@rig.data.bones[names[2]].matrix_local.to_3x3().to_4x4();mat.translation=end;rig.pose.bones[names[2]].matrix=mat;bpy.context.view_layer.update()
def static_grip(kind):
 gun=rig.pose.bones['RightHandWeaponSocket'].matrix.copy()
 if kind=='rocket':gun.translation=Vector((.31,.20,1.39))
 point=gun.translation
 arm_to('R',point+Vector((.071,0,.005)),Quaternion((0,0,1),math.pi/2))
 if kind=='rocket':arm_to('L',point+Vector((-.071,.28,.005)),Quaternion((0,0,1),-math.pi/2))
 else:arm_to('L',point+Vector((0,.20,-.052)),Quaternion((1,0,0),math.pi/2))
 rig.pose.bones['RightHandWeaponSocket'].matrix=gun
 for side,sign in [('L',-1),('R',1)]:
  for finger in ['Index','Middle','Ring','Little','Thumb']:
   for k in range(1,4):
    b=rig.pose.bones[f'{finger}{k}_{side}'];amount=.68 if finger=='Index' else .83;b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion((1,0,0),amount*.75 if finger=='Thumb' else amount)
    if finger=='Thumb' and k==1:b.rotation_quaternion=Quaternion((0,0,1),-sign*.45)@b.rotation_quaternion
 bpy.context.view_layer.update()

grasp_cache={}
def pistol_grasp(gun,side='R',pole_point=None,forward=0,kind='rifle'):
 # Stack index-to-little along the handle and wrap across its front face.
 sign=1 if side=='R' else -1
 R=Matrix(((0,sign,0),(0,0,-1),(-sign,0,0)))
 arm_to(side,gun@Vector((sign*.050,forward-.048,-.065)),gun.to_quaternion()@R.to_quaternion(),pole_point)
 for finger in ['Index','Middle','Ring','Little']:
  for k,angle in enumerate([.75,1.05,1.05],1):
   b=rig.pose.bones[f'{finger}{k}_{side}'];b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion((1,0,0),-angle)
 for k in range(1,4):
  b=rig.pose.bones[f'Thumb{k}_{side}'];b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion((1,0,0),-.4)
  if k==1:b.rotation_quaternion=Quaternion((0,0,1),sign*.65)@b.rotation_quaternion
 bpy.context.view_layer.update()
 key=(side,kind,forward)
 if key not in grasp_cache:
  solved={};inv=gun.inverted();step=[.15+i*.15 for i in range(10)]
  for finger in ['Index','Middle','Ring','Little']:
   bones=[rig.pose.bones[f'{finger}{k}_{side}'] for k in range(1,4)];root=inv@bones[0].head;lengths=[b.bone.length for b in bones];cy=forward if kind=='rocket' else -.014-math.tan(.24)*(root.z+.068);hy=.034 if kind=='rocket' else .0335/math.cos(.24);target=Vector((sign*(.010 if finger=='Little' else -.006),cy+hy+.009,root.z));best=(1e6,None)
   for a in step:
    for b in step:
     for c in step:
      x,y=root.x,root.y;points=[(x,y)];angle=0
      for length,da in zip(lengths,[a,b,c]):angle+=da;x-=sign*length*math.sin(angle);y+=length*math.cos(angle);points.append((x,y))
      score=(x-target.x)**2+(y-target.y)**2
      for (x0,y0),(x1,y1) in zip(points,points[1:]):
       for t in [.25,.5,.75,1]:
        xx=x0+(x1-x0)*t;yy=y0+(y1-y0)*t;dx=abs(xx)-(.026 if kind=='rocket' else .025);dy=abs(yy-cy)-hy;d=math.hypot(max(0,dx),max(0,dy)) if max(dx,dy)>0 else max(dx,dy);score+=25*max(0,.0075-d)**2
      if score<best[0]:best=(score,[a,b,c])
   solved[finger]=best[1]
  # Thumb opposition: local rotations only, fitted to the rear of the grip.
  bs=[rig.pose.bones[f'Thumb{k}_{side}'] for k in range(1,4)];base=inv@rig.pose.bones['Hand_'+side].matrix@rig.data.bones['Hand_'+side].matrix_local.inverted()@bs[0].bone.matrix_local;A=bs[0].bone.matrix_local.inverted()@bs[1].bone.matrix_local;B=bs[1].bone.matrix_local.inverted()@bs[2].bone.matrix_local;end=Vector((0,bs[2].bone.length,0));target=Vector((sign*.035,forward+(-.047 if kind=='rocket' else -.055),-.018));best=(1e6,None)
  vals=[-1.5+i*.15 for i in range(21)]
  for z in vals:
   for x in vals:
    m1=base@Quaternion((0,0,1),z).to_matrix().to_4x4()@Quaternion((1,0,0),x).to_matrix().to_4x4()
    for curl in [-1.2,-.9,-.6,-.3,0,.3,.6]:
     C=Quaternion((1,0,0),curl).to_matrix().to_4x4();m2=m1@A@C;m3=m2@B@C;tip=m3@end;score=(tip-target).length_squared
     for pt in [m2.translation,m3.translation,tip]:
      center=Vector((0,forward,-.045)) if kind=='rocket' else Vector((0,-.014,-.068));q=pt-center
      if kind!='rocket':q=Matrix.Rotation(-.24,3,'X')@q
      h=(.026,.034,.075) if kind=='rocket' else (.025,.0335,.0575);ds=[abs(a)-b for a,b in zip(q,h)];d=math.sqrt(sum(max(0,d)**2 for d in ds)) if max(ds)>0 else max(ds);score+=20*max(0,.008-d)**2
      if abs(pt.x)<.045 and pt.z>-.01:score+=10*(pt.z+.01)**2
      score+=15*max(0,-.023-pt.z)**2
     if score<best[0]:best=(score,[z,x,curl])
  solved['Thumb']=best[1];grasp_cache[key]=solved
 for finger in ['Index','Middle','Ring','Little']:
  for k,angle in enumerate(grasp_cache[key][finger],1):rig.pose.bones[f'{finger}{k}_{side}'].rotation_quaternion=Quaternion((1,0,0),-angle)
 z,x,curl=grasp_cache[key]['Thumb']
 rig.pose.bones['Thumb1_'+side].rotation_quaternion=Quaternion((0,0,1),z)@Quaternion((1,0,0),x)
 for k in [2,3]:rig.pose.bones[f'Thumb{k}_{side}'].rotation_quaternion=Quaternion((1,0,0),curl)
 bpy.context.view_layer.update()
def equip(held,stored):
 for kind,bn in [(held,'RightHandWeaponSocket'),(stored,'BackWeaponSocket_2' if stored=='rocket' else 'BackWeaponSocket')]:
  o=weapons[kind];o.hide_render=False;o.matrix_world=rig.matrix_world@rig.pose.bones[bn].matrix
def render(name,pos,target=(0,0,.97),scale=2.35):
 cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;s.render.filepath=str(Q/(name+'.png'));bpy.ops.render.render(write_still=True)
def main():
 reset()
 for name,pos in {'front':(0,6,1.04),'side':(-6,0,1.04),'back':(0,-6,1.04),'oblique':(-4,6,2.35)}.items():
  if '--quick' in sys.argv:continue
  cam.data.ortho_scale=2.14;render('armor_'+name,pos,scale=2.14)
 if '--standing-only' not in sys.argv:
  for label,clip,frame,held,stored in [('rifle','Weapon_Idle_Rifle',0,'rifle','rocket'),('launcher','Weapon_Idle_Rocket',0,'rocket','rifle'),('shotgun','Weapon_Idle_Shotgun',0,'shotgun','rocket')]:
   if '--quick' in sys.argv:continue
   sample(clip,frame)
   if label!='reach':static_grip(held)
   equip(held,stored)
   for view,pos in [('front',(3,6,2.8)),('back',(-4,-6,2.3)),('side',(6,0,1.4))]:render(label+'_'+view,pos)
   if label!='reach':
    grip_point=rig.pose.bones['RightHandWeaponSocket'].matrix.translation
    render(label+'_grip_right',grip_point+Vector((1,1,.25)),grip_point+Vector((.035,0,-.05)),.40)
    left_point=rig.pose.bones['Hand_L'].head
    render(label+'_grip_left',left_point+Vector((-1,1,.25)),left_point+Vector((0,.045,0)),.43)
  for label,n in [('reach_rifle','BackWeaponSocket'),('reach_rocket','BackWeaponSocket_2')]:
   sample('Weapon_Idle_Rifle',0);gun=rig.pose.bones[n].matrix.copy();target=gun@Vector((.071,0,.005))
   arm_to('R',target,gun.to_quaternion()@Quaternion((0,0,1),math.pi/2),Vector((.5,-.25,1.4)))
   for finger in ['Index','Middle','Ring','Little','Thumb']:
    for k in range(1,4):
     b=rig.pose.bones[f'{finger}{k}_R'];b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion((1,0,0),.6)
   bpy.context.view_layer.update()
   for kind,bn in [('rifle','BackWeaponSocket'),('rocket','BackWeaponSocket_2')]:
    o=weapons[kind];o.hide_render=False;o.matrix_world=rig.matrix_world@rig.pose.bones[bn].matrix
   render(label,(-4,-6,2.3));render(label+'_side',(6,0,1.7));render(label+'_close',target+Vector((0,-1,.35)),target,.68)
  reset()
  for side in ['L','R']:
   rig.pose.bones['LowerArm_'+side].rotation_mode='XYZ';rig.pose.bones['LowerArm_'+side].rotation_euler.x=math.radians(120)
   rig.pose.bones['LowerLeg_'+side].rotation_mode='XYZ';rig.pose.bones['LowerLeg_'+side].rotation_euler.x=math.radians(-120)
  bpy.context.view_layer.update()
  for variant,hidden in [('bare',True),('armored',False)]:
   for o in armor:o.hide_render=hidden
   render('flex120_'+variant,(-5,4,2.2))
  reset();sample('Dodge_Roll',0)
  rig.animation_data.action=None
  for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
  for name,angle in [('Spine',-.4),('SpineMid',-.45),('Chest',-.4),('UpperLeg_L',1.4),('UpperLeg_R',1.4),('LowerLeg_L',-2),('LowerLeg_R',-2),('UpperArm_L',.6),('UpperArm_R',.6),('LowerArm_L',1.7),('LowerArm_R',1.7)]:
   b=rig.pose.bones[name];b.rotation_mode='XYZ';b.rotation_euler.x=angle
  bpy.context.view_layer.update()
  for variant,hidden in [('bare',True),('armored',False)]:
   for o in armor:o.hide_render=hidden
   render('tuck_'+variant,(-5,4,2.2))
  back_rest()
  for kind,bn in [('rifle','BackWeaponSocket'),('rocket','BackWeaponSocket_2')]:
   o=weapons[kind];o.hide_render=False;o.matrix_world=rig.matrix_world@rig.pose.bones[bn].matrix
  render('tuck_back_weapons',(-4,-6,2.3));render('tuck_side_weapons',(6,0,1.5))

if __name__ == '__main__': main()
