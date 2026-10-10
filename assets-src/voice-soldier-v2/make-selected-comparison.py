"""採用済み3本を加工せず連結し、統一感を比較するための音声を作る。"""
import hashlib
import json
from pathlib import Path
import wave

root = Path(__file__).resolve().parent
ids = ['reload-take1.wav', 'warning-take2.wav', 'fire-take3.wav']
chunks = []
parts = []
offset = 0
for i, name in enumerate(ids):
    source = root / 'candidates' / name
    with wave.open(str(source), 'rb') as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 24000)
        data = w.readframes(w.getnframes())
        seconds = w.getnframes() / w.getframerate()
    parts.append(dict(file=name, startSeconds=offset, seconds=seconds,
                      sha256=hashlib.sha256(source.read_bytes()).hexdigest()))
    chunks.append(data)
    offset += seconds
    if i < len(ids) - 1:
        chunks.append(bytes(24000))  # 0.5秒の無音。原本の各サンプルは不変。
        offset += .5
target = root / 'candidates' / 'selected-three-comparison.wav'
with wave.open(str(target), 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(24000)
    w.writeframes(b''.join(chunks))
(root / 'selected-three-comparison.json').write_text(
    json.dumps(dict(order=ids, gapSeconds=.5, processing='原本PCM不変・無音連結のみ',
                    parts=parts, seconds=offset,
                    sha256=hashlib.sha256(target.read_bytes()).hexdigest()),
               ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(dict(file=str(target), seconds=offset), ensure_ascii=False))
