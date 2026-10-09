"""Check the actual GLB against runtime names, skin joints and animated channels."""
import json,struct,hashlib,math,sys
from pathlib import Path
p=Path(__file__).resolve().parent
p=next((Path(a.split('=',1)[1]) for a in sys.argv if a.startswith('--directory=')),p)
file=p/'swarm-soldier.glb';raw=file.read_bytes();length,kind=struct.unpack_from('<II',raw,12)
g=json.loads(raw[20:20+length]);tail=raw[20+length:]
# Read-only validation. Mesh names must already be distinct from joint names.
required=['Root','Pelvis','Spine','SpineMid','Chest','Neck','Head','RightHandWeaponSocket','LeftHandSupportSocket','BackWeaponSocket','BackWeaponSocket_2']
for side in ['L','R']:
 required += [n+'_'+side for n in ['Clavicle','UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot','Toe']]
 required += [f+str(i)+'_'+side for f in ['Thumb','Index','Middle','Ring','Little'] for i in [1,2,3]]
names=[n.get('name') for n in g['nodes']];joints={n for skin in g['skins'] for n in skin['joints']}
errors=[]
for name in required:
 if names.count(name)!=1:errors.append('Ambiguous/missing bone: '+name)
 elif names.index(name) not in joints:errors.append('Not a skin joint: '+name)
requiredClips=['Idle','Trial_Run','Trial_Run_Backward','Combat_Walk','Combat_Walk_Rocket','Trial_Run_Rocket','Trial_Run_Backward_Rocket','Trial_Dodge_Roll','Trial_Hit_Heavy','Trial_Switch_1_to_2','Trial_Switch_2_to_1','UAL_sprint','Down']
for profile in ['Rifle','Shotgun','Rocket']:
 requiredClips += [prefix+profile for prefix in ['Trial_Weapon_Idle_','Trial_Fire_','Trial_Reload_']]
for profile in ['Rifle','Shotgun']:requiredClips += ['Low_Ready_'+profile,'Aim_Raise_'+profile]
animations={a['name']:a for a in g['animations']}
for name in requiredClips:
 if name not in animations:errors.append('Missing clip: '+name);continue
 animated={names[c['target']['node']] for c in animations[name]['channels']}
 for bone in ['Pelvis','Spine','UpperArm_L','UpperArm_R','UpperLeg_L','UpperLeg_R']:
  if bone not in animated:errors.append(name+' missing animated '+bone)
if len(animations)!=len(g['animations']):errors.append('Duplicate clip names')
binary=tail[8:]
for animation in animations.values():
 for channel in animation['channels']:
  sampler=animation['samplers'][channel['sampler']]
  for key in ['input','output']:
   a=g['accessors'][sampler[key]];v=g['bufferViews'][a['bufferView']];width={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
   assert a['componentType']==5126
   offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',width*4)
   vals=[struct.unpack_from('<'+'f'*width,binary,offset+i*stride) for i in range(a['count'])]
   if any(not math.isfinite(x) for row in vals for x in row):errors.append(animation['name']+' invalid values')
   if key=='input' and any(b[0]<=a[0] for a,b in zip(vals,vals[1:])):errors.append(animation['name']+' unordered times')
out={'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'bytes':file.stat().st_size,'requiredBones':len(required),'clips':len(animations),'meshes':len(g['meshes']),'errors':errors,'scope':'Structural contract only; visual and gameplay validation remain required.'}
(p/'game-contract-check.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
if errors:raise SystemExit(1)
