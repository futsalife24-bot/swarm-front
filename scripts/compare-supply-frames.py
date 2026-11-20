"""同条件で撮影した基準/移植画像の差を集計する。Pillow/NumPyは既存環境を使用。"""
from pathlib import Path
import json
from PIL import Image
import numpy as np

base = Path(__file__).resolve().parent.parent / "docs/evidence/supply-kakutei-20261111"
reference = base / "reference-stills"
ported = base / "ported-stills"
rows = []
for file in sorted(reference.glob("*.jpg")):
    target = ported / file.name
    if not target.exists():
        raise SystemExit(f"Missing: {file.name}")
    a = np.asarray(Image.open(file)).astype(np.int16)
    b = np.asarray(Image.open(target)).astype(np.int16)
    if a.shape != b.shape:
        raise SystemExit(f"Size mismatch: {file.name}")
    diff = np.abs(a - b)
    rows.append({"file": file.name, "meanAbsolute": round(float(diff.mean()), 5),
                 "changedPixels": int(np.any(diff > 3, axis=2).sum()), "max": int(diff.max())})
if len(rows) != 57:
    raise SystemExit(f"Expected 57 frames, found {len(rows)}")
report = {"count": len(rows), "exact": sum(r["max"] == 0 for r in rows), "frames": rows}
(base / "fidelity-diff.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({"count": len(rows), "exact": report["exact"],
                  "worstMeanAbsolute": max(r["meanAbsolute"] for r in rows)}))
