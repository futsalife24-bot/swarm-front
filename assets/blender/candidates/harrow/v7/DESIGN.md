# HARROW v7 — large, deliberate motion

User direction (2026-09-24): keep flight altitude and travel speed; make the displayed creature three times larger; make the legs, flapping and other motions larger and slower; restore the missing encounter movie. This candidate owns the editable model and motion. Runtime scale, authority timing, collision and the encounter sequence are integrated separately by the main task.

Base: main `413c9ea7b2a879f4797dcf71bbfd8d965e3fd35a`, branch `codex/harrow-presence-motion`. The complete v6 candidate is preserved. Its geometry, materials, 39-bone rig and eleven clip names are reused without a new reference generation or a different silhouette. Source geometry and reference image were copied into this isolated directory. Only `build_harrow.py` executes the geometry prefix before the old export tail; all outputs stay in this candidate or `dist-validation/harrow-v7/`.

## Motion and runtime contract

- Blender Z-up, forward -X; glTF Y-up with the existing game rotation Y=-PI/2. Root translation and heading stay fixed in every authored frame. Authority owns actual movement and altitude.
- Runtime scale changes from 0.65 to 1.95, exactly three times per axis. Geometry stays in authored units. The flight origin limit stays 34.5 m and travel speed stays 0.64 m/s.
- Every duration is multiplied by 1.75. Baking at 40 Hz puts all endpoint times on exact integer frames, including StaggerFall 2.625 seconds. Runtime sampling remains the game's responsibility.
- Locomotion is a 4.2-second in-place cycle at authored speed `0.64 / 1.95 = 0.3282051282051282 m/s`. The game must advance animation by `worldDistance / 0.64`. Full cycle world travel is 2.688 m, stance is 72% with a 1.93536 m world contact sweep, and the swing lifts each foot by up to 0.936 m. The torso lowers locally 0.30 authored meters to keep the long stride within the limb reach. Rigid claws remain level while the articulated upper joints solve to them.
- Flight's wing oscillation increases from 0.07 to 0.24 radians; the shoulder neutral changes from -0.48 to -0.36 to keep the broader downstroke clear of the origin plane. Wing fan motion, leg tuck, neck/head/tail motion, idle breathing and walk wing sway are increased. Threat retains its safe shoulder range while the terminal fan rotation increases from 0.23 to 0.30 radians. StaggerFall uses a larger recoil and a local torso lift so its tail stays above the plane.
- Spin lowers both wings using the same measured shoulder angle, 0.6624553302 radians, from 0–1.4 seconds. They remain down through 4.9, then recover by 6.3. The **authority** must perform exactly one horizontal revolution during 1.4–4.9; no second turn is baked in.
- Attack is retained as an unused legacy attack clip, with an anticipation peak at 1.4175 s and impact peak at 2.2575 s. Missile Threat reaches peak at 3.5 s. The enlarged/retimed source does not change missile count, damage, flight path or add another attack.

| Clip | Duration seconds | Playback |
|---|---:|---|
| Idle | 7 | Loop |
| Locomotion | 4.2 | Distance-driven loop |
| Attack | 5.25 | Closed endpoint, unused legacy attack |
| Threat | 7 | One action; missile tips measured at 3.5 |
| Spin | 6.3 | One action; authority turn 1.4–4.9 |
| Takeoff | 3.5 | Clamp |
| Flight | 4.2 | Loop |
| Glide | 2.1 | Hold/loop |
| Dive | 1.4 | Clamp |
| StaggerFall | 2.625 | Clamp |
| Land | 1.75 | Clamp |

The output retains 184 Blender meshes / 186 glTF material primitives, 39 bones and 152,428 triangles. GLB size 8,574,688 bytes versus v6's 8,053,036 bytes; the additional 521,652 bytes are motion samples and metadata. No texture resolution, geometry detail or per-frame skeleton size was added. GPU palette length increases with the longer clips; the main integration validates its current memory cost and renderer.

## Regeneration and evidence

From repository root, using the existing Blender 5.2.1 LTS installation in a separate process:

```powershell
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 2 --python-exit-code 1 --python assets/blender/candidates/harrow/v7/build_harrow.py
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 2 --python-exit-code 1 --python assets/blender/candidates/harrow/v7/verify_render.py -- --validate-only
node assets/blender/candidates/harrow/v7/verify_asset.mjs
node assets/blender/candidates/harrow/v7/verify_kinematics.mjs
node assets/blender/candidates/harrow/v7/verify_launchers.mjs
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 2 --python-exit-code 1 --python assets/blender/candidates/harrow/v7/render_final.py
```

Required local inputs are `geometry_source.py`, `unified_body.py`, `hound-part.json`, `prism-core.json` and `reference.jpg`. No random seed, network fetch or external generation is used. Blender backup files and `__pycache__` are not deliverables. The standalone render uses authored scale and origin elevation zero to expose local ground clearance; game size/altitude are checked in the integration preview. The parent task owns the real game playback/movie, independent Chat audit and release. Candidate validation is not final user visual approval.
