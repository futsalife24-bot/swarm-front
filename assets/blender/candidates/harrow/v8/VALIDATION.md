# HARROW v8 validation

Final GLB SHA256: `c9a8e1c0ce27bd74a2f756cb688e055d64eab3561a9d2265b3e1d83ff5fda736`, 8,793,856 bytes. v7 and v6 are preserved. Final clip durations: Idle 7, Locomotion 4.2, Attack 5.25, Threat 7, AirThreat 7, Spin 6.3, Takeoff 3.5, Flight 4.2, Glide 2.1, Dive 0.9, StaggerFall 2.625, Land 1.75 seconds.

## Saved source and actual GLB

Blender 5.2.1 LTS opened the saved `.blend` in a separate process and reimported the saved GLB. Both versions passed all 12 clips at every 40 Hz authored frame: 39 bones, full vertex weighting, finite matrices, fixed Root, foot/leg joint continuity below 0.001 authored meters and closed endpoints for looping motions. Glide is deliberately a clamped transition, not a closed loop. Logs: `dist-validation/harrow-v8/saved-validation.{json,log}`.

Three.js GLTFLoader / AnimationMixer verified all 186 skinned primitives, shared binding/bone order, finite bones at 60 Hz and all skinned vertices at 10 Hz. Grounded/local-ground-reaching clips clear the origin plane within 0.000002 m of numeric rounding. In Flight and AirThreat, downward wing tips extend below the origin but remain 30.175019 m and 29.846694 m above terrain after applying the real 34.5 m airborne elevation. This is an intentional airborne silhouette, not a grounded penetration. `asset.json` records both local minimum and world ground clearance. Ground Threat and Land retain v7 geometry and contact.

World-space walk validation at scale 1.95 and actual speed 0.64 m/s retains 480 planted-foot intervals with maximum sampled slip 0.0000018 m. Spin still plants both wing extremities at Y=0.039 m, maximum low-wing horizontal radius below Y=2 m is 21.192798 m. Evidence: `kinematics.json`.

## Measured airborne silhouette and collision core

All coordinates below use the game Y-up / forward -Z frame, scale 1.95, neutral heading and are relative to the enemy origin. Bounds are unions of every actual skinned vertex sampled at 10 Hz over the full clip.

| Clip | Whole minimum XYZ | Whole maximum XYZ |
|---|---|---|
| Flight | -24.294292, -4.324981, -5.829845 | 24.294297, 20.753796, 19.486715 |
| AirThreat | -24.538598, -4.653306, -5.775448 | 24.538602, 20.753796, 19.483789 |

Flight center is `[0,8.214407,6.828435]`, size `[48.588589,25.078777,25.316560]`. At origin altitude 34.5, its visible top reaches 55.253796 m and its lowest wing 30.175019 m above terrain.

Body-core measurement selects vertices of the continuous torso/neck mesh whose Torso bone weight is at least 0.95. It excludes neck, wings, limbs, tail and shoulder components. Flight core min `[-1.335323,6.274746,-2.866728]`, max `[1.335323,11.575949,1.924910]`, center `[0,8.925347,-0.470909]`. AirThreat core center `[0,8.978697,-0.471038]`, max Y `11.682649`. Every measured core vertex is inside the existing body sphere centered at `[0,8.19,0]` with radius 6.63 m; maximum distance is 3.816897 m. This proves core coverage, not whole-body or wing hitboxes.

## Missile positions

Both ground and airborne clips retain five separate warheads per wing. Ground Threat uses the measured v7 launch positions. At AirThreat 3.5 s, the **unscaled** game-axis left tips are:

```text
[-6.353930, 7.861266,  0.264011]
[-6.743596, 7.705794, -0.212991]
[-6.856803, 8.099505,  0.597161]
[-7.246469, 7.944033,  0.120159]
[-6.800200, 7.902649,  0.192085]
```

Right tips mirror X within 0.000003 m. Multiply by scale 1.95 and apply the authority's enemy heading/origin once. Full measurements: `launchers.json`, `air-launchers.json`.

## Visual evidence and limits

The final GLB is freshly imported and rendered in CPU Cycles with two threads, 800×600 images. The eight selected poses cover upright Flight upper/lower beat, AirThreat launch preparation, the mid-Glide convergence, Dive endpoint, Spin, StaggerFall and walk. `final-render.json` binds the actual GLB SHA and each image SHA. Airborne views move the evidence floor down by the equivalent of 34.5 game meters so long downstroke feathers are not cut by a fictitious origin-plane floor; grounded views retain the local floor. These are pose renders, not video playback or performance tests.

All eight final images were opened and visually inspected. The image helper now sets 40 fps **before** importing the GLB and asserts every selected action's duration against the build report, fixing inherited post-import fps timing. The final images were rerendered after this correction; earlier probe/pre-fps reports are exploratory records, not final evidence. Upright fore/hind-leg separation, the wide upper/lower beats and the body folding at Glide midpoint are visible. Grounded contact and the low Spin wing posture remain visible without detached limbs or apparent plane penetration.

The parent integration owns the actual GPU palette, state transition blending, runtime collision/origins, encounter movie, real-browser animation verification, independent review and publication. No standalone video or smartphone-performance pass is claimed by this candidate report.
