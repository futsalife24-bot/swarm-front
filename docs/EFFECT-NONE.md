# 特殊効果なしの表示修正（2026-09-12・公開済み）

現行仕様: 特殊効果なしは「ー」の文字だけ。ボタン・説明アイコン・フォーカス対象にしない。出撃準備の特殊効果セルを押しても装備変更しない。旧quick（装填20%短縮）は装填性能として表示し、特殊効果には数えない。旧shotgun/pierceも武器の標準性能なので「ー」。貫通（ライフル）・残弾装填・撃退散弾・誘爆弾頭は説明ボタンを維持。

変更: src/shared/defs.tsのisSpecialEffect/effectLabel、src/client/weapon-help.tsの共通表示とイベント、src/main.tsの出撃準備セル操作。保存形式・既存の装填時間・抽選・戦闘計算は変更なし。defs.tsの0.5表記は書式整形のみ。

branch: codex/home-armory。base/head: 4186f25f7c9695f95ea897ad182db5f85fac3091。今回コミットなし。開始前から多数の未コミット・未追跡変更あり、維持。今回のソース差分: dist-validation/effect-none/change.patch。

検証成功: typecheck、client build、production Worker dry-run（制限付き実行はアクセスエラー、権限付き再実行で成功）。scripts/check-effect-none.mjsで1280×582/915×412の8武器（none・quick2種・旧shotgun/pierce・現行4効果）を確認。「ー」の非ボタン化・タップ後保存不変・ダイアログなし・旧quickの装填1.68秒維持・現行4説明・通常装備変更・武器庫詳細の「ー」が成功。scripts/check-weapon-row.mjsで4サイズのセル整列・非重複・横はみ出し0・装備変更成功。

証拠: dist-validation/effect-none/local.json、local-1280.png、local-915.png、dist-validation/weapon-row/local.json。横画面画像も目視確認。既存weapon-help E2Eは完了結果を返さず停止したため合格扱いしない。上記配布版専用チェックは成功。実スマホ未検証。

公開: 自動承認レビューが既存Workerへのdeployを「明示的な公開承認を確認できない」と拒否。AGENTS.mdの公開既定を提示したが、今回の公開は未実施。ユーザーの明示的な公開承認後、既存Workerへ公開し、公開版の同チェック・JS/CSS一致・healthを確認する。

## 公開完了
ユーザーの「はい」で明示承認を取得し、既存Workerへ公開。Version: 38b710d4-ab11-4336-a389-ba134ead49d0。URL: https://swarm-front.melosalife-24.workers.dev 。公開版でも効果確認2サイズ・1行配置4サイズ・装備変更・JS/CSSのSHA256一致・health ok:trueが成功。証拠: dist-validation/effect-none/published.json と dist-validation/weapon-row/published.json、同フォルダ画像。制限付き実行はネットワーク拒否、権限付き再実行で成功。

