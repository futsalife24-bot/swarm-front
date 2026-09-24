# HARROW v9 validation

Final candidate/runtime GLB SHA256: `637073973b04a78d19ea1a7d187b74ba5f2c597dc6ef1f4ae186bb29729192c7`, 8,804,176 bytes. Candidate `harrow.glb` and `public/assets/enemies/harrow_motion_v9.glb` are identical. The runtime URI uses revision `637073973b04a78d`. Spin duration is 3 seconds; all other durations are unchanged.

## Scope preservation

`verify_v8_unchanged.mjs` compares exact typed arrays against saved v8 SHA `c9a8e1c0ce27bd74a2f756cb688e055d64eab3561a9d2265b3e1d83ff5fda736`. All 186 skinned primitives, 744 geometry attribute arrays, indices, bind/world matrices, material properties and all 265,601 animation values across the eleven non-Spin clips match exactly. Track names, times, durations and counts also match. Evidence: `dist-validation/harrow-v9/v8-unchanged.json`. This validates reusing the existing Flight-only encounter movie; it does not mean a new movie was rendered.

## Native source and runtime reimport

Blender 5.2.1 LTS reopens the saved `.blend` in a separate process, then reimports the saved GLB. Both pass every authored frame of all twelve clips: 39 bones, no unweighted vertices, finite matrices and fixed Root. Spin has 121 frames at 40 fps, zero Root matrix error and zero endpoint error. Maximum foot/leg joint separation is 0.0000008861 authored m in the saved source and 0.0000008086 m after GLB reimport. Evidence: `saved-validation.json` and `saved-validation.log`.

## Ground sweep and collision coverage

Coordinates below use game axes, scale 1.95 and neutral heading. `verify_kinematics.mjs` skins every Spin vertex at all 121 authored frames. Both wings reach the floor clearance before rotation begins: at 1.15 s minimum Y is 0.048759 m left and 0.048752 m right. Low-wing reach below player height Y=2 m is 21.353582 m left and 21.446627 m right at that instant. Across the complete 1.15–2.20 s turning interval, the smaller low-wing reach never falls below 21.220320 m, preserving the 21.2 m physical sweep. The 28 m pressure radius is separately represented by the client effect.

Every Spin mesh vertex stays above the floor within 0.00000655 m of floating-point rounding. Alternating diagonal foot lifts leave a support pair down. The general 60 Hz bone / 10 Hz full-vertex pass finds maximum frame-minimum Y of only 0.0000003789 authored m, so the boss keeps ground contact throughout the action. The clip's Three.js endpoint matrix difference is below 0.000000573.

Torso-core vertices are selected from the continuous body mesh with Torso weight >=0.95, excluding neck, wings, legs and tail. Across the crouched Spin, the maximum distance from the existing body hit sphere center `[0,8.19,0]` is 6.508679 m, inside its 6.63 m radius. The stronger crouch therefore retains a hittable body without changing collision definitions. Evidence: `kinematics.json` and `asset.json`.

Existing walk support, Flight bounds, airborne body-core coverage and missile clips remain identical to v8. The unchanged-data comparison provides full preservation evidence in addition to the reused targeted kinematic checks.

## Runtime and visual evidence

`check_production.mjs` runs the real TypeScript `loadEnemyMotion` adapter against the final GLB over a local HTTP fixture, then compares sampled production matrix-palette skinning against independent Three.js AnimationMixer skinning for all twelve clips. Maximum vertex error is 0.000000632102 m, below the 0.0001 m threshold. Material batching preserves 152,428 triangles in 20 draw meshes; the palette has 2,924 rows / 7,298,304 bytes. Batch creation and disposal pass. Evidence: `asset.json` production section and `production.log`. This numerical production-palette check does not claim an actual GPU shader execution test.

`tests/harrow-model.test.ts` passes all four tests against the shipped v9 file. It covers authoritative clip durations, both airborne and grounded ten-missile origins, and actual skinned wing contact/reach at spin start/midpoint/end with fixed Root and visible torso preparation/recovery. Log: `model-tests.log`. The parent task owns the wider simulation/report/effect test suite.

Three final images were freshly rendered from the final GLB using CPU Cycles, 800×600, two threads, with 40 fps set before import. The external smoothstep authority yaw is explicitly applied: 0.95 s coil (0 degrees), 1.675 s mid-turn (180 degrees), 2.30 s brake (360 degrees). `final-render.json` binds each image SHA to the final GLB SHA. All three images were opened and inspected: raised asymmetric preparation, wide low fan sweep with a support pair, and the grounded brake pose are present without visible separated joints or floor penetration.

These are actual GLB pose renders, not a rendered video. Live product shader execution, pressure effects, combat playback, recording, audit and release remain the parent integration's responsibility.
