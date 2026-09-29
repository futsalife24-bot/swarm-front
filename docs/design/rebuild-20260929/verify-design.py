"""Check abstract draft-card counts; does not test the game implementation."""
from pathlib import Path
import json
import re


def inspect(families):
    unique = families * 3
    caps = (1,) * unique + (4, 4, 4)
    # Explore a superset of every reachable offer choice, merging equal builds.
    layer = set()
    for first in (range(3) if families == 1 else range(0, unique, 3)):
        initial = [0] * len(caps)
        initial[first] = 1
        layer.add(tuple(initial))
    states = 0
    transitions = 0
    minimum = len(caps)
    maximum_evolutions = 0
    for picks in range(1, 8):
        following = set()
        for build in layer:
            states += 1
            assert sum(build) == picks
            completed = sum(sum(build[i:i + 3]) == 3 for i in range(0, unique, 3))
            maximum_evolutions = max(maximum_evolutions, completed)
            if picks == 7:
                continue
            eligible = [i for i, cap in enumerate(caps) if build[i] < cap]
            guarantees = [i + build[i:i + 3].index(0)
                          for i in range(0, unique, 3) if sum(build[i:i + 3]) == 2]
            assert len(eligible) >= 3, (build, eligible)
            assert len(guarantees) <= 3 and set(guarantees) <= set(eligible)
            minimum = min(minimum, len(eligible))
            for candidate in eligible:
                changed = list(build)
                changed[candidate] += 1
                following.add(tuple(changed))
                transitions += 1
        layer = following
    assert maximum_evolutions == (1 if families == 1 else 2)
    return dict(families=families, states=states, transitions=transitions,
                minimum_eligible=minimum, maximum_evolutions=maximum_evolutions)


root = Path(__file__).parent
missing = []
for path in root.glob('*.md'):
    for link in re.findall(r'\]\(([^)]+)\)', path.read_text(encoding='utf-8-sig')):
        if not link.startswith(('https:', 'http:', '#')):
            target = link.split('#')[0]
            if target and not (path.parent / target).exists():
                missing.append(f'{path.name}: {target}')
assert not missing, missing
print(json.dumps({'status': 'PASS', 'checks': [inspect(1), inspect(3)],
                  'local_markdown_links': 'PASS',
                  'limits': 'Abstract candidate-count/guarantee feasibility only. No combat, UI, network, RNG distribution or fun validation.'},
                 ensure_ascii=False, indent=2))
