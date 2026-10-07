"""固定SHAの開幕抽選変更を通常Chatへ渡す資料。秘密・依存キャッシュは含めない。"""
import hashlib
import json
import pathlib
import subprocess
import zipfile

BASE = "dd5c8d03bd3bafc8d2363e9e0b85e6ab2280e73c"


def git(*args):
    return subprocess.check_output(["git", *args])


head = git("rev-parse", "HEAD").decode().strip()
output = pathlib.Path(f"dist-validation/random-opening/audit-{head[:7]}.zip")
files = git("ls-tree", "-r", "--name-only", head).decode().splitlines()
selected = [p for p in files if p.startswith(("src/", "server/", "tests/", "e2e/", "public/rebuild/upgrades/", "docs/evidence/random-opening-20261007/")) or p in [
    "AGENTS.md", "package.json", "package-lock.json", "tsconfig.json", "tsconfig.worker.json",
    "vite.config.ts", "vitest.front.config.ts", "vitest.save.config.ts", "vitest.front-integration.config.ts",
    "playwright.front.config.ts", "wrangler.jsonc", "wrangler.production.jsonc", "wrangler.test.jsonc",
    "scripts/check-front-base.mjs", "scripts/automatic-changelog.mjs", "scripts/menu-motion-recorder.mjs",
    "docs/FRONT-RANDOM-OPENING.md", "docs/CAMPAIGN-SURVIVAL-LINK.md", "docs/BASE-DECKS-UIUX.md",
    "docs/BASE-DECKS-RELEASE.md", "docs/WEAPON-ROW.md", "docs/WORKFLOW.md",
    "docs/evidence/base-decks-release-20261007/public/base-checks.json",
]]
git("archive", "--format=zip", f"--output={output}", head, *selected)
with zipfile.ZipFile(output, "a", zipfile.ZIP_DEFLATED) as z:
    changed = git("diff", "--name-only", BASE, head).decode().splitlines()
    for path in changed:
        if git("ls-tree", BASE, "--", path):
            z.writestr("base/" + path, git("show", BASE + ":" + path))
    z.writestr("changes.patch", git("diff", "--binary", BASE, head))
    z.writestr("AUDIT.txt", f"BASE {BASE}\nHEAD {head}\n"
        "基地の開幕3系統指定を撤去し、選択したpoolから重複なしランダム3択に変更。\n"
        "仕様・Windows検証・未確認はdocs/FRONT-RANDOM-OPENING.md。\n"
        "ソースは対象HEADのgit archive。base/は変更ファイルの基点blob。\n"
        "現在のゲーム全体共通UIUX基準、ソロ/協力・旧規則・旧保存・再接続の整合を監査してください。\n"
        "今回全画面を再実行したとは主張しません。PR144の全体検査との区別を記録しています。\n"
        "対象SHA・合格/要修正・必須P0/P1/P2の箇所/再現・任意・検証限界を明記してください。\n"
        ".dev.vars、認証情報、依存キャッシュ、対象外の個人情報は含みません。\n")
    manifest = {n: hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith("/")}
    z.writestr("MANIFEST.json", json.dumps({"base": BASE, "head": head, "files": manifest}, ensure_ascii=False, indent=2))
with zipfile.ZipFile(output) as z:
    assert z.testzip() is None
print(json.dumps({"zip": str(output.resolve()), "head": head, "files": len(manifest), "bytes": output.stat().st_size, "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}, ensure_ascii=False))
