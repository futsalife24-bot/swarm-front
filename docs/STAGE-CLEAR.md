# ステージクリア演出（2026-09-11）

勝利直後に戦場を背景として中央に STAGE CLEAR / 作戦完了を表示する。文字の拡大・上昇・フェードインとラインの展開、2.8秒からフェードアウト、3.2秒後に既存リザルトへ進む。低フレームレートでも実時間で計測。動きを減らす設定ではアニメーションを無効化する。

ソロの終了判定と協力の権威スナップショットを `finishMission()` に集約。演出中はHUD・操作・ポーズを閉じ、報酬を演出開始時に保存する。既存のrun単位の重複保存防止と保存再試行を維持。敗北は従来のリザルトへ進む。

将来のBGMは `window` の `swarm:stage-clear` イベントへ接続する。detail は `{ run, stage, durationMs: 3200 }`。同じrunの終端スナップショット再受信では再発火しない。音源・BGM再生自体は未実装。

## 差分と検証

- branch: `codex/home-armory`。base / head とも `2be699f160c83d641fb68bb1304e4da8059920dc`。既存の大量の未コミット・未追跡作業を維持、今回も未コミット。
- `src/main.ts`: 勝利演出への遷移、時間制御、先行保存、開始イベント。
- `src/client/stage-clear.css`: 中央表示とアニメーション、横画面・reduced motion対応。
- `src/menu-theme.css`: クリア演出をメニュー背景の対象から除外。
- `e2e/stage-clear*.spec.ts` / `playwright.stage-clear.config.ts`: 変更に絞った検証。
- `scripts/verify-stage-clear-published.mjs`: 配信物とAPIの検証。
- 型チェック成功、関連単体41件成功、クライアントbuild成功、production Worker dry-run成功。既存の500KB超チャンク警告あり。
- 最終E2E 2件成功（43.3秒）：実ローカルWorkerの2ブラウザで通常射撃→勝利、開始時の結果非表示・操作停止・個別報酬保存・通知1回・時間経過後の結果表示。ソロはブラウザ内のみの終端phase fixtureでPC1280×720／640×280、reduced motion、2回のクリア、ホーム・再出撃、敗北を確認。出荷コードにfixture用書込口は含まない。
- `dist-validation/stage-clear/solo-1280.png` / `solo-640.png` を目視確認。今回差分は `main.patch` と `menu-theme.patch`、変更前原本も同フォルダ。
- 旧E2Eの追加試行：通常敵攻撃を待つ敗北テストは150秒で未到達。既存協力テストは旧招待UIを調整すると演出・保存・結果まで通るが、その後の再出撃ボタンが無効で停止。今回の回帰かは未特定。旧テストファイルは今回開始時の状態に戻し、最終の対象検証とは区別した。実スマホ・インターネット協力・協力再出撃は未検証。

## 公開

既存Worker `https://swarm-front.melosalife-24.workers.dev` に公開。
Version: `63c84e07-1fee-4af6-be93-1e4642802d15`。
配信照合の結果は `dist-validation/stage-clear/published-assets.json`。
