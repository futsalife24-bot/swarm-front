# 試験pilotの回避時刻・入力境界の局所修正（2026-10-07）

ST25 seed814の既存試験が**1回の通し確認で勝利**した。172.45秒、92撃破、残HP141.152、3449入力すべて`validInput`を通過。変更は試験pilotとその検証だけで、製品のHP/火力/敵AI/攻撃時間/勝敗条件は変更していない。

## 対象と変更

- 正本: https://github.com/futsalife24-bot/swarm-front 。作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。
- base/main: `1c2f4ba44348ab95558ca0362f4f50a561e900d0`。branch: `codex/pilot-input-fix-20261007`。
- 原因の先行記録: [df51fa1の限定観測](https://github.com/futsalife24-bot/swarm-front/blob/df51fa1aa4269aad05a958c01802b0b9dce25a67/docs/STAGE25-OBSERVATION.md)。前の調査branchは保持し、今回へmergeしない。
- `tests/bot.ts`: 照準のpitchを既存`clampPitch`へ通す。HARROWのSpinは予告中の退避移動を続け、接触開始までの残り時間が回避持続時間の半分以下になってから回避を要求する。既に接触済み/判定終了の回転は警戒対象から外す。次の50ms tickで再使用待ちが解ける時だけdodgeを要求する。固定seed・ステージ番号・固定tickの特例は設けない。
- `tests/stages.test.ts`: 代表境界8件を追加し、既存通し試験は毎入力の`validInput`を確認する。勝利と全敵撃破の期待値、合法装備、seed814、12001tick上限は維持。ST25のHP減少を最大100件まで記録する診断を追加。HPの代入値は変更せず、スタック・位置・近傍敵を読むだけ。

Spin以外のHARROW警告（Dive/ミサイル）の退避計算は維持。回避の再使用待ち確認は共通の試験入力へ作用する。製品の入力受付やプレイヤー操作処理には触れていない。

## 検証

Windows / PowerShell / Node v24.19.0 / Vitest 5.0.0。モデルID・推論設定は未確認。

| 検証 | 結果 |
| --- | --- |
| 修正前の局所8件 | 1成功・7失敗。予告直後の回避、回避終了後/接触済み/攻撃終了後、再使用待ち、上下の入力上限を再現。他35件はskip |
| 修正後の同じ8件 | 全成功。他35件はskip。実`step`で接触中の回避と、その終了後にも同じ回転で再被弾しないことを確認 |
| 型 | 変更2ファイルを既存tsconfig継承の一時設定で検査、exit0。製品/CIの設定変更なし |
| ST25通し | 20:31 JSTに**1回だけ**実行。1成功・42skip、172.45秒/92撃破/HP141.152。3449入力の受付範囲を確認 |
| 差分 | 自己レビュー・`git diff --check`。`src/`・`server/`・依存・CI・Hook・Vitest設定に差分なし |

局所条件は別のworld名/seed37/作戦1の隔離fixtureを使い、製品の共有`step`・Spin判定・回避受付・入力検証へ接続する。早期退避、接触まで0.1秒、再使用待ち0.05秒と0.051秒、接触済み/判定終了、上下の限界を扱う。実装内部の条件式を写したテストではなく、移動、回避の開始、HP不変、受付可否を観測する。

```powershell
# 局所試験は修正前と修正後に各1回
node node_modules/vitest/vitest.mjs run tests/stages.test.ts --config vitest.config.ts -t '^pilot ' --reporter=json --outputFile=dist-validation/pilot-input-fix-20261007/after-boundaries.json
# 通し確認はこの1件を1回だけ
node node_modules/vitest/vitest.mjs run tests/stages.test.ts --config vitest.config.ts -t '^stage 25 completes within the time limit using legal endgame gear and ordinary inputs$' --reporter=default
```

型検査は`node node_modules/typescript/bin/tsc -p dist-validation/pilot-input-fix-20261007/tsconfig.json`。一時設定はルートのtsconfigを継承し、includeを`tests/bot.ts`と`tests/stages.test.ts`に限定した。build・Worker・ブラウザ・全作戦・全件単体は今回実行していない。

## 旧走行との差と残る被弾

旧pilotの128.15秒/78撃破での敗北に対して、今回は172.45秒/92撃破で勝利した。旧走行には80.2791度の不正pitchが含まれ、今回の補正で弾道・敵の生存・以後の入力経路が変わり得る。旧走行との毎tick一致や、勝利への寄与を回避時刻だけに分離した結論は出さない。

今回も被弾は6回ある。23.0/24.0/24.5/25.0秒に花粉各5.92、119.35秒にHARROWの回転124.32、131.85秒に敵弾23.828。回転時は再使用待ち1.45秒、敵弾時は1.60秒で回避が切れていた。どの先行攻撃への回避要求と競合したかまでは今回観測していない。自然回復も含む通常ルールで勝利し、無被弾化・難度緩和はしていない。

HP診断は試験中のアクセサで代入値をそのまま保持し、減少時のスタックと敵状態を記録する。製品ソースへの挿入や、HPを増やす処理はない。この実行では6件を保存し、上限による欠落0。診断なしとの別の通し比較は回数上限に従って追加していない。

## 証拠・完了範囲

[修正前](evidence/pilot-input-fix-20261007/before-boundaries.json)、[修正後](evidence/pilot-input-fix-20261007/after-boundaries.json)、[型検査](evidence/pilot-input-fix-20261007/typecheck.txt)、[型終了コード](evidence/pilot-input-fix-20261007/typecheck-exit.txt)、[型の一時設定](evidence/pilot-input-fix-20261007/typecheck-config.json)、[通しの実行回数/対象ハッシュ](evidence/pilot-input-fix-20261007/st25-execution.json)、[通しの生ログ](evidence/pilot-input-fix-20261007/st25.txt)、[同ログから抽出した診断](evidence/pilot-input-fix-20261007/st25-result.json)、[証拠・対象SHA256](evidence/pilot-input-fix-20261007/manifest.json)。テキスト証拠はGit保存に合わせ改行だけLF化した。

今回の範囲は自己レビュー・必要検証・調査branchへのcommit/pushと記録まで。UI・独立Chat監査・PR作成・main統合・既存Workerへの再公開は行わない。他の既知失敗を修正せず、全体テストが通ったとは扱わない。

次案1件（未実施）: 同じ合法装備・既存期待値で**ST20 seed814を1回だけ**確認し、HARROWが出る別作戦への影響を確かめる。今回のST25成功を理由に全作戦の成功へ一般化しない。
