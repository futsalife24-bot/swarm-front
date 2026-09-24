# HARROW v6 validation

Runtime GLB SHA256: `0f640a7552d08f410c44a57733a1b0be87ce937995e32f05f18e519429100985`.

The actual runtime GLB passed `scripts/check-harrow-asset.mjs`: 186 skinned primitives, 39 bones, shared binding/order, all 11 clips, finite bone matrices at 60 Hz and finite skinned vertices at 10 Hz. Every sampled pose stays above the local ground plane within 0.000001 m numerical tolerance. Grounded poses retain foot contact. Closed-loop clips match endpoints. Non-loop Takeoff/Dive/StaggerFall/Land are clamped by the game adapter.

The actual production TypeScript loader was bundled and executed against the GLB over local HTTP. Material batching produces 20 meshes without losing vertices or triangles (152,428 triangles). Native Three.js skin positions and the production palette differ by at most `5.79613831229261e-7` m over 11 clips and 5 selected frames per clip. The palette has 1,565 rows and 3,906,240 bytes. A production batch was created and disposed. Evidence: `dist-validation/harrow/asset.json`.

At Spin 1.8 s, world scale 0.65, both lowest wing points are at Y=0.013 m, X approximately ±3.825414 and Z=2.463891. Ground-contact horizontal radius is 4.550225 m. The largest wing horizontal radius is 8.654237 m, also reached by vertices below world Y=2 m. The authority should align the sweep radius with this visible envelope. Evidence: `dist-validation/harrow/v6/spin-radius.json`.

The actual exported red warheads form five distinct connected parts per wing; their tips were measured at Threat 2.0 s. The source has four corner barrels and a fifth center barrel with positive spacing. Full unscaled/game-scaled coordinates: `dist-validation/harrow/launchers.json`.

Four images of the final GLB were saved and visually inspected: `final-spin.png`, `final-flight.png`, `final-dive.png`, `final-fall.png` under `dist-validation/harrow/v6/`. `final-render.json` ties every image hash to the exact GLB hash. Spin keeps all four feet on the floor and lowers the outer wing feathers; Flight visibly tucks the feet; Dive points the body/head downward at 47 degrees; StaggerFall partially folds the wings with a restrained recoil. Spin and Flight have similar broad wing silhouettes, so planted versus tucked feet and actual sweep motion are the distinguishing cues. Spin contacts the floor with feather extremities, not with the missile launcher housings.

Blender 5.2.1 LTS was used. Saved source and reimported GLB passed bone/weight/root/joint checks on the pre-final candidate. The final candidate changes Dive pitch from 0.85 to 0.82 radians to remove a 3 cm jaw penetration and updates metadata. Final runtime geometry/palette tests above were run after this change. A repeated all-view verification/render exhausted available memory; no pass is claimed for that repeated run. Final four-view evidence was completed with fresh runtime imports and two CPU threads, preserving the three successfully saved views and separately completing the missing Fall view. All own Blender processes exited; no background validation server is required.

The main task owns actual game-state transitions, AI, collision, multiplayer, independent Chat review and release. Static model images and numeric skin checks are not substitutes for that gameplay validation.
