# 武器の能力印の復元（2026-09-16）

旧形式の所持武器が個体差0扱いになり、能力の印が消えていた。表示用weaponStatVarianceで保存済みpower/rollsから復元し、共通武器一覧（装備固定行を含む）と詳細に適用。威力は戦闘で使用するpower、装填は短縮を正として算出。特殊効果は個体差へ加算しない。旧装弾も対象、新形式の装弾は固定・無印。保存/戦闘値は変更なし。共有画像は今回の対象外。

印は既存の基準（負:▼、0:なし、0超〜10:▲、10超〜20未満:二段▲、20以上:★）を継承。旧形式では20%以上も★。装備比較ではなく基礎値に対する個体補正を示す。

検証: typecheck、専用単体2件、通常/Pages build成功。scripts/check-gear-ui-baseline.mjs の4幅通常/整理チェック成功。scripts/check-weapon-stat-marks.mjs で844/1280×390の旧武器一覧・詳細の全5印一致、pageerror 0。844px画像目視済み。証拠 dist-validation/weapon-marks/ と dist-validation/gear-pinned/。実スマホ未確認。

base 7bf75c518f3607f44f9140116e89ebeca2c2e4e8、branch codex/restore-weapon-marks。独立監査・main反映・公開準備中。

## 独立監査

[PR #25](https://github.com/futsalife24-bot/swarm-front/pull/25)、[監査Chat](https://chatgpt.com/c/6aaa686f-d668-83ee-83e9-a00c76843c26)。対象5190f349cdcf4c4e38c50e22ea702c5df8cdbcbcは合格・必須指摘0件。変更3ソースのGit blob一致、旧武器補正の独立計算、一覧の固定/通常行・二段▲を確認。任意指摘の詳細表スクロール画像不足は844/1280pxの追加PNGを同Chatへ送信し補足済み。限界: 監査環境で依存取得タイムアウトのためtypecheck/build/Playwright再実行未実施、実スマホ・共有画像対象外。commit後build・production dry-runも実装側で成功。

## main反映・公開保留

PR #25通常merge済み。mainソース a0a0e8c4ada219bab2c67cb893c0078b61bc21e6。merge後build・production dry-run成功。
停止理由: 既存Workerへの本番deployを自動承認レビューが「今回の依頼に公開そのものの明示承認がない」と拒否。AGENTSの継続承認は確認済みだが拒否を迂回しない。公開コマンドは未実行、配信照合未実施。
再開条件: ユーザーが今回の能力印修正を既存Worker swarm-front.melosalife-24.workers.dev へ公開することを明示承認したら、同main実装を公開し、dist-validation/weapon-marks/verify-published.mjsでSHA/health照合・実ブラウザ確認・公開記録まで完了する。後続差分は記録のみ。
