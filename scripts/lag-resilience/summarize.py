"""最終画面試験の有限記録から、秘密・本文を含まない要点を保存する。"""
import hashlib
import json
from pathlib import Path

root = Path('dist-validation/lag-resilience-20261101/runs')
out = Path('docs/evidence/lag-resilience-20261101')
rows = []
for name in ['rate-burst', 'up-pause-once', 'down-pause', 'baseline']:
    path = root / (name + '-final') / 'trace.json'
    raw = path.read_bytes()
    result = json.loads(raw)
    assert not result.get('failure'), (name, result.get('failure'))
    assert not result['errors'], name
    trace = result['trace']
    fire = [e for e in trace['wsOut'] if e.get('fire')]
    assert fire, name
    close = [e for e in trace['events'] if e['type'] == 'ws-close']
    recovery = None
    after_fire = None
    if name == 'rate-burst':
        cut = next(e['at'] for e in close if e['code'] == 4008)
        recovery = round(min(e['at'] for e in trace['receipts'] if e['at'] > cut) - cut, 1)
        after_fire = len([e for e in fire if e['at'] > cut + 1000])
        assert after_fire > 0
        assert len(result['link']['connections']) == 2
    else:
        assert not close, (name, close)
    receipts = trace['receipts']
    gaps = sorted(b['at'] - a['at'] for a, b in zip(receipts, receipts[1:]))
    rows.append({
        'condition': name, 'tracePath': str(path), 'traceSha256': hashlib.sha256(raw).hexdigest(),
        'wallSeconds': result['wallSeconds'], 'endedEarly': result.get('endedEarly'),
        'pageErrors': len(result['errors']), 'connections': len(result['link']['connections']),
        'closeCodes': [e['code'] for e in close], 'firingInputs': len(fire),
        'recoveryToStateMs': recovery, 'firingInputsAfterRecovery': after_fire,
        'acceptedStates': len(receipts), 'allStateGapMaxMs': round(max(gaps), 1),
        'allStateGapP95Ms': round(gaps[int((len(gaps)-1)*.95)], 1),
        'finalWorld': trace['world'][-1],
        'timelineRows': len(result['diagnostics']['timeline']),
        'timelineOverwritten': result['diagnostics']['overwritten'],
    })
(out / 'browser-summary.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(rows, ensure_ascii=False, indent=2))
