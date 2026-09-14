"""Retarget CC0 UAL lower body onto the untouched trooper bind skeleton.
Run in Blender 5.2: --background --factory-startup --python-exit-code 1 --python scripts/build-run-transfer.py -- jog
Source ZIP must be extracted in dist-work/run-transfer-20260913/source/unpacked.
Only new trial files are written. Runtime GLB geometry and original clips stay byte-identical.
"""
import bpy, math, json, struct, hashlib, copy, sys
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/blender/candidates/trooper/ual-run-20260913';OUT.mkdir(parents=True,exist_ok=True)
PRIVATE=ROOT/'dist-work/run-transfer-20260913'
SOURCE=PRIVATE/'source/unpacked/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb'
key=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'jog'
source_name={'jog':'Jog_Fwd_Loop','sprint':'Sprint_Loop'}[key]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/candidates/trooper/stance-v7/trooper_stance_v7.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['STANDARD_TROOPER_RIG'];fps=scene.render.fps
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=None
rest={b.name:b.matrix_local.copy() for b in rig.data.bones}
before=set(bpy.data.objects);before_actions=set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
src=next(o for o in bpy.data.objects if o not in before and o.type=='ARMATURE')
for o in bpy.data.objects:
 if o not in before and o!=src:o.hide_render=True;o.hide_set(True)
for track in src.animation_data.nla_tracks:track.mute=True
action=next(t.strips[0].action for t in src.animation_data.nla_tracks if t.name==source_name)
src.animation_data.action=action
sr={b.name:b.matrix_local.copy() for b in src.data.bones}
mapping={'Root':'root','Pelvis':'DEF-hips'}
for side in ['L','R']:
 for target,source in [('UpperLeg','thigh'),('LowerLeg','shin'),('Foot','foot'),('Toe','toe')]:mapping[target+'_'+side]='DEF-'+source+'.'+side
# Source is -Y forward/+X anatomical left, target +Y forward/-X left.
C=Matrix.Rotation(math.pi,4,'Z');YUP=Matrix.Rotation(-math.pi/2,4,'X')
scale=sum(rig.data.bones[n+'_L'].length for n in ['UpperLeg','LowerLeg'])/sum(src.data.bones['DEF-'+n+'.L'].length for n in ['thigh','shin'])
N=120;start,end=action.frame_range;duration=(end-start)/fps
samples=[]
for i in range(N+1):
 f=start+(end-start)*i/N;scene.frame_set(int(f),subframe=f-int(f));bpy.context.view_layer.update()
 samples.append({n:src.pose.bones[n].matrix.copy() for n in mapping.values()})
src.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
# Bind-space sole vertices: floor correction is based on actual unchanged boots.
sole={s:[] for s in ['L','R']}
for o in before:
 if o.type!='MESH' or o.hide_render:continue
 groups={g.index:g.name for g in o.vertex_groups}
 for v in o.data.vertices:
  for s in sole:
   if any(groups[g.group] in ['Foot_'+s,'Toe_'+s] and g.weight>.5 for g in v.groups):
    n=max(v.groups,key=lambda g:g.weight);bone=groups[n.group]
    if bone in ['Foot_'+s,'Toe_'+s]:sole[s].append((bone,rest[bone].inverted()@o.matrix_world@v.co))
def setm(n,m):
 rig.pose.bones[n].matrix=m;bpy.context.view_layer.update()
def solve(side,foot,knee_hint,footrot,toerot):
 hip=rig.pose.bones['UpperLeg_'+side].head.copy();a=rig.data.bones['UpperLeg_'+side].length;b=rig.data.bones['LowerLeg_'+side].length
 axis=foot-hip;d=min(axis.length,a+b-.00001);axis.normalize()
 along=(a*a-b*b+d*d)/(2*d);pole=knee_hint-hip;pole-=axis*pole.dot(axis)
 if pole.length<.0001:pole=Vector((0,1,0))
 pole.normalize();knee=hip+axis*along+pole*math.sqrt(max(0,a*a-along*along))
 for name,p,q in [('UpperLeg_'+side,hip,knee),('LowerLeg_'+side,knee,foot)]:
  r=rest[name].to_3x3();setm(name,Matrix.Translation(p)@(r@Vector((0,1,0))).rotation_difference(q-p).to_matrix().to_4x4()@r.to_4x4())
 setm('Foot_'+side,Matrix.Translation(foot)@footrot.to_matrix().to_4x4())
 toe=rig.pose.bones['Toe_'+side].head.copy();setm('Toe_'+side,Matrix.Translation(toe)@toerot.to_matrix().to_4x4())
