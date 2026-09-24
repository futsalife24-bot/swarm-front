# HARROW v7 validation

Final GLB SHA256: `af5152de9e7be4ad4e4265d22a2fbe541e510eccc8f32fa274c406a016a75243`. 8,574,688 bytes. No v6 source or runtime asset was overwritten by this candidate workflow.

## Numeric checks

- `verify_render.py -- --validate-only`: opened the saved `.blend` in a separate Blender 5.2.1 LTS process, then removed the source scene's exported objects and reimported the saved GLB. Both versions passed all 11 clips at every authored frame (40 Hz): 39 bones, full vertex weights, finite transforms, fixed Root, foot-to-leg joint continuity below 0.001 authored meters, closed endpoints for loop clips. Source solver maximum error is 0.000007392 m.
- `verify_asset.mjs`: actual Three.js GLTFLoader / AnimationMixer, 186 skinned primitives, shared binding and bone order; finite bone matrices at 60 Hz and all skinned vertices at 10 Hz for all 11 clips. Lowest sampled coordinate is -0.000001468 authored meters, numerical noise. Every grounded clip has floor contact, and every loop's endpoint matrix error is below 0.0001. Evidence: `dist-validation/harrow-v7/asset.json` and `saved-validation.json`.
- `verify_kinematics.mjs`: added the real 0.64 m/s forward translation to the 4.2-second walk at scale 1.95. Across 480 planted-foot intervals, maximum world displacement per 1/40-second sample is 0.000001800 m. Rigid foot orientation is horizontal in source. Evidence: `kinematics.json`.
- At Spin 3.15 s / scale 1.95, both wing minima are Y=0.039 m; contact points approximately X=±11.47624, Z=7.39167. Maximum whole-wing horizontal radius is 25.962712 m; the actual low-wing envelope below world Y=2 m reaches 21.192798 m. The main integration uses the latter for standing-soldier collision; these two bounds are intentionally distinguished.
- `verify_launchers.mjs`: five physically separate red warheads per wing. At Threat 3.5 s, unscaled game-axis left tips are `[-5.619758,6.446827,-2.322260]`, `[-6.107112,6.085182,-2.509989]`, `[-6.006242,6.967652,-2.322260]`, `[-6.493595,6.606007,-2.509989]`, `[-6.056677,6.526417,-2.416125]`. Right tips mirror X within 0.00001 m. Evidence: `launchers.json`.
- Flight whole-cycle 10 Hz all-vertex world bounds at scale 1.95, relative to the unchanged enemy origin and neutral game heading: min `[-22.963633,0.650751,-11.249464]`, max `[22.963639,17.387714,16.839155]`, center `[0.000003,9.019232,2.794845]`. Dimensions 45.927272 × 16.736963 × 28.088620 m. Used to size the encounter camera; add the actual origin position and yaw in game.

## Visual checks and limits

Fresh final GLB imported into Blender, CPU Cycles render with two threads, 800×600 images. Spin, Flight upper beat, Dive and StaggerFall images were opened and inspected. Spin plants the four feet and lowers both feather extremities, Flight tucks the feet, Dive points the head down with the whole torso, and Fall has a larger recoil. No apparent part detachment or floor penetration is visible in these views. `dist-validation/harrow-v7/final-render.json` records the exact GLB and image hashes.

Additional `final-walk.png` and `final-flight-down.png` were opened and inspected: the walking pose has a high, forward-moving forefoot and a lower supporting torso, while the Flight pair shows a broad upper/lower wing beat without a foot or tail penetrating the plane. Runtime movie, actual game-state transition playback, collision, production GPU palette, smartphone performance, independent audit and release belong to the integration task; static renders do not certify those results. No standalone video playback pass is claimed here.
