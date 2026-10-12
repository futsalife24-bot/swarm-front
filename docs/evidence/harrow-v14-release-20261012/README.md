# HARROW v14 羽ばたき修正の検証・公開記録

## 対象

本人の「地面に対して垂直、空気を下に押し出す羽ばたき」への修正。[PR173](https://github.com/futsalife24-bot/swarm-front/pull/173)。base `1e3b5428d7903ed25938d60dad78ecec9dc36602`、実装 `7d2076b14104caf5d1c627b54aa07167d0c4dd07`。再生成原本は `assets/blender/candidates/harrow/biped-v14/`、仕様は [HARROW-V14-FLAP](../../HARROW-V14-FLAP.md)。ローカル `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。

## 自己検証

- 関連5スイート122件、型検査、実装SHAからbuild/production dry-run合格（build.json）。
- GLB `0385b7c0198d47125a0779544726787c6076bc7213bd61382221eb0c6592d5ae`。39骨・18動作・元形状/ウェイト一致、保存blend別プロセス再読込、全骨接続境界、40発射口合格。
- 変更は離陸A–DとFlight。残り13クリップはv13と完全一致（clip-comparison.json）。
- 実翼外端/翼爪の代表下向き区間20組で、肩相対の鉛直変位が水平変位を上回る。全フレームの水平変位ゼロを意味しない。
- 実ゲーム描画で正面/側面を確認。`takeoff-side.png` と `flight-front.png` はv14のローカル実描画。録画範囲・目視確認範囲はui-review.json。
- 通信/戦闘コード・発射原点は無変更。今回通信試験は再実行せず。既存足滑り最大0.10833m、動画全フレーム目視、実スマホ、長時間GPU、本人の美術的採用は未解消/未確認。

## 独立監査・公開

[監査Chat](https://chatgpt.com/c/6acc6d2a-fae8-83ee-9950-2f70807c9693)で初回7d2076bと証拠訂正後 `95dbb8f73b08f073b359954c0dd1fa75bdaeca2a` がP0/P1/P2各0、技術merge/公開可。実検査の範囲と限界はaudit-result.json。初回の離陸側面4.4秒PNG/JSONは非同期保存による時刻誤記で撤回し、1.15秒の訂正版を再監査済み。本フォルダーのtakeoff-side.png/.jsonが訂正版。製品ソース/素材は7d2076bから不変をGitで確認。

PR173を通常merge。公開ソース `24f009e211515daa5011c4c473a1199b929b7696` からクライアントbuild/production dry-runを再実行して終了コード0（release-build.json）。既存Workerへ公開、Version `4c168f5c-f43e-4452-a8ba-9d12d7171ae2`。配信25/25ファイルSHA一致、health HTTP200/ok:true（delivery.json）。公開URL: https://swarm-front.melosalife-24.workers.dev/front 。

アプリ内ブラウザの新しい公開タブでHARROWを選択し、モデル描画・移動再生・離陸A選択と攻撃再生状態を確認。前回の公開確認タブとの同時保存ロックは、前回作成タブを閉じて標準の「このタブで再開」で解消。確認用ローカルサーバーは停止済み。本人の美術的採用は技術合格と分離して未確認。制作担当 `gpt-6-sol / medium`、主担当の実モデル/推論設定は未確認。
