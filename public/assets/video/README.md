# In-game promotion video

`swarm-front-pv-v12.mp4` is the user-adopted Swarm Front PV v12 (2026-09-27), prepared for in-game playback. 30 seconds, 1920×1080, 24 fps, H.264/yuv420p with the original AAC audio copied without encoding. The edit, duration and audio are unchanged from the source; video uses a lower bitrate. v12 re-shoots the 120-enemy drone shot and the four-player shot, adds a full motion-graphics pass, replaces the frozen/black ending with an animated end card, and keeps the HARROW crossing at 27.0 seconds on the music hit.

Source retained at `スワフロ/pv/output/swarm_front_pv_v12_review.mp4`, with production notes in `pv/README-v11.md` and `pv/README-v12.md` (capture scripts, plate builder and the `mograph-v12` renderer).

- Source: 125,069,462 bytes; SHA256 `2d294004be05f70ffad5f7aecd48b2eda5fa0ad95e7e9087ae38791c70ed07f4`.
- Game asset: 13,855,793 bytes; SHA256 `d67bc134ce4b08dc242933ed7d40a8d2c2be8dd59ced35305fb58f4e297580bd`.

Reproduce with FFmpeg 7.1 (from the worktree):

```powershell
& '..\pv\edit\ffmpeg.exe' -i '..\pv\output\swarm_front_pv_v12_review.mp4' -c:v libx264 -preset medium -crf 24 -maxrate 4M -bufsize 8M -pix_fmt yuv420p -c:a copy -movflags +faststart public/assets/video/swarm-front-pv-v12.mp4
```

`swarm-front-pv-v10.mp4` (the previous PV, source `pv/output/swarm_front_pv_v10_review.mp4`, SHA256 `f833a37c1e21c6e6434596e22694a437700e010f75b4bb154d098c38a590325c`) is kept in place and is no longer referenced by the game.

The game requests the file only when the user opens the PV dialog. It loads one complete Blob for reliable native seeking on the existing static host, releases it when closed, and never autoplays on initial opening. No external embed, new service or account is required.
