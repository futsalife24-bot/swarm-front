# Weapon / buddy isolated integration verification

Base and remote main observed: d9c5d280a7fcbe1023694ca1f5db48e509db7595.
Candidate: task-weapon-buddy-integration-20261107 / codex/weapon-buddy-integration-20261107.
Both source worktrees preserved. Source SHA256 manifest records the 52 copied files. No overlapping source paths, no merge conflict. No commit, push, merge, deployment, production WS, or user save access.

## Verified
- Client and Worker TypeScript passed.
- Related unit tests: 105 / 10 files passed.
- Production build passed; bundle-size warnings remain.
- Wrangler deploy --dry-run passed (508.09 KiB, gzip 130.18 KiB); not deployed.
- 568x320 real local survival launch/card/battle -> synthetic terminal result -> actual detail -> persisted lock/unlock -> home -> second launch/card/battle passed. errors empty, relaunched true. Detail and relaunched screenshots inspected visually.
- Integrated GLBs: 844x390 and 640x360 with 0/1/4 buddies rendered, Oriha Coil full loop rendered.
- Real local World.step buddySkill input for all four, with injured players: authoritative cast start/impact recorded; all four rendered visible with correct Palm/Display clip and matching skillPlaybackAt. Entries zero after clear; page errors empty. Four-cast screenshot visually inspected.
- First cast fixture incorrectly used full HP for Yosuga. Its correct full-HP rejection failed the assertion; test was corrected to injured players only. Product guard unchanged.
- Owned test browsers closed in finally. Dedicated Vite session1935 stopped via Ctrl+C. No other processes stopped.

## Limits
- Not an Android or real-network performance certification. Fixed-scene CPU submission timings are not FPS guarantees.
- Survival terminal time was fixture-driven, not a full-length battle. Daily and legacy-coop actual result-renderer fixtures previously passed in source candidate; real cloud admission / real WS entrance not exercised here.
- Disposal assertion proves zero BuddyVisuals entries, not a long-running GPU memory leak audit. Shader compiler uninitialized-variable warnings remain from existing renderer.
- Source weapon's 12-model and 5-rarity SG4 pixel checks passed previously; original empty SG4 image was not reproduced, historical cause not proven.
- Publication remains separate and requires a verified target and final authorization scope. These are uncommitted isolated candidate files only.
