# 生存改修の第1段階：専用武器1本化

2026-11-04。本人の「ここでやることも進めて」により、生存の戦闘部分を担当。カードの見た目とバディモデルは別セッションが担当する。

## 現在地

- 作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`
- branch: `codex/survival-build-core-20261104`。base: `24cbbae65568c9a034214a421e13627abfd886f9`。
- 正本: https://github.com/futsalife24-bot/swarm-front 。この段階は下書き。main反映・公開は未実施。
- 実装commit: `9dcdeea`。[下書きPR #269](https://github.com/futsalife24-bot/swarm-front/pull/269)へpush済み。
- 原因: 武器の爆発・貫通などとカードの特徴が重なり、何をカードで伸ばすのか分かりにくかった。無属性の共通武器を出発点にして、カードで個性を作る。

## 実装

- 新規生存戦の専用武器は「生存戦ライフル」1本。初期ライフルの威力24・装弾32・装填1.65秒を基準とし、持込武器のLv・改造・特殊効果を引き継がない。性能数値は暫定で、難度調整済みではない。
- `frontSurvivalBuild: 1` の通信対応と `world.front.survivalBuildVersion: 1` を明示する。既存作戦の途中で武器や規則を変えない。防衛・日替わり防衛・旧世代は2本を維持。
- サーバーが専用武器を生成する。1本形式で強化済み装備を送っても性能は基準に置き換える。新旧画面の混在出撃は拒否し、旧画面の新規則作戦への復帰はトークンを残して更新を案内。
- 生存出撃時に進撃の装備を書き戻さない。専用武器を報酬・永続倉庫へ追加しない。取得済み武器・カード・報酬Lvの計算は保持。
- 出撃準備・ロビー・戦闘HUDを1本表示に対応。生存の切替ボタンを隠し、Q入力でも1本のまま射撃・装填できる。
- カード編集UI・カード分類・抽選・属性効果・難度計算・保存形式は未変更。新規データには現行で16種類があり、カード不足を前提に既存カードを削る必要はない。

## 検証

| 検証 | 実結果 |
| --- | --- |
| `npm run typecheck` | client/shared/Worker成功 |
| `npm run test:front -- tests/front-weapon.test.ts tests/front-survival-build.test.ts tests/front-survival.test.ts tests/front-run.test.ts tests/front-network-opening.test.ts tests/front-growth.test.ts --no-isolate --maxWorkers=1` | 6ファイル38件成功 |
| `npm test -- tests/game.test.ts tests/standard-trooper.test.ts tests/state-wire.test.ts tests/state-tuples.test.ts --no-isolate --maxWorkers=1` | 4ファイル67件成功 |
| `npm run test:front -- tests/front-network-input.test.ts tests/front-room-access-network.test.ts tests/front-wire-pressure.test.ts tests/front-network-opening.test.ts --no-isolate --maxWorkers=1` | 4ファイル54件成功。welcome旧版2種/現行版を含む。上段との重複あり |
| `npm exec --no -- vitest run --config vitest.front-survival-build-integration.config.ts --no-isolate --maxWorkers=1` | 実ローカルWorker `127.0.0.1:8807` とWebSocketで3件成功 |
| `node scripts/check-survival-build.mjs` | 隔離したChromeの844×390・640×360両方で成功。ページ例外0、進撃保存データの前後一致 |
| `npm run build:production` | 成功。既存の大きいチャンク警告あり |
| `npm run server:build:production` | 既存production設定のdry-run成功。デプロイなし |
| 変更対象のPrettier・`git diff --check` | 成功 |

実通信では2人で開始、偽装性能の除去、カード取得後の同期、切替入力、再接続、旧画面の拒否後に同じトークンで復帰、旧作戦の2本維持、混在拒否を確認。UIでは出撃準備→防衛/生存切替→カード→準備→出撃→1枚取得→途中退出を操作し、保存データを照合した。実スマホ・長時間プレイ・難度バランスは未検証。

画像: [844×390準備](844x390-prep.png)、[844×390戦闘](844x390-battle.png)、[640×360準備](640x360-prep.png)、[640×360戦闘](640x360-battle.png)。[UI結果](results.json)。戦闘画像は出撃演出中。

単体テストのWindows一時SSRファイルENOENTに対して、既存のテスト隔離を解除する `--no-isolate --maxWorkers=1` で実行。テスト内容・合格条件は変えていない。ローカル通信は既定sandboxでEACCESとなったため、正式な昇格審査を通して実行した。過去のアプリ操作用ブラウザーツールの復旧は本テストで証明していない。

## 仕様確認待ちと次の作業

本人へ確認済みの質問（回答待ち）:

1. 基礎カードは常時候補、特徴を変えるカードは出撃デッキに6種類選択、火・氷・雷は初期から選択可能、既存の解放カードを保持する構成。
2. 進撃進度に影響されない共通の標準難度から調整し、選択式の高難度を後続にする構成。

これらの具体仕様は未承認であり、実装済み・確定済みとは扱わない。現在は進撃進度による敵強化が残るため、専用武器だけをmain反映・公開しない。既存の通常公開の継続承認は維持し、仕様確定後に関連変更・必要検証をまとめて通常PRで反映する。

回答後は基礎カードの具体的な範囲、出撃デッキの6種類と戦闘中の同時6枠の関係、初期選択肢、融合条件を既存仕様と突き合わせる。古い保存と進行中の作戦を壊さず、基礎/デッキ/融合の表示分類をClaude担当へ渡す。火・氷・雷の効果は連鎖の無限再発動、氷結の永久停止、人数による負荷増を避ける範囲で実装・検証する。呪い・風・分裂の数値と実装順は未確定。

別セッション: `task-survival-card-design` / `claude/survival-card-design-20261104` は見た目、`task-buddy-lowpoly` / `codex/buddy-tatara-lowpoly-20261104` は低ポリゴンのバディ試作。素材・プレビューは本ブランチへ未統合。STATEとMainVaultのこの作業記録は主担当が更新。

モデル: 主担当の実モデルID・推論設定は取得できず未確認。限定実装と実通信テストを子1体へ委任し、指定は `gpt-6-sol` / `medium`。実稼働設定の別取得は未実施。子による再委任なし。
