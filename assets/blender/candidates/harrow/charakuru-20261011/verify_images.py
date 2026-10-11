"""方向画像のファイル検証。視覚的整合や3D品質は別途検証する。"""
from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parent
config = json.loads((root / 'images-config.json').read_text(encoding='utf-8'))
results = []
assert len(config['images']) == 8
assert len({i['slot'] for i in config['images']}) == 8
for item in config['images']:
    path = root / item['file']
    with Image.open(path) as im:
        im.load()
        assert im.format == 'PNG' and im.mode == 'RGBA'
        assert im.size == (1254, 1254)
        assert im.getchannel('A').getextrema() == (0, 255)
        assert item['prompt']
        results.append({'slot': item['slot'], 'file': item['file'],
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'size': im.size, 'alpha': im.getchannel('A').getextrema()})
report = {'count': len(results), 'images': results,
          'scope': 'PNG形式・寸法・実アルファ・実プロンプト存在。方向の厳密整合や3D品質の合格ではない。'}
(root / 'image-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('PNG検査8枚成功')
