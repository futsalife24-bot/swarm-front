# In-game promotion video

`swarm-front-pv-v10.mp4` is the existing, user-requested Swarm Front PV v10, prepared for in-game playback. 30 seconds, 1920×1080, 24 fps, H.264/yuv420p with the original AAC audio copied without encoding. The edit, duration and audio are unchanged; video uses a lower bitrate.

Source retained at `スワフロ/pv/output/swarm_front_pv_v10_review.mp4`, with reproduction notes in `pv/README-v10.md` and `pv/edit/build-v10.py`.

- Source: 44,581,907 bytes; SHA256 `0ff5c8db2693b9e162ac83270ceee88a5377c93aa5a864d44af436cd8de50e25`.
- Game asset: 12,940,023 bytes; SHA256 `f833a37c1e21c6e6434596e22694a437700e010f75b4bb154d098c38a590325c`.

Reproduce with FFmpeg 7.1 (from the worktree):

```powershell
& '..\pv\edit\ffmpeg.exe' -i '..\pv\output\swarm_front_pv_v10_review.mp4' -c:v libx264 -preset medium -crf 24 -maxrate 4M -bufsize 8M -pix_fmt yuv420p -c:a copy -movflags +faststart public/assets/video/swarm-front-pv-v10.mp4
```

The game requests the file only when the user opens the PV dialog. It loads one complete Blob for reliable native seeking on the existing static host, releases it when closed, and never autoplays on initial opening. No external embed, new service or account is required.
