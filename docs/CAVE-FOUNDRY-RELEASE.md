# 洞窟の連結炉増援の高度修正（2026-10-07）

## 今回の範囲

本人「公開までやって」で、[限定試験の2失敗](ADOPTED-MAP-SPAWNS.md)から製品修正・独立監査・main反映・既存Worker公開へ範囲を拡張した。branch `codex/adopted-map-spawns-20261007`、base `1c2f4ba44348ab95558ca0362f4f50a561e900d0`。正本 https://github.com/futsalife24-bot/swarm-front 、作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。

通常spawnの既存初期高度を `enemySpawnHeight` として抽出し、洞窟増援の候補判定と最終配置が同じ関数を使うようにした。hornetの洞窟上限5を保持し、判定半径は実個体サイズを使う。洞窟以外の増援の高度式・選択処理は保持。通常出現の式・抽選回数・増援数・接続節の数え方・キュー・保存・通信・戦闘性能・UI・素材は変更していない。

## Windowsでの検証

- 型チェック成功（client/shared/Worker）。Vite本番build成功、既存production構成のWorker dry-run成功。
- 関連7ファイル857件成功、失敗/skip 0。新しい採用済み配置696件はそのまま再実行して全成功。既存maps/期待値/skip/Vitest設定は不変。
- ST10/ST16×seed22未抽選/seed17 hornet抽選済みの実 `hurtEnemy`→`step` 回帰確認を追加。7体生成、キュー残0、hornet高さ上限5、実個体半径で衝突なし。
- 修正前後の草原・雪峡の配置観測4,292件は一致。元の有限1回実行証拠は不変に保管し、修正後は別フォルダーへ保存。
- 実ローカルWorker・2 WebSocketで、従来ST6 fixtureの実入力による頭部撃破→3体生成/6節残存・双方の同一権威スナップショット・通信エラー0を確認。これは洞窟のWorker撃破試験ではない。
- Chrome/d3d11で洞窟ST10/ST16を844×390・640×360で確認。専用ブラウザのローカル進行fixtureから実ソロ開始・ロード完了・戦場入口を操作。短時間の描画/HUD/横溢れを検査。pageerrorとconsoleを別記録し、ローカルanalyticsの既存CORSだけをURLで分類する。製品通信をmockしていない。

資料は [evidence/cave-foundry-release-20261007](evidence/cave-foundry-release-20261007/)。実装SHA、PR、監査、公開結果はSTATEと本書へ確定後に追記する。

## 独立監査（2026-10-08）

対象 `672bc9c63a7558f39db347bdf1901ed5d4bc0d8f` をpushし [PR148](https://github.com/futsalife24-bot/swarm-front/pull/148)を作成。iab→通常の新規[監査Chat](https://chatgpt.com/c/6ac65eb3-82dc-83ee-b828-a1da443b6e8d)に `swarm-front-pr148-672bc9c-audit.zip` を直接添付して依頼した。ZIP SHA256 `897aac904ba9ea76b8a448b3055ad42c447f1e3da0a57a44ce02979efa627a8d`。対象SHAのgit archiveで全sharedと必要server/設定/テスト/証拠を収録し、manifestに113ファイルの個別ハッシュを記録。秘密・vault・依存キャッシュ・変更のないモデル素材は含めない。対象以後の変更は文書・証拠のみ。判定待機中、main未反映/未公開。

自分が起動したローカルWorker8793・Vite5186は終了し、待受なしを確認。残留テストwrapperも確認時に消滅済み。既存CloudflareアカウントのOAuth認証を確認し、契約/権限は変更していない。

同Chatの確定判定は **合格、P0/P1/P2各0、任意1**。[全文](evidence/cave-foundry-release-20261007/audit-final.md)。監査側は113ハッシュとdiff逆適用、ソース経路、画像、観測を独立照合。実個体半径で洞窟増援1260個体を再計算し、修正前12違反→修正後0。草原/雪峡4292観測一致、洞窟で変わった243配置もkind/seed/routeは保持。依存取得が完了しなかったためVitest/Vite/Wranglerの独立再実行は未達。任意1は洞窟実Worker頭部撃破E2E追加で公開阻止ではない。追加製品修正なし、対象以後は記録のみ。

最初のPowerShell検証wrapperも最終的にexit 0を回収し、857件成功の結果JSONと整合した。

## 検証環境での失敗と限界

初回のWorker起動/dry-runはWindowsの親ディレクトリ読み取り制限で失敗し、通常権限で復旧した。テスト結果JSONは857件成功を記録したが、最初のPowerShell終了待ちwrapperは残留したため、結果JSONとwrapper終了を区別する。

古い `check-foundry-published` は現行の通常進行入口・レポートとは異なるセレクタを持ち、このままでは利用できなかった。新しい洞窟スクリプトで現行の保存キー・進行キー・共通選択UI・「戦場へ」の操作を合わせた。途中の導線失敗ログも保存。短い動画は同梱ffmpegが未導入で作成できず、依存追加は行っていない。analyticsはlocalhostを許可しない外部サービスの既存CORS失敗があり、console error 0とは報告しない。

洞窟の実Worker上での頭部撃破映像、長期戦の次tick以降の全位置、全seed/全敵モデル、高台版、実機タッチ、GPU長時間負荷、実タブ非表示cleanup、ST20/ST25完走は今回未確認。旧全敵強制出現maps試験などの既存失敗は修正/skipしていない。戦闘演出・PR137・別branchのST25 pilot修正は含めない。モデルID・推論設定は未確認。
