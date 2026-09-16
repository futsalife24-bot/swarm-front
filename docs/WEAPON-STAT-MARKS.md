# 武器の能力印の復元（2026-09-16）

旧形式の所持武器が個体差0扱いになり、能力の印が消えていた。表示用weaponStatVarianceで保存済みpower/rollsから復元し、共通武器一覧（装備固定行を含む）と詳細に適用。威力は戦闘で使用するpower、装填は短縮を正として算出。特殊効果は個体差へ加算しない。旧装弾も対象、新形式の装弾は固定・無印。保存/戦闘値は変更なし。共有画像は今回の対象外。

印は既存の基準（負:▼、0:なし、0超〜10:▲、10超〜20未満:二段▲、20以上:★）を継承。旧形式では20%以上も★。装備比較ではなく基礎値に対する個体補正を示す。

検証: typecheck、専用単体2件、通常/Pages build成功。scripts/check-gear-ui-baseline.mjs の4幅通常/整理チェック成功。scripts/check-weapon-stat-marks.mjs で844/1280×390の旧武器一覧・詳細の全5印一致、pageerror 0。844px画像目視済み。証拠 dist-validation/weapon-marks/ と dist-validation/gear-pinned/。実スマホ未確認。

base 7bf75c518f3607f44f9140116e89ebeca2c2e4e8、branch codex/restore-weapon-marks。独立監査・main反映・公開準備中。