out_action=bpy.data.actions.new('UAL_'+key);out_action.use_fake_user=True
poses=[];footpaths={s:[] for s in sole};soleheights={s:[] for s in sole};floor_lifts=[];prev={}
for i,sm in enumerate(samples):
 rig.animation_data.action=None
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 # Remove endpoint root drift only; retain cyclic hip sway/bounce.
 drift=samples[0]['DEF-hips'].translation.lerp(samples[-1]['DEF-hips'].translation,i/N)
 disp=C.to_3x3()@(sm['DEF-hips'].translation-sr['DEF-hips'].translation)*scale
 for axis in [0,1]:disp[axis]-=(C.to_3x3()@(drift-sr['DEF-hips'].translation)*scale)[axis]
 delta=C@sm['DEF-hips']@sr['DEF-hips'].inverted()@C.inverted()
 # Preserve authored weapon/aim orientation: transfer hip translation, but keep
 # the target pelvis orientation. Source lean would otherwise rotate the gun.
 pelvis=Matrix.Translation(rest['Pelvis'].translation+disp)@rest['Pelvis'].to_quaternion().to_matrix().to_4x4();setm('Pelvis',pelvis)
 for side in sole:
  sn='DEF-thigh.'+side;hip=rig.pose.bones['UpperLeg_'+side].head.copy()
  foot=hip+C.to_3x3()@(sm['DEF-foot.'+side].translation-sm[sn].translation)*scale
  knee=hip+C.to_3x3()@(sm['DEF-shin.'+side].translation-sm[sn].translation)*scale
  rotations=[]
  for target,source in [('Foot','foot'),('Toe','toe')]:
   n='DEF-'+source+'.'+side;rotations.append((C@sm[n]@sr[n].inverted()@C.inverted()).to_quaternion()@rest[target+'_'+side].to_quaternion())
  solve(side,foot,knee,*rotations)
 # Small global lift, preserving aerial frames and relative vertical motion.
 bottom=min((rig.pose.bones[n].matrix@v).z for points in sole.values() for n,v in points)
 lift=max(0,.002-bottom);floor_lifts.append(lift)
 if lift:
  m=rig.pose.bones['Pelvis'].matrix.copy();m.translation.z+=lift;setm('Pelvis',m)
 local={}
 for n in mapping:
  b=rig.pose.bones[n];m=b.parent.matrix.inverted()@b.matrix if b.parent else YUP@b.matrix
  p,q,s=m.decompose()
  if n in prev and q.dot(prev[n])<0:q.negate()
  prev[n]=q.copy();local[n]={'translation':list(p),'rotation':[q.x,q.y,q.z,q.w],'scale':list(s)}
 for side in sole:
  footpaths[side].append(list(rig.pose.bones['Foot_'+side].head))
  soleheights[side].append(min((rig.pose.bones[n].matrix@v).z for n,v in sole[side]))
 poses.append(local)
 basis={n:rig.pose.bones[n].matrix_basis.copy() for n in mapping};rig.animation_data.action=out_action
 for n,m in basis.items():
  b=rig.pose.bones[n];b.location,b.rotation_quaternion,b.scale=m.decompose();b.rotation_mode='QUATERNION'
  for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(prop,frame=i/N*duration*fps,group=n)
rig.animation_data.action=None
# Force exact loop closure (difference is reported, never silently counted as exact source).
loop_error=max(abs(a-b) for n in mapping for prop in poses[0][n] for a,b in zip(poses[0][n][prop],poses[-1][n][prop]))
poses[-1]=copy.deepcopy(poses[0])
# Calibrate using real boot contact, not ankle height (pitch changes ankle height).
vel=[]
for side,path in footpaths.items():
 for i in range(1,N):
  speed=-(path[i][1]-path[i-1][1])*N
  if soleheights[side][i]<.02 and soleheights[side][i-1]<.02:vel.append(speed)
assert vel,'No support-phase stride detected'
stride=sorted(vel)[len(vel)//2]
def readglb(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
doc,binary=readglb(ROOT/'public/assets/characters/standard_trooper_v7.glb');original=copy.deepcopy(doc);original_binary=binary
def accessor(values,size):
 global binary
 off=len(binary);flat=[v for row in values for v in row];data=struct.pack('<'+'f'*len(flat),*flat);binary+=data
 view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(data)})
 a={'bufferView':view,'componentType':5126,'count':len(values),'type':{1:'SCALAR',3:'VEC3',4:'VEC4'}[size]}
 if size==1:a.update(min=[min(flat)],max=[max(flat)])
 idx=len(doc['accessors']);doc['accessors'].append(a);return idx
times=accessor([[i/N*duration] for i in range(N+1)],1);animation={'name':'UAL_'+key,'channels':[],'samplers':[]}
ids={n.get('name'):i for i,n in enumerate(doc['nodes'])}
for name in mapping:
 for prop,size in [('translation',3),('rotation',4),('scale',3)]:
  index=accessor([p[name][prop] for p in poses],size);si=len(animation['samplers']);animation['samplers'].append({'input':times,'output':index,'interpolation':'LINEAR'});animation['channels'].append({'sampler':si,'target':{'node':ids[name],'path':prop}})
doc['animations'].append(animation);doc['buffers'][0]['byteLength']=len(binary)
for k in ['meshes','nodes','skins','materials','textures','images']:assert doc[k]==original[k]
assert doc['animations'][:-1]==original['animations'] and binary[:len(original_binary)]==original_binary
js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary+=b'\0'*((-len(binary))%4)
glb=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
(OUT/(key+'.glb')).write_bytes(glb)
# Source mannequin is retained only in private inspection; saved trial .blend contains target only.
for o in list(bpy.data.objects):
 if o not in before:bpy.data.objects.remove(o,do_unlink=True)
for a in list(bpy.data.actions):
 if a not in before_actions and a!=out_action:bpy.data.actions.remove(a)
for layer in out_action.layers:
 for strip in layer.strips:
  for bag in strip.channelbags:
   for fc in bag.fcurves:
    for k in fc.keyframe_points:k.interpolation='LINEAR'
rig.animation_data.action=out_action
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(key+'.blend')))
report={'key':key,'sourceClip':source_name,'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'blender':bpy.app.version_string,'mapping':mapping,'coordinateCorrection':'180 degrees around Z, source -Y to target +Y','legLengthScale':scale,'duration':duration,'stride':stride,'strideMethod':'median rearward ankle displacement per cycle while both adjacent boot-sole samples are below 2cm','playbackAt7mps':7*duration/stride,'maxFloorLift':max(floor_lifts),'loopEndpointAdjustmentMaxComponent':loop_error,'originalClipCount':len(original['animations']),'originalDataPreserved':True,'sha256':hashlib.sha256(glb).hexdigest(),'scope':'Lower body only; pelvis rotations suppressed to preserve aim; original upper body, backward, dodge, hit and reload retained'}
(OUT/(key+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
