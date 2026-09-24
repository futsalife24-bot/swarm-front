# HARROW v9 — planted, wound-up wing sweep

Spin-only revision of the saved v8 asset, based on main `a6973ed3197d305f67f1c426f08d41c97dc1539b`. The user requested a wider, faster attack with physical preparation and braking, referencing a creature which crouches, winds its body to one side, drives a full turn, then arrests its motion using its wings and legs.

## Authoritative motion contract

- Total action: 3.00 s. Preparation: 1.15 s. Exactly one external smoothstep turn: 1.15–2.20 s. Recovery: 2.20–3.00 s. Root translation and rotation remain fixed in the asset; the authority supplies the only full revolution.
- Scale 1.95, flight altitude 34.5 m and cruise speed 0.64 m/s remain unchanged. The other eleven clips, their durations and every mesh attribute are exactly the same as v8. The Flight-only encounter movie can continue to use the v8 export.
- The torso crouches and shifts weight laterally, winding approximately 20 degrees against the coming turn. One wing rises higher while the opposite wing gathers. The neck counterbends and the tail follows with staggered delays.
- Wing lowering has a separate release curve from torso unwinding. Both wings reach their floor clearance by 1.15 s, before the authoritative turn starts; the torso finishes unwinding during acceleration. Shoulders, elbows and wing fans articulate rather than rotating one frozen pose.
- During the turn the wing fans extend low and wide. Their floor is solved per pose from convex hulls of the actual rigid geometry. The 0.025 authored-meter wing clearance is 0.04875 m at runtime scale, avoiding penetration from numeric interpolation.
- Two diagonal foot pairs alternate their lifting windows, leaving one pair on the floor. The final pair of brake steps, opposing torso shift, and delayed neck/tail recoil settle back into the exact original posture at 3.00 s.

The physical low-wing reach preserves at least 21.2 m throughout the turn. The separate client pressure effect extends to 28 m and is not a mesh-scaling change. Geometry, rig, materials and missile attachments are preserved.

## Reproduction and evidence

Use Blender 5.2.1 LTS at `C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe`. From the repository root:

```powershell
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 2 --python-exit-code 1 --python assets/blender/candidates/harrow/v9/build_harrow.py
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 2 --python-exit-code 1 --python assets/blender/candidates/harrow/v9/verify_render.py -- --validate-only
node assets/blender/candidates/harrow/v9/verify_v8_unchanged.mjs
node assets/blender/candidates/harrow/v9/verify_kinematics.mjs
node assets/blender/candidates/harrow/v9/check_production.mjs
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 2 --python-exit-code 1 --python assets/blender/candidates/harrow/v9/render_final.py -- --only spin-coil,spin-mid,spin-brake
```

All generation is isolated to this candidate and `dist-validation/harrow-v9/`. `geometry_source.py` and its dependencies are copied from v8; the former generator's legacy export tail is never executed. v8 and earlier candidates remain protected. `probe_wings.py` is a finite local study of wing articulation that produced the final fan angle; its output is exploratory, not final validation.

Candidate completion does not by itself certify the live game, actual GPU shader execution, video playback, mobile performance, independent audit or release. These belong to the parent integration task.
