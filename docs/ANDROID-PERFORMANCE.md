# Android実機性能測定（T3）

状態: 設計・診断準備中。物理Androidの結果なし。性能改善なし。

## 固定条件（コード変更前の測定設計）

- base / 測定ソース: `7827b9c07886efbad50c2bee3bf17a940b79a1fd`。診断ツールのHEADは別に記録する。
- ローカルVite版を最初の測定対象とする。公開版の数値とは混ぜない。公開版・production buildとの一致は未検証。
- 物理Android端末名、Android版、Chromeの完全な版、画面物理解像度はユーザー入力待ち。UAだけでモデル/OS版を確定しない。
- viewport CSS寸法、screen CSS寸法、DPR、描画buffer寸法は診断で自動取得。screen×DPRを物理解像度と断言しない。
- 横画面、標準画質1、目標60fps、ソロ通常難易度。同じ音量・明るさ・充電状態・省電力状態・開始時の冷却条件を記録。既存AdaptiveQualityの実際のscaleも記録。
- 実セーブを使用/変更しない。専用ローカルoriginの試験データだけ。武器・育成・アクセサリ・初期HP/位置・seed・StagePlanを固定したfixtureを準備できるまでは比較条件未確定。通常進行で解放済みの専用試験データを使い、実セーブ移植はしない。
- 敵数はステージの総出現数と同時生存数を区別。1秒ごとの実数・種類・waveを保存。目標密度に届かなければ負荷戦未達であり合格にしない。

| ケース | 既存ステージ | 開始 | 終了 | 条件 |
| --- | --- | --- | --- | --- |
| A 通常 | ST1 前哨掃討 | 初回説明終了、戦闘を操作可能になった時点 | 120秒または戦闘終了 | 通常の移動・照準・射撃、敵数分布を採取。早期終了は実時間を記録 |
| B 大群 | ST23 白嶺の反攻（保存ID24）wave2 | wave2開始 | 120秒または戦闘終了 | 編成45体は総数であり同時敵数ではない。実際の高密度区間を抽出、未到達なら未確認 |
| C 大型 | 15-A 異翼の痕跡（保存ID27）wave2 | HARROW出現、説明を閉じ操作可能 | 120秒または戦闘終了 | 飛翔・ミサイル・翼回転・ダイブの発生時刻を記録。未発生攻撃は未確認 |
| D 継続 | Bと同じ既存ステージを通常操作 | 最初の戦闘操作可能時点 | 壁時計600秒 | 中断なし。早期勝敗なら同ステージ再出撃を記録し戦闘区間とメニュー区間を分離。単一戦闘10分とは扱わない |

各ケースは開始直後0–30秒と最後30秒を比較。B/Cは到達前に記録を開始してもよいが指定wave以前を別区間にする。5–10分という要件上Dのプレイ自体は5分以内には収まらない。準備と保存操作を5分以内にまとめ、プレイ時間とは区別する。

## 指標と判定

実描画フレーム間隔のp50/p95/p99/max、実描画FPS、50ms超/100ms超のlong frameと発生時刻、1秒窓の低下を保存。RAFだけのFPSを描画FPSと呼ばない。描画メソッドのCPU経過時間はGPU実行時間やJS全体の時間ではない。

draw calls / triangles / points / lines、scene object数、geometry/texture数、JS heap（取得できる場合のみ）、敵数/種類/HP/武器の匿名条件を保存。input event timestamp→次の描画完了は入力待ちの参考指標で、入力→実際の画面反応/光子遅延とは別。体感は操作ごとに「反応する/遅れる/抜ける」を記録。

JS main threadの重い関数とGCはUSB remote DevToolsのPerformance traceを代表20–30秒だけ別採取（スクリーンショット/メモリdumpなし）。連続記録とtrace採取のオーバーヘッドを混ぜない。heapの減少をGCと断言しない。CPU/GPU使用率・temperature・battery・thermal throttlingは取得手段がなければ「未測定」。長時間後の低下だけでthermalと断定しない。

