"""HARROW v12の監査資料を、固定commitと明示した実画面証拠から作る。"""
from pathlib import Path
import hashlib
import json
import posixpath
import re
import subprocess
import zipfile

BASE = "9bdb1d29b8692ad62e7f7b46aa819c19bad55365"
HEAD = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
tracked = set(subprocess.check_output(["git", "ls-tree", "-r", "--name-only", HEAD], text=True).splitlines())
changed = subprocess.check_output(["git", "diff", "--name-only", BASE, HEAD], text=True).splitlines()

def content(path):
    return subprocess.check_output(["git", "show", f"{HEAD}:{path}"])

files = set(changed)
files.update([
    "AGENTS.md", "docs/WORKFLOW.md", "docs/STRUCTURE-ANOMALY-v2.md",
    "docs/art/ANOMALY_TASK_TEMPLATE.md", "docs/skills/swarm-front-audit-release/SKILL.md",
    "package.json", "package-lock.json", "tsconfig.json", "tsconfig.worker.json",
    "vite.config.ts", "vitest.config.ts", "wrangler.production.jsonc", "wrangler.test.jsonc",
    "src/client/render.ts", "src/style.css", "server/worker.ts",
    "scripts/harrow-encounter-server.mjs", "tests/harrow-weapons.test.ts", "tests/hound-motion.test.ts",
    "assets/blender/candidates/harrow/charakuru-20261011/harrow.blend",
    "assets/blender/candidates/harrow/charakuru-20261011/harrow.glb",
    "assets/blender/candidates/harrow/charakuru-20261011/rig-metadata.json",
    "scripts/harrow-encounter-live.js",
])
queue = list(files)
while queue:
    path = queue.pop()
    if not path.endswith((".ts", ".css", ".mjs")):
        continue
    source = content(path).decode("utf-8-sig")
    for rel in re.findall(r'(?:from\s*|import\s*\(?\s*)[\"\'](\.[^\"\']+)', source):
        stem = posixpath.normpath(posixpath.join(posixpath.dirname(path), rel))
        for candidate in (stem, stem + ".ts", stem + "/index.ts"):
            if candidate in tracked and candidate not in files:
                files.add(candidate)
                queue.append(candidate)
                break

payload = {path: content(path) for path in sorted(files)}
payload["DIFF.patch"] = subprocess.check_output(["git", "diff", BASE, HEAD, "--", "src", "server", "tests", "scripts", "docs"])
evidence = Path("dist-validation/harrow-v9")
names = [f"ui-v12-{mode}-cycle" for mode in ("walk", "dash", "snipe", "spin", "takeoff", "bomb", "dive", "missile", "ground-missile")]
names += ["ui-v12-spin-1-150", "ui-v12-snipe-2-100", "ui-v12-takeoff-1-600", "ui-v12-bomb-2-900", "ui-v12-dive-0-500"]
for name in names:
    media = evidence / (name + (".webm" if name.endswith("cycle") else ".png"))
    metadata = evidence / (name + ".json")
    for path in (media, metadata):
        payload["evidence/" + path.name] = path.read_bytes()
build = Path("dist-validation/harrow-v12/final-build.json")
if build.exists():
    payload["evidence/final-build.json"] = build.read_bytes()
payload["TARGET.json"] = json.dumps({
    "base": BASE, "target": HEAD,
    "scope": "HARROWの形状を維持した二脚モーション改善と本人指定7攻撃。地上ミサイルは山なり・直射の2種。",
    "entry": "docs/HARROW-BIPED-ATTACKS.md",
    "limits": "自己検証は独立監査ではない。動画はローカル実Rendererと共有戦闘処理での録画。通信は別途実Worker/2WebSocketで検証。実スマホ性能・長時間GPU・人による難度評価は未確認。",
}, ensure_ascii=False, indent=2).encode()
manifest = [{"path": p, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()} for p, b in sorted(payload.items())]
payload["MANIFEST.json"] = json.dumps(manifest, ensure_ascii=False, indent=2).encode()
out = Path("dist-validation/harrow-v12")
out.mkdir(parents=True, exist_ok=True)
archive = out / "harrow-v12-audit.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for p, b in payload.items():
        z.writestr(p, b)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for item in manifest:
        assert hashlib.sha256(z.read(item["path"])).hexdigest() == item["sha256"]
result = {"base": BASE, "target": HEAD, "files": len(payload), "bytes": archive.stat().st_size, "sha256": hashlib.sha256(archive.read_bytes()).hexdigest()}
(out / "package-result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result))
