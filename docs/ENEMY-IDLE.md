# 全7体の待機モーション — 2026-09-14

ユーザーの「全モンスターの停止モーションにもっと動き。PRISMは浮遊板が回る」という依頼に対応。形状・材質・戦闘性能・移動/攻撃クリップ・当たり判定は変更せず、現在のリグから6秒周期のIdleを生成し、既存GPUパレットへ一度だけ焼く。GLBそのものは変更なし。

|対象|待機動作|
|---|---|
|PLEAT|足先固定の小さな屈伸、胸部と脇の襞の開閉、前後の外被の揺れ|
|HOUND / VOLLEY|脚を曲げる体重移動、時間差で上下/回転する背板、リングの首振り|
|HOUND / LEAPER|VOLLEYより深い屈伸、背板とリングの揺れ|
|PRISM|8枚の浮遊板が6秒で本体を周回。板同士の配列を保ち、小さな上下動を追加|
|RAY|左右のひれのうねり、3本の尾に先端へ進む波|
|FOUNDRY ZERO|脚を据えたまま左右の上部アームを異なる位相で振る|
|FOUNDRY ZERO 連結炉|各節の発射器と頭部器官の上下/左右の観測動作|

レポートはIdle中も再描画する。「停止」ボタンを「待機を見る」に変更。試遊版レポートにも共通表示で適用。初会敵は既存の対象1体だけを動かす仕組みを使う。録画済み会敵MP4は今回の対象外で、旧映像のまま。

## 実装・監査

- `src/client/enemy-idle-clip.ts`: 各種Idle生成と、地上3種の足先を固定する二関節IK。骨長・スケールを保持。
- `src/client/hound-motion.ts`: Idle差し替え。既存アセットの移動/攻撃はそのまま。
- `src/client/enemy-viewer.ts`: 待機中の再生、連結炉の独立観測再生と切替時の解除。
- `src/client/foundry-worm.ts`: 観測動作の振幅を拡張し上下動を追加。World/歩行時刻は進めない。
- `src/client/bestiary.ts`: 待機ボタン/再生状態の文言。
- `scripts/check-enemy-idle.mjs`, `scripts/check-enemy-idle-release.mjs`: 数値/画面確認。

branch `codex/home-armory`、base/head `4186f25f7c9695f95ea897ad182db5f85fac3091`。未コミット・未追跡変更あり、既存差分を保持、commit/mergeなし。開始時コピー/ハッシュは `dist-validation/enemy-idle/before/` と `before-hashes.json`。今回の差分は `changes.patch`。

## 検証

- 型チェック、関連14テスト、通常/Pages build、Worker production dry-run成功。既存の500KB bundle警告あり。dry-runはsandboxの親ディレクトリ読取制約で初回失敗し、承認された権限で成功。
- 全6スキンモデルの1ループ61時点で全頂点が有限。最低Yは地上3種で約-0.00000021m（丸め誤差）、PRISM 0.115m、RAY 0.263m、通常炉0m。足先の最大ずれ0.00000018m未満、周期端の位置/回転誤差0.00000001未満。
- 全7体×844x390/1280x720の初会敵でWorld・他個体・カメラを停止、対象だけ再生、スキップ後の復帰を確認。`dist-validation/encounter-idle/checks.json`。
- 通常版レポート6体で待機画面の変化、待機/移動/攻撃切替、全6体の画像を目視確認。`checks.json`, `numeric.json`, `*-a.png`, `*-b.png`。
- レポートを最初の全画面要求と同時に開くと、フルスクリーンがダイアログを覆う既存挙動を確認。タイトルを先にクリックして全画面化してからレポートを開く条件で検証。今回の変更対象外。
- 管理画面でFree/$0が現在のプランと確認。9/1–9/14のアカウント集計181リクエスト、147ms CPU、Worker1件。API契約照会は403だったため画面確認を使用。契約変更なし。

実スマホの性能/見た目受入と、ユーザーによる動きの好みの確認は未実施。

## 公開確認

公開Version `74b59121-cbdf-4a97-8990-497fbd59d44f`、既存URL https://swarm-front.melosalife-24.workers.dev/ へ反映済み。
ローカル/公開版それぞれ全7体×2寸法の待機の画面変化、移動/攻撃/待機の切替、閉じて再度開く操作が成功。`local-release.json` / `published-release.json`。連結炉も目視確認。公開11ファイルのSHA256がビルド成果物と一致、health成功。
公開版の初会敵freeze/bars/zoom/text順、待機中HUD停止、スキップ後の戦闘復帰/一時停止も成功。`published-encounter.json`。
公開検証の初回はsandboxのネットワーク制限で失敗し、承認された権限で全項目完了。
