# P1独立監査修正

開始: 2026-09-06 / Windows / Node v24.14.1 / npm 11.11.0。
cwd: `C:\Users\futsa\Documents\Codex\2026-09-06\chatgpt-swarm-front-1-sparkling-hollow-2`。
適用: 提示されたグローバル指示およびルートAGENTS.md（祖先に別のAGENTS.mdなし）。
開始branch `feat/first-playable`、HEAD `eb39568c33556e65220b37c52a73f0331e046cc4`、status空。
作業branch `fix/p1-audit`。主担当1体・追加担当なし。公開・本番deploy・merge・push・課金なし。

## 差分と回帰条件

| 指摘 | 原因と修正 | 回帰テスト |
| --- | --- | --- |
| P1-1 | 小数の上限計算が1.36未満になる。POWERの整数1000/1120/1240/1360を生成と検証で共有。1000倍整数を生成して最後に除算。有限性、整数への往復で3桁精度を検証。保存形式v1は維持 | seed53の最初1793件と10万件すべて合法、1.36合法・1.361拒否、勝利報酬をrewards→persist→parseSaveして装備維持 |
| P1-2 | 切断者も更新され、全滅の保留理由になっていた。切断者を戦闘更新・蘇生対象から除外。接続者全滅なら敗北、全員切断は計算停止 | 単体で10秒の全フィールド固定・ドロップ未回収、全滅・全員切断。実WorkersでHP50のまま10秒、全員切断時のtimer停止・保存状態、同一ID/HP/弾/装填/cooldown復帰、30秒期限 |
| P1-3 | 波開始から90秒を進行条件に使用。出現quota＋全滅＋共通4秒インターバルへ変更。WAVE CLEARと残秒表示。次波開始時に回復とボス生成 | 未出現quota・残敵で進まない、最後の撃破から5秒以内、45HPが1回だけ、ボス1体だけ。初期装備ボットと実ブラウザ通常ミッション（fixtureなし） |
| P1-4 | Originだけで作成を認め、偽コードもカウンター消費。サーバーsecret資格と期限付き発行コード登録を追加。無資格はGate前、偽コードはカウンター前で拒否 | 無資格・偽装Origin・Originなし401、正しい資格で成功、65個の無作為コード拒否後も全体接続数不変、4人成功5人目拒否。token/キーのURL・状態・エラー非露出 |

低リスク同時修正: 協力移動予測の回避速度を共通MOVE_SPEED.dodge=17へ統一（開始タイミングは受信状態に従う）。受信JSONをtry/catchし型・配列を最低限検証。移動と操作ボタンにsafe-area-insetを加算。

## 同一HEADの検証方法と証拠

修正・テスト・この引継ぎをコミットしてから、コードを変更せず最終検証する。実行結果は `dist-validation/checks.json` に各コマンドのbranch、HEAD、clean、開始終了時刻、終了コード、ログ名を記録する。生成証拠でHEADを変えないため、このフォルダはGit除外。監査へはこの記録と各ログを一緒に渡す。**この文書自体は未実行の検証を合格と認定しない。最終合否は記録の終了コードで確認する。**

`node scripts/record-check.mjs <script名>` は次の固定npmコマンドだけを実行して記録する:

```
npm run format:check
npm run typecheck
npm test
npm run test:integration
npm run build
npm run build:pages
npm run server:build
npm run test:offline
npm run test:e2e
```

別ターミナルで `npm run server -- --persist-to .wrangler/<今回専用> --log-level error` と `npm run server:test -- --persist-to .wrangler/<今回専用test> --log-level error` を管理。`server:test` は終了型テストではなく常駐fixtureサーバー。`test:offline` 前に通常Workersを停止。E2Eは全ケースを一つのコマンドで実行。終了後はWorkers・Vite・previewを停止する。`server:build` は `wrangler deploy --dry-run` であり公開処理ではない。

証拠: `dist-validation/evidence/` のmission.json、network.json、offline.json、render-load.json、戦闘・戦利品png。初回版の `docs/evidence/` は上書きしない。実通信fixtureは蘇生/報酬/切断初期状態を準備する補助で、通常ミッション攻略と区別する。

## 準備中の失敗・制約

- `git switch -c fix/p1-audit` はGit管理領域の書込み制限で一度失敗し、自動承認後に成功。
- `npm run server` のsandbox起動はWranglerログ書込み・ビルド祖先読取り制限で失敗。許可されたローカル制限外実行へ切替。
- server:testにpersist-toを重複指定した起動は引数エラー。固定引数をscriptから外して明示指定へ統一。
- `npm run dev` は既存の本作5186サーバーでポート使用中。既存プロセスを特定して管理。
- 初回 `test:integration`: 7件中1成功6失敗。Node fetchがUpgradeヘッダーを拒否（node:httpの実Upgrade要求へ修正）、ゲーム時間と実時間の過剰な等速期待（実10秒間の状態不変を比較）、旧Workersが作成キーを未読込（再起動）。
- 2回目 `test:integration`: 7件中3成功4失敗。タイムアウトおよび期待イベント未着。試験中の共通コード編集がWrangler再読込を起こしたため、最終検証はコミット後コードを凍結して再実行する。
- 予備 `test:e2e -- --grep 'two independent|co-op fixture|40 authoritative'` はサーバー入替のため中断（合格扱いしない）。
- 準備中の単体20件・型チェックは成功。これを最終HEADの検証の代用にはしない。

## 運用前提・残る確認

新しい依存・課金・外部サービスは追加なし。作成キーはローカルでは明示的な `npm run setup:local` でGit除外 `.dev.vars` へ生成。本番では別キーをCloudflare secretへ置く（今回は未実施）。Viteも `.dev.vars*` を配信拒否。許可Originは認証ではない。登録コードは最大1時間・日跨ぎ最大200件。旧版発行の招待は作り直す。

拒否リクエスト自体のWorkers/DO消費はゼロにならず、既知の招待や漏洩した作成キーを持つ攻撃への完全防御ではない。Free契約とアカウント全体の残枠確認が公開前に必要。既存見積もりは通常利用の仮定であり費用保証ではない。

インターネット協力、Android実機、Cloudflare本番secret設定、実プロセスクラッシュ後の復旧、人間の初見難易度は未検証。固定90秒廃止後のプレイ時間は初回目標5〜8分より短くなる可能性がある。正式な公開判断は独立再監査と承認待ち。
