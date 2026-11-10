# BASTION開放・新規ソロ報酬の段階1/2を再開

2026-11-10。作業branch `codex/resume-combat-stage12-20261110` はHARROW保存済みcommit `503c9fea0b770021dc47585d87a91b12f7fa5bd2` から分岐した**HARROW＋武器段階1/2の統合候補**。元のHARROW branchとcommitは保持。元mainは `3f2c429c442c44d54bf4a8132cc791f30534ae9d`。root checkout、共有STATE、MainVault、候補2リファクタbranchは変更していない。

## 変更

- 採用済み旧段階1 `8fb37dc` からBASTION開放相だけ実弾の連射軽減を外し、敵全体で共有する連射履歴は継続。命中イベントの `guardKind` を既存の音・火花へ渡す。元の装甲・爆風・レーザー処理は維持。
- 採用済み旧段階2 `7d3b383` から、新規ソロ報酬だけ味方回復専用MDを抽選外にした。系統の先行抽選と乱数2回、協力MD、既存所有MDは維持。序盤比較で採用しなかったSMG強化・proc変更は含めていない。
- 旧 `tests/front-bastion-open.test.ts` と `tests/front-md-rewards.test.ts` を現行repoへ追加。現APIにそのまま適合した。12種を網羅する `tests/game.test.ts` の抽選条件を協力へ変更。CATENA・段階3の未承認候補には触れていない。

## 検証

- `npm run typecheck` 成功。`tests/front-bastion-open.test.ts`、`tests/front-md-rewards.test.ts`、`tests/bastion.test.ts`、`tests/game.test.ts` の84件成功。報酬・前線・生存・状態配信・音の関連7ファイル52件成功。計136件成功。
- `npm run build` 成功（既存の大きいchunk警告あり）。`npm run server:build` は最初、Wranglerの既定ログ書込みにsandboxの `EPERM` が出たため、同一dry-runを正式権限で実行し成功。Worker公開は行っていない。変更13ファイルのPrettier確認と `git diff --check` 成功。
- 旧BASTION実通信検査を現行のローカルWorkerで実行。旧検査の `bastion.counters` は現行の状態配信には存在せず、最初の2試行は「開放終了後guard」の判定条件が成立しなかった。検査専用の一時コピーだけを、開放後の時刻とguard相で判定するよう修正した。3回目は2 WebSocketの実入力・実配信で成功。開放2.2秒、開放命中34件すべて24ダメージ、開放前後の連射減衰復帰、両者の敵・弾・命中イベント一致、エラー0。[結果](evidence/combat-stage12-20261110/network.json)。製品側のfixtureや検査閾値は変更していない。
- 実通信に使ったローカル作成キーは値を出力せず、専用worktreeに作った一時 `.dev.vars` は検査後に削除。ローカルWorkerも停止した。

## 固定snapshotの扱い

`tests/game-step-equivalence.test.ts` は22件中12成功・10件SHA不一致で、snapshotは更新していない。現mainの独立した起動ゲートでは18成功・既知4件不一致が再現されており、今回も次の4件は現mainと同じ受信SHAだった：前線・生存・融合・1人／2人、前線・防衛・融合、前線・旧方式。日付未固定のrunによる差が強く疑われるが、日付固定の因果対照は未実施。根拠は別worktreeの `docs/REFACTOR-WORKER-START-GATE-20261110.md`。

追加の6件は、通常・3人・BASTIONの波、通常・全種直接配置の通常/高低差/洞窟、ソロ・ST1、武器庫防衛。前4件はBASTIONの開放係数と `guardKind` イベントが通る条件、後2件は新規ソロ武器抽選が通る条件。これらは今回の採用済み機能による意図した結果差と整合するが、固定SHAだけから各tickの厳密な因果を証明したわけではない。snapshotを無条件に更新して合格扱いしない。

## 段階と残件

今回の実装・自己検証はローカル候補。実ブラウザでのBASTION火花・音、実スマホ、段階2の協力報酬を通す実WS、全テスト、長時間の数値評価、本人の最終評価は未確認。新ユーザーの候補2リファクタ開始ゲート不合格は候補2だけの保留で、この段階1/2の採用判断とは分離する。通常の独立Chat監査は追加していない。push、main反映、Worker公開は未実施。

適用前のパッチ生成・照合3ファイルは `docs/evidence/resume-combat-20261110/` に**未追跡の準備成果**として保持し、この実装commitへ含めない。モデルID・推論設定はこの担当から取得できず未確認。再委任なし。
