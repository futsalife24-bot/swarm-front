"""Validate the saved authoring file and persist its packed reference image."""
from pathlib import Path
import bpy,json
repo=Path(__file__).resolve().parents[3]
source=repo/'assets/blender/source/standard_trooper_v1.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
name='DESIGN_AUTHORITY_STANDARD_TROOPER'
if name not in bpy.data.images:
 image=bpy.data.images.load(str(repo.parent/'.codex-remote-attachments/01a089be-70b8-7a41-80ef-a98926a2facc/1726f471-8442-4353-b424-bd8c02ed2c3e/1-Photo-1.jpg'))
 image.name=name;image.pack();image.use_fake_user=True
 bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(source))
 bpy.ops.wm.open_mainfile(filepath=str(source))
assert bpy.data.images[name].packed_file
assert len(bpy.data.actions)==12
assert sum(o.type=='ARMATURE' for o in bpy.context.scene.objects)==1
assert all(not o.name.startswith(('Cube','Camera','Light')) for o in bpy.context.scene.objects)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
assert len(rig.data.bones)==24
report={'reopened_source':str(source),'packed_reference':True,'bones':24,'clips':12,'objects':[o.name for o in bpy.context.scene.objects],'materials':len(bpy.data.materials),'saved_source_valid':True}
(repo/'dist-validation/standard-trooper/source-validation.json').write_text(json.dumps(report,indent=2))
print('SOURCE_VALIDATION',json.dumps(report))
