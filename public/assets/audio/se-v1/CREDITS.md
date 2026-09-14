# Swarm Front — SE v1 credits (2026-09-13)

26 edited/assembled sound effects. No BGM. 32 kHz mono PCM WAV; 866,104 bytes total.

## Recorded source material (CC0)

- The Free Firearm Sound Library — Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney.
  https://opengameart.org/content/the-free-firearm-sound-library
  https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z
  AR-15/D_32P.wav (near-distance single gunshot); Mossberg/N_26P.wav.
  Used for rifle.wav and shotgun.wav. Leading silence removed, tail shortened/faded, mono resampling, peak normalization.
- Gun reload sounds — SpringySpringo.
  https://opengameart.org/content/gun-reload-sounds
  assaultriflereload1_0.wav, shotguncock_0.wav.
  Used for reload, ready, switch, equip and revive; cut, layered and faded.
- Impact Sounds (1.0) — Kenney, https://kenney.nl/assets/impact-sounds
  footstep_carpet_000, footstep_concrete_000, impactMetal_medium_000,
  impactPlate_heavy_000, impactPunch_heavy_000, impactMetal_light_000.
  Used for impact, gear, dodge, menus, enemy mechanical attacks, and layers in explosions.
  Pitch/time editing, mono resampling, trimming, layering and normalization.

CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/
The source pages identify the above recordings as CC0. No account or purchase was needed.
The included manifest.json maps every finished clip to its source keys and SHA-256.

## Original sound design

Rocket exhaust, low-frequency explosion body, acid launch/sizzle, stake impulse,
laser discharge, charge, lunge and down textures were synthesized for this project,
with recorded mechanical/impact layers where listed in manifest.json.
These are sound designs, not recordings of actual rockets or fictional enemy weapons.
Reproduction: scripts/build-se.mjs with the original source files in dist-work/se-source.
Only the edited short clips ship with the game; the large source archive is not deployed.