診断あり/なしの短い同条件試験で計測オーバーヘッドを確認する。Dev build、USB充電、debugger接続、profile実行自体の影響を限界へ記録。未測定なら改善率・快適性の結論を出さない。

初回実機測定後に品質基準を確定。上位1〜3件の再現可能な原因だけを修正候補とする。before/afterは同端末・browser版・fixture・ステージ・画質・時間・敵数分布で、各3回を目安に冷却条件を揃える。不一致は参考値。操作・見た目・進行を数値と一緒に確認する。

## 回帰・境界

T6正本: [SAVE-REGRESSION.md](SAVE-REGRESSION.md)。T2正本: [FIRST-TEN-MINUTES.md](FIRST-TEN-MINUTES.md)。Pointer Lock解除、タッチ操作/勝利条件、報酬→装備→再出撃を保護する。診断ツールだけの変更では本体src/server/publicを変更しない。runtime改善時は型・関連単体・test:save・必要なtest:save:browser・build・server:build:production・diff --checkと該当UI/実機を実行し、通常Chat独立監査/公開ゲートを満たす。自己レビューを独立監査に数えない。

対象外: T5/T7、凍結プロジェクト、敵/武器/報酬/ステージ/保存仕様の変更、常時送信・新サービス・新端末購入。main merge/公開は未実施。

## 実機の最短手順（PCの準備はCodex担当）

1. Androidで機種名・Android版・Chrome版を確認して伝える。USB接続とUSBデバッグの許可が必要。PC側ADBは導入済みだが2026-09-27確認時は接続端末0台。
2. PCでこのbranchを使い `npm run dev -- --port 5193`。USB接続後 `adb reverse tcp:5193 tcp:5193`。スマホChromeで `http://localhost:5193/scripts/android-performance-setup.html` を開き、「専用試験データを作成」→「ゲームを開く」。既存保存があれば自動停止するので消さずに連絡。
3. PC Chromeの `chrome://inspect/#devices` で該当タブだけinspectし、Consoleで下記を一度実行。通常ページには自動導入されず、リロード時は再導入が必要。接続ができない場合はここで実機待ち。
4. スマホでソロ→対象ステージ→通常で出撃し、説明を閉じる。診断のA/B/C/Dを選び「記録開始」。A/B/Cは各2分、Dは10分。B/Cはwave2までの到達時間が別途必要。勝敗/メニュー/画面非表示は戦闘と分離して解析する。
5. 自動停止後「JSON保存」。A/B/C/Dの4ファイルと、遅延・入力抜け・熱さの体感メモを渡す。モーダル表示中は通常の閉じる/スキップ操作後に保存する。Chrome Performance traceはCodexが必要な20–30秒区間だけ案内する。

```js
const { install } = await import('/scripts/android-performance-probe.mjs');
await install({
  sourceSha: '7827b9c07886efbad50c2bee3bf17a940b79a1fd',
  device: '未入力', android: '未入力', browserVersion: '未入力',
  physicalResolution: '未入力', charging: '未入力', brightness: '未入力'
});
```

上記の未入力項目は分かる範囲で実値へ。シリアル番号・IMEI・氏名は記入しない。診断JSONにはUA・画面条件と匿名のゲーム状態だけを保存し、保存本文・プレイヤー名・入力座標・キー値・他サイト情報は含めない。手入力metaにも個人情報を入れない。

初回試験データ: 通常進行形式、初期ライフル/ショットガン（既存レア度4、variance0）、育成0、アクセサリなし、標準画質1/60fps。全作戦の既存解放条件だけを合成達成。初回説明は残す。HP/位置/実武器値は開始サンプルに記録。プレイでHP/進行は変わるので、これだけで繰返し開始状態が同じとは扱わない。比較時は専用fixture/checkpointを固定してからbeforeを採り直す。ゲームの乱数seedは毎回変わり、最初のサンプル値は生成時seedとは限らない。初回は探索測定であり厳密な改善率の基準ではない。

