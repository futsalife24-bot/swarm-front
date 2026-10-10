"""配信11本のPCMを順番どおり連結。台詞間に0.4秒の無音だけ追加。"""
import hashlib
import json
from pathlib import Path
import wave

root = Path(__file__).resolve().parent
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
chunks = []
rows = []
for clip in manifest["clips"]:
    path = root / "clips" / (clip["id"] + ".wav")
    with wave.open(str(path), "rb") as audio:
        assert (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) == (1, 2, 24000)
        pcm = audio.readframes(audio.getnframes())
    assert hashlib.sha256(path.read_bytes()).hexdigest() == clip["sha256"]
    if chunks:
        chunks.append(bytes(9600 * 2))
    chunks.append(pcm)
    rows.append({"id": clip["id"], "sha256": clip["sha256"], "seconds": clip["seconds"]})
output = root / "listening-review.wav"
with wave.open(str(output), "wb") as audio:
    audio.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
    audio.writeframes(b"".join(chunks))
result = {"note": "配信11本のPCM不変、台詞間0.4秒無音。原本ではなく実際の切り出し後を本人が照合するための連結", "clips": rows, "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "seconds": sum(c["seconds"] for c in rows) + 4}
(root / "listening-review.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"clips": len(rows), "seconds": result["seconds"], "sha256": result["sha256"]}))
