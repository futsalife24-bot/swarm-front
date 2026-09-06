# テスト記録

現行P1修正は [P1-AUDIT.md](P1-AUDIT.md) と Git除外の ../dist-validation/checks.json を参照。以下の検証件数・測定は修正前 eb39568 の履歴であり、今回の合格証明ではない。

実行日: 2026-09-06。Windows build 26200 / 25H2、Node v24.14.1、npm 11.11.0。インストール済みGoogle Chrome、PlaywrightはSwiftShaderのソフトウェア描画。通信は同一PCのTCP/WebSocket、Wrangler 4.129.0＋workerd 2026-09-03、SQLite-backed Durable Objectsのローカル実体。

## 合格した検証

| 実行コマンド | 結果・証拠 |
| --- | --- |
| `npm run typecheck` | クライアント・共通計算・Workersのstrict型チェック成功 |
| `npm run format:check` | 監査対象コード・設定の書式チェック成功 |
| `npm test` | 13件成功。連射制限、装填、壁射線、散弾、ロケット範囲、3体貫通、蘇生、敗北、人数調整、40体上限、不正入力・武器、抽選全系統、初期装備攻略、保存・重複・上限・読込失敗 |
| `npm test -- --config=vitest.integration.config.ts` | 実WebSocket 4件成功。fixture区別は下記。`evidence/network.json` |
| `npm run test:e2e -- --config=playwright.solo.config.ts`（smoke 2件、当時の設定） | PC移動・切替・blur解除、CDPの3点タッチで移動＋照準＋射撃、touchCancel、縦横回転が成功 |
| `npm run test:e2e -- --config=playwright.solo.config.ts --grep 'full solo'` | 1件成功、実時間約6.1分。通常入力で勝利→報酬装備→再読込→その武器で再出撃。作戦表示5:05、166撃破、4報酬。`evidence/loot.png` |
| `npm run test:e2e -- --grep 'two independent\|40 authoritative\|solo defeat'` | 3件成功。独立2画面の協力、40体描画、敵攻撃によるソロ敗北→装備→再出撃 |
| `npm run test:e2e -- --grep 'production Pages'` | 1件成功。`/swarm-front/` のJS/CSS配信・ソロ開始。productionには開発診断変数がない |
| `npm run test:e2e -- --grep 'co-op fixture rewards'` | 1件成功。両ブラウザで個別報酬保存→装備変更→実ルームの再出撃。初期ボスHPだけは隔離fixture。`evidence/coop-loot.png` |
| `npm run test:offline` | 通常Workersを停止し、ヘルスチェック不可を確認後Chromeでソロ開始。`evidence/offline.json` |
| `npm run build` | 成功。JS約573KB、gzip約150.5KB。500KB超のチャンク警告は残る |
| `npm run build:pages` | 成功。`dist-pages` は `/swarm-front/` 参照 |
| `npm run server:build` | dry-run成功。通常Worker約34KB。通常ビルドにTestRoom/fixtures入口なし |
| `npm audit --omit=dev --json` | 配布用依存の既知脆弱性0件。開発依存を含む全監査とは区別 |

E2Eは合計8ケースを分割実行して確認。さらにサーバー停止時の独立起動1件。全ケースをひとつのコマンドで連続実行した記録ではない。

## 実通信の検証を区別

**通常コード・通常初期状態:** 4人参加と5人目拒否、異なる2ソケットが同時点の敵HP・撃破数・進行を受信、射撃での撃破、進行中の新規参加拒否、同じ参加者トークンで復帰、不正入力・2KiB超過・35件/秒超過の拒否。ブラウザ2画面の移動共有も通常コード。

**隔離テストWorkersの初期状態:** ダウン状態から実入力で蘇生、ボス残HP1から実射撃で勝利・個別報酬確定・再接続後の同じ結果の再受信・二重保存防止、40敵描画。fixtureは準備を短縮するもので、フルミッション攻略の証明とは扱わない。server/testing.tsとwrangler.test.jsoncだけにあり、通常設定に含まれない。

ソロの通し攻略はHP・敵・時間・報酬を書き換えず、テスト操縦が通常のキー・ポインター入力を送る。開発診断は状態の複製を返す読み取り専用。

## 性能と証拠

- 40敵、915×412タッチ端末エミュレーション、PC Chrome SwiftShader。
- 表示32.68fps、フレーム中央値33.4ms、p95 66.8ms、172標本、52描画呼び出し。
- **安定30fpsの証明でもAndroid実機の測定でもない。** 温度・電池・1時間連続負荷も未確認。
- 40敵・2人の状態メッセージ例5,770バイト（射撃イベントが少ないfixtureの瞬間値）。
- `combat.png`: 通常ソロ。`loot.png`: 通常ソロ勝利。`mobile-emulation.png`: タッチ検証。`coop-a.png` / `coop-b.png`: 独立2画面。`combat-40.png`: 40敵fixture。
- 数値は `evidence/render-load.json`、`network.json`、`offline.json`。

## 発見して修正／再実行した問題

- 初回buildの不要なCSS importを除去し、再build成功。
- workerd起動前のWindowsランタイムクラッシュ: 本作内の新しいMicrosoft DLLで起動を確認。OS全体の更新は完了していない。
- テスト操縦が遠距離攻撃の前で静止して敗北したため、操縦の回避を修正。ゲームには5秒被弾なしの回復と90秒のウェーブ間隔を採用し、その後通し攻略成功。
- 短いQキー入力を取りこぼす不具合: 次の更新まで押下を保持。PC・スマホ再実行成功。
- 通しE2Eの初回は開発用自動再読込で中断・タイムアウト。その実行は失敗。画面コード固定後に約6.1分の通し実行で成功。
- 自動レビューで協力リザルトの再表示、サーバー側の瞬間入力保持、空室停止、再接続タイムアウト、受付競合、装備更新上限、戦果保存失敗時の明示を修正。通信回帰テスト成功。

## 未実施

インターネット越し、Android実機2台（1台も未実施）、本番契約・料金メトリクス、クラッシュを強制した再起動復旧、長時間負荷、人間によるバランス評価。ローカル2接続やスマホ画面サイズで代替済みとは扱わない。

監査入口: 初回条件1–3はmission.spec.ts / defeat.spec.ts / save.ts、4–7はcoop.spec.ts / network.test.ts / worker.ts、8はcheck-offline.mjs、9–10はpackage.json / subpath.spec.ts。外部公開・mergeは未実施。
