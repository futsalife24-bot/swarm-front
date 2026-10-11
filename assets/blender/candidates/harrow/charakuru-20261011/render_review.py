"""Render saved candidate, never the in-memory build scene; optional clip/time/view."""
import bpy,sys,json
from pathlib import Path
P=Path(__file__).resolve().parent
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
bpy.ops.wm.open_mainfile(filepath=str(P/'harrow.blend'))
scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE')
scene.cycles.samples=12;scene.render.resolution_x=1200;scene.render.resolution_y=1000
samples=[('Rest',0,view) for view in ('front','side','hero','back')] if not args else [(args[0],float(args[1]),args[2])]
for clip,t,view in samples:
    if clip!='Rest':
        action=bpy.data.actions.get(clip);assert action,clip
        rig.animation_data.action=action
        if action.slots:rig.animation_data.action_slot=action.slots[0]
        frame=t*scene.render.fps;scene.frame_set(int(frame),subframe=frame-int(frame))
    scene.camera=bpy.data.objects[view];bpy.context.view_layer.update()
    scene.render.filepath=str(P/'review'/f'final-{clip}-{t:g}-{view}.png')
    bpy.ops.render.render(write_still=True)
print('REVIEW_SAVED',json.dumps(samples))
