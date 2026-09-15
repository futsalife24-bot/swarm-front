# 敵の追跡・待機配置（2026-09-09）

- 追跡中は個体ごとに0.65〜1.6秒間隔で進路を抽選。左右最大約49度（ボス約20度）、プレイヤーへ進む成分を維持。3m以内は直進、12mまで徐々に揺らぎを増やす。地上・飛行・蜘蛛の跳躍へ適用。既存速度・攻撃予告・当たり判定を維持。
- 全10ステージの通常3ウェーブに待機敵を事前配置。ST1〜3は3体、ST4〜6は4体、ST7〜9は5体、ST10は6体。中央街路の左右へ分散し、建物外に配置。既存ウェーブ総数へ算入。
- 見通しのある生存・接続中の隊員が18m以内に接近、または被弾すると起動。一度起動したら待機へ戻らない。待機中は移動・攻撃なし。未撃破の待機敵もクリア条件へ含む。
- 行動状態は共有Worldに保存し、協力では権威Workerが更新。任意フィールド未設定の旧敵は従来どおり活動する。
- AGENTS.mdにユーザーの「別指示がなければ公開まで完了」を保存。

## 検証
型チェック・94単体テスト成功。全10ステージを通常入力の自動操縦で攻略、総撃破数が既定と一致。待機・接近・被弾起動、全ステージ配置、ウェーブ進行、個体差・時間変化・スナップショット再現を追加検証。

最初のテストでは、敵なし前提のfixtureに事前配置が加わったため失敗。fixtureは明示的に敵を消去して対象条件を分離。外周案では操縦が中央街路から敵を発見できなかったため、配置を見通しのよい中央街路の左右へ調整。敵能力・操縦は変更していない。

本番画面ビルド・本番Worker dry-run成功。既存500KB超バンドル警告あり。実ローカルWorkerの独立Chrome2画面で4敵種と多関節ボスの受信・描画、別fixtureの姿勢描画を確認。最初のルーム作成は失敗し、今回専用のWorker保存領域で再実行して成功（初回原因は未確定）。テスト専用の初期敵は明示的にクリア。PC・スマホ幅の画像あり。今回の待機起動の通信越し通し攻略・Android実機・人間の体感評価は未確認。

## 公開
既存Workerへ公開成功。Version: 9e44e96c-06e9-4926-9659-6603729ae352。
URL: https://swarm-front.melosalife-24.workers.dev
JS: index-BH_5O0LJ.js。

## 差分と証拠
branch: codex/home-armory。base / HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。既存を含む未コミット・未追跡変更あり。commit / push / mergeなし。
変更対象: src/shared/game.ts・enemy-motion.ts（動作と配置）、src/client/changelog.ts（更新履歴）、tests/enemies.test.ts（追加検証）、tests/game.test.ts・p1.test.ts・stages.test.ts・server/testing.ts（fixtureの分離）、e2e/enemies.spec.ts・playwright.enemies.config.ts（ルーム作成の確認・保存領域分離）、AGENTS.md・docs/STATE.md・本書（運用と記録）、scripts/check-enemy-behavior-live.mjs（公開確認）。
今回開始時からの差分: dist-validation/enemy-behavior/task.diff。共有処理・設定変更前のファイルも同フォルダに保存。git diff --check成功。

公開Chrome 1280×720 / 844×390: HTTP200、ソロ開始・ライフルとロケット射撃・API health 200 / ok:true、pageerrorなし。配信JSとローカル成果物のSHA256一致: b9d54c0afd770e9cf606566d180366faf60a733872b59a99d717885b803ffdc0。証拠: dist-validation/enemy-behavior/live/result.json と同フォルダのPNG。
