# 生存改修：専用武器1本と全通常カードの抽選

2026-11-04。本人の「ここでやることも進めて」により、生存の戦闘部分を担当。カードの見た目とバディモデルは別セッションが担当する。

## 現在地

- 作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`
- branch: `codex/survival-build-core-20261104`。base: `24cbbae65568c9a034214a421e13627abfd886f9`。
- 正本: https://github.com/futsalife24-bot/swarm-front 。この段階は下書き。main反映・公開は未実施。
- 第1段階の実装commit: `9dcdeea`。継続先は[下書きPR #269](https://github.com/futsalife24-bot/swarm-front/pull/269)。全通常カードへの変更は `25ddad3` を基点とする追加差分。
- 原因: 武器の爆発・貫通などとカードの特徴が重なり、何をカードで伸ばすのか分かりにくかった。無属性の共通武器を出発点にして、カードで個性を作る。

## 第2段階：全通常カードを初期から抽選（2026-11-04追記）

本人の「基本は全てのカードが出現するが、進撃の進み具合の報酬や兵士の強化スキルツリーの中などにカードの出現除外や再抽選数を増やす仕組みを作って行く」を採用。以前の「基礎は常時候補、特徴カードは出撃前に6種類選択」案を置き換える。初期所持の少なさでビルドが成立しない問題を避け、成長によって抽選へ介入する幅を増やす。

- 新規則の生存戦では通常カード22種類すべてが初期から候補。進撃進度・保存済みデッキ・クライアントの狭い候補指定で制限しない。ソロ・協力とも同じ規則で、サーバーが候補を確定する。
- 融合9種類は既存どおり素材2種を最大段階まで育てた後に抽選可能。初期抽選には混ぜない。戦闘中の最大6枠、最大段階・融合済み素材などによる抽選制限も維持する。
- 生存のカード画面を一覧・効果確認へ変更し、デッキ保存・候補選択の操作を表示しない。防衛戦の候補編集、旧作戦、既存保存キーは維持し、デッキを削除・書換えない。
- 除外・育成での再抽選追加は未実装。現行の再抽選は1作戦の追加カード選択で合計2回、開幕は不可のまま。回数を増やす際はサーバー検証・保存済み作戦の互換性も合わせて変更する。
- 兵士育成の現物はHP・照準・移動・切替の4項目へのポイント配分であり、分岐するスキルツリーはまだ存在しない。新しい枠・育成コスト・保存形式を今回勝手に追加していない。

### 第2段階の検証

| 検証 | 実結果 |
| --- | --- |
| `npm run typecheck` | client/shared/Worker成功 |
| `npm run test:front -- tests/front-survival-build.test.ts --no-isolate --maxWorkers=1` | 6件成功。進度0/25・狭い候補指定でも全22種、初期融合なし、旧作戦の候補維持 |
| `npm run test:front -- tests/front-fusion.test.ts tests/front-decks.test.ts tests/front-campaign.test.ts tests/front-network-opening.test.ts --no-isolate --maxWorkers=1` | 4ファイル33件成功 |
| `npm exec --no -- vitest run --config vitest.front-survival-build-integration.config.ts --no-isolate --maxWorkers=1` | 実Worker `127.0.0.1:8807` とWebSocketで4件成功。新規則2人の全22種・旧規則の指定6種を直接照合 |
| `node scripts/check-survival-build.mjs dist-validation/survival-all-cards` | 隔離Chromeの844×390・640×360で成功。全22種・通常カードのロックなし・生存では編集なし・防衛では編集あり・出撃/帰還・保存の前後一致、例外0 |
| `npm run build:production` | 成功。既存の大きいチャンク警告あり |
| `npm run server:build:production` | production設定のdry-run成功。デプロイなし |
| 変更対象のPrettier・`git diff --check` | 成功 |

統合テストはテスト専用Workerの既存snapshotへ各参加者の候補poolを追加し、読み取り用GETでも取得する。初期3択が偶然狭い6種から出る場合にも判定が揺れないよう、抽選結果から候補全体を推測せず状態を直接確認した。本番Workerの診断入口は追加していない。

画像: [844×390カード](all-cards/844x390-cards.png)、[640×360カード](all-cards/640x360-cards.png)、[844×390準備](all-cards/844x390-prep.png)、[640×360準備](all-cards/640x360-prep.png)。[実導線の結果](all-cards/results.json)。640幅は既存6種の候補保存を用意し、生存に入っても元文字列が変わらないことを確認。カード一覧・準備のスクロール領域は既存構成を維持。実スマホ・長時間バランスは未確認。

### 残る仕様と他担当への引継ぎ

- 確認中: 除外は出撃前の枠、戦闘中の回数消費、両方のどれを軸にするか。進撃報酬の段階、兵士の強化項目、枠数・追加再抽選数・コストも未確定。
- 提案（未承認）: 進撃報酬は全兵士共通の少数の枠、兵士育成は除外と再抽選の配分にする。どちらも無制限に最大化すると毎回同じ完成形に寄りやすく、逆に初心者の介入手段が少なすぎると全候補からの抽選が厳しくなる。初期から少数の再抽選を持たせ、追加数は有限にする。
- 確認中: 進撃進度と切り離した標準難度から調整し、選択式の高難度を後続にする案。現状は進撃進度による敵強化が残るため、専用武器と全カード化だけを公開しない。
- Claudeのカード見た目担当へ: 分類は「通常／融合」と属性を軸にする提案へ更新する。「基礎／デッキ選択／融合」を確定仕様として実装しない。除外は将来の状態表示で、レア度とは別。現行の属性効果や全カードのレア度はまだ未確定。`front-base.ts` は本担当も機能変更しているため、見た目の統合時は本ブランチの全カード規則・防衛の従来編集を維持して差分を合わせる。別worktreeへの自動反映・メッセージ送信はしていない。
- バディ担当のモデル・素材は変更なし。火・氷・雷のカード効果、呪い・風・分裂の数値と順序も今回未実装。

## 第1段階の実装（以下は全カード化前の検証履歴）

- 新規生存戦の専用武器は「生存戦ライフル」1本。初期ライフルの威力24・装弾32・装填1.65秒を基準とし、持込武器のLv・改造・特殊効果を引き継がない。性能数値は暫定で、難度調整済みではない。
- `frontSurvivalBuild: 1` の通信対応と `world.front.survivalBuildVersion: 1` を明示する。既存作戦の途中で武器や規則を変えない。防衛・日替わり防衛・旧世代は2本を維持。
- サーバーが専用武器を生成する。1本形式で強化済み装備を送っても性能は基準に置き換える。新旧画面の混在出撃は拒否し、旧画面の新規則作戦への復帰はトークンを残して更新を案内。
- 生存出撃時に進撃の装備を書き戻さない。専用武器を報酬・永続倉庫へ追加しない。取得済み武器・カード・報酬Lvの計算は保持。
- 出撃準備・ロビー・戦闘HUDを1本表示に対応。生存の切替ボタンを隠し、Q入力でも1本のまま射撃・装填できる。
- 第1段階時点ではカード編集UI・カード分類・抽選・属性効果・難度計算・保存形式は未変更だった。初期16種類＋進撃報酬6種類という旧構成を、第2段階では新規生存戦に限り全22種類の初期候補へ変更した。

## 第1段階の検証

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

## 作業の境界

既存の通常公開の継続承認は維持し、残る仕様確定後にカード・難度・必要検証をまとめて通常PRで反映する。火・氷・雷の実装時は連鎖の無限再発動、氷結の永久停止、人数による負荷増を確認する。旧デッキ案についての以前の質問は今回の本人指示で置き換え済みであり、回答を取り直さない。

別セッション: `task-survival-card-design` / `claude/survival-card-design-20261104` は見た目、`task-buddy-lowpoly` / `codex/buddy-tatara-lowpoly-20261104` は低ポリゴンのバディ試作。素材・プレビューは本ブランチへ未統合。STATEとMainVaultのこの作業記録は主担当が更新。

モデル: 主担当の実モデルID・推論設定は取得できず未確認。限定実装と実通信テストを子1体へ委任し、指定は `gpt-6-sol` / `medium`。実稼働設定の別取得は未実施。子による再委任なし。