`node scripts/analyze-android-performance.mjs <保存したJSON>` で同じ場所に `.summary.json` を生成。rawを残し、最初/最後30秒、1秒窓、spikeの時刻、敵数・wave・描画buffer/AdaptiveQualityを照合する。`physicalAndroidVerified` は自動でtrueにしない（UAのAndroid表記は実機証拠にならない）。端末/接続を人間が確認した記録を別途添える。

`window.__androidPerf.dispose()` またはリロードで診断を解除。停止時にRendererの元メソッド・observer・入力listener・timerを戻す。上限120,000件/配列、最大15分で有限。記録中のallocation、1秒ごとのscene走査、DOM表示更新のオーバーヘッドは未測定。実描画間隔はGPU完了時刻ではない。JS heapは対応Chromeのみ・近似で、VRAM/端末全メモリではない。LoAF/longtask非対応なら未測定であり0件成功と解釈しない。

参考: [Chrome公式USBデバッグ](https://developer.chrome.com/docs/devtools/remote-debugging)、[ローカルサーバー接続](https://developer.chrome.com/docs/devtools/remote-debugging/local-server)、[Long Animation Frame API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing)。

## 2026-09-27 準備結果

状態: **Awaiting manual**。ADBの接続端末0、Android実測0件。before/after・ボトルネック・改善率はなし/未測定。性能改善は実装していない。診断は `scripts/` の明示読み込みだけで、本体src/server/public/package.jsonはbaseと同一。停止後のprototype復元、observer/listener/timer解除、JSON保存→再読込→解析、専用fixture作成と既存保存の拒否をPC Chromeで確認した。PCの95等のframe件数は機能QAであり、Android性能の数値ではない。

型チェック、保存147件、build、Worker production dry-run、diff --check成功。Worker初回はsandboxのログ/ソース読込権限で失敗し、昇格したローカルdry-runは成功（公開なし）。fixture初回はrarityだけ変更したため既存validationが拒否、既存makeWeaponで正規生成へ修正して成功。初期2回の書出し待ちは遭遇モーダル中のためtimeout、実敵出現/演出終了を待ち通常のスキップ後に保存するQAへ修正して成功。失敗を成功として数えない。[機械記録](evidence/android-performance/status.json)、[診断QA](evidence/android-performance/pc-checks.json)、[試験データQA](evidence/android-performance/setup-checks.json)。raw PC診断・画像・ログは `dist-validation/android-performance/`（Git除外）。

本体差分なしなので保存ブラウザ回帰・ゲームの全進行/装備/報酬/見た目の再試験は未実施。試験データ経由の後半実戦攻略、5–10分計測の安定性、Androidの保存download/UI、物理safe areaも未確認。測定ツールの操作は既存上部HUDに重なるため、主観操作性の最終評価は診断なしでも行う。独立監査は未実施・PASSとしない。性能runtime改善もmerge/公開も今回行っておらず、そのゲートの代替をしていない。

作業branch `codex/android-performance-t3`、作業場所 `../share-image-fix`（開始時cleanな既存worktreeを再利用）。正規gameのdirty7件を含む他worktreeへ書き込まず、reset/clean/stash/checkout整理なし。実行モデルID/effort未確認、切替なし、サブエージェントなし。

停止理由: 物理Android端末が接続されておらず、端末情報・4ケースの実測が必要。
再開条件: 端末情報とUSB接続（または上記手順の診断JSON）。実機で条件を確定し初回測定→上位原因解析→必要な最小修正→同条件再測定。T2の人間初見待ちは依存条件ではない。

## 次の別セッション用（開始時だけ使用）

project-hubの親Issue #7とT5 #12「Hub最小行動集計」を読み、今回はT5だけに着手してください。T3 #10はAndroid実測待ち（Awaiting manual）で、診断準備はcodex/android-performance-t3に保存済み、性能改善・merge・公開は未実施です。T3の実機試験やT2 #9の人間初見待ちを勝手にDoneへ変更しないでください。T5本文の依存・範囲・完了条件を正本に、対象repoの最新AGENTS/WORKFLOW/STATE・main・既存差分を確認して進めてください。T7 #14と凍結プロジェクトは対象外、サブエージェントは使わないでください。
