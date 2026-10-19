# In-game promotion video

`swarm-front-pv-v13.mp4` is the user-approved Swarm Front PV v13 (v5 review edit, 2026-10-19), prepared for in-game playback. 30 seconds, 1920×1080, 48 fps, H.264/yuv420p with the v10 AAC audio copied without encoding (audio stream MD5 `5080c044b9092f7db2337fc459ddc270`, identical to v10). It replaced `swarm-front-pv-v10.mp4`, which remains in Git history.

The capture and edit tools are review-only and kept outside this repository (`MediaWork/2026-10-19-swarm-front-pv-v13`, branch `claude/pv-v13-20261019`); its `output/REVIEW.md` records every revision.

- Source: `swarm-front-pv-v13-v5.mp4`, 207,889,398 bytes; SHA256 `ddfc2321e665599d402b3d4d9ab2c10c05336e285cba8dd07e98d0b4039712fc`.
- Game asset: 13,070,271 bytes; SHA256 `cc36d92231f3928cda81a4d08780f223bcc3d6ecbcfda67f444a7502c580ef46`.

Reproduce with FFmpeg 9.0.1 (same settings as the v10 asset):

```powershell
ffmpeg -i swarm-front-pv-v13-v5.mp4 -c:v libx264 -preset medium -crf 24 -maxrate 4M -bufsize 8M -pix_fmt yuv420p -c:a copy -movflags +faststart public/assets/video/swarm-front-pv-v13.mp4
```

The game requests the file only when the user opens the PV dialog. It loads one complete Blob for reliable native seeking on the existing static host, releases it when closed, and never autoplays on initial opening. No external embed, new service or account is required.
