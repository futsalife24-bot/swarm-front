"""初回HARROW監査のP2修正を、同じChatへ渡す差分資料。"""
from pathlib import Path
import hashlib, json, subprocess, zipfile

base = "cc43615d1f0835360f8fa9d5edbf8ac81a97bd3d"
head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
changed = subprocess.check_output(["git", "diff", "--name-only", base, head], text=True).splitlines()
payload = {p: subprocess.check_output(["git", "show", f"{head}:{p}"]) for p in changed}
for p in ["src/shared/harrow.ts", "tests/harrow.test.ts", "assets/blender/candidates/harrow/biped-v12/review/network.json"]:
    payload[p] = subprocess.check_output(["git", "show", f"{head}:{p}"])
payload["DIFF.patch"] = subprocess.check_output(["git", "diff", base, head])
payload["TARGET.json"] = json.dumps({"base":base,"target":head,"scope":"初回監査P2-01/P2-02の修正。GLBと攻撃仕様は初回監査資料と同一。"},ensure_ascii=False,indent=2).encode()
manifest = [{"path":p,"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest()} for p,b in sorted(payload.items())]
payload["MANIFEST.json"] = json.dumps(manifest,ensure_ascii=False,indent=2).encode()
out=Path("dist-validation/harrow-v12");out.mkdir(parents=True,exist_ok=True)
archive=out/"harrow-v12-reaudit.zip"
with zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED) as z:
    for p,b in payload.items(): z.writestr(p,b)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for item in manifest: assert hashlib.sha256(z.read(item["path"])).hexdigest()==item["sha256"]
result={"base":base,"target":head,"files":len(payload),"bytes":archive.stat().st_size,"sha256":hashlib.sha256(archive.read_bytes()).hexdigest()}
(out/"reaudit-result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print(json.dumps(result))
