"""Build the pre-rendered PixelFX atlas from the pinned upstream --sheet output.

Run from this project root after rendering the six effects listed below with
PixelFX tools/render.mjs --sheet --fps 12 --no-actor --bg none. Requires Pillow.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path("output/pixelfx-upstream/records")
OUT = Path("src/client/assets/pixelfx-battle.png")
# Fixed crops keep each effect centred and avoid wasting texture space.
ROWS = [
    ("impacts/hit-spark", [0, 0, 1, 2, 3, 4, 5, 6], (10, 10, 106, 78)),
    ("projectiles/muzzle-pistol", [0, 0, 1, 1, 2, 2, 3, 4], (12, 18, 92, 70)),
    ("explosions/small-explosion", [0, 1, 2, 3, 4, 5, 7, 9], (55, 55, 245, 230)),
    ("explosions/dirt-explosion", [0, 1, 2, 3, 4, 5, 7, 9], (40, 60, 220, 230)),
    ("spawn/spawn-portal", [1, 3, 5, 7, 9, 11, 14, 18], (40, 35, 168, 145)),
    ("nature/acid-splash", [4, 5, 6, 7, 8, 9, 10, 12], (35, 35, 149, 115)),
]

atlas = Image.new("RGBA", (1024, 768), (0, 0, 0, 0))
for row, (key, indices, crop) in enumerate(ROWS):
    name = key.split("/")[-1]
    info = json.loads((ROOT / key / f"{name}.json").read_text(encoding="utf-8"))
    sheet = Image.open(ROOT / key / f"{name}.png").convert("RGBA")
    for col, index in enumerate(indices):
        rect = info["frames"][index]["frame"]
        frame = sheet.crop((rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"]))
        frame = frame.crop(crop)
        if key == "nature/acid-splash":
            # Match the game's existing cyan acid cue.
            frame.putdata([(r // 3, g, max(g, b), a) for r, g, b, a in frame.getdata()])
        frame.thumbnail((128, 128), Image.Resampling.NEAREST)
        atlas.paste(frame, (128 * col + (128 - frame.width) // 2, 128 * row + (128 - frame.height) // 2))
OUT.parent.mkdir(parents=True, exist_ok=True)
atlas.save(OUT, optimize=True)
