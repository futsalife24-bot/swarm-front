# マルチ快適化の残件計測（2026-11-13）

**goalは未完了。閉じる判断は本人が行う。** 最新main `3fd6e65` から `codex/coop-comfort-close-20261113` を作成。作業場所はrepo配下の `task-coop-comfort-close-20261113`。元root・他worktreeの既存差分は保持した。A-1へPR #326とmerge後mainの記録を先に補った。

| 残件 | 判定 | 今回の証拠・残る条件 |
| --- | --- | --- |
| 1. 64KiBの余裕 | 解消（証拠あり、検査範囲内） | 実Worker/実WebSocketの旧画面は最大65,525B・余裕11Bから、60KiB予算へ。最終の旧画面密集は61,372B以下・余裕4,164B以上。敵97・弾100・経験値160・地雷20を保持。旧画面の超過は更新案内＋4000、現行は分割し、人工1000弾まで全状態を復元。全合法状態が256KiB以内という証明は残る。 |
| 2. 高負荷時の入力 | 改善したが残る（数値） | 通常生存4接続/描画1画面60秒では入力最大111.7ms、250ms超/猶予外ACK=0は全員0。人工混在の描画1画面では最大813.1ms、4画面では最大2546.8msが残る。上り1000B/sの解除受理は932.5〜967.5ms。スマホ4台の結果へ換算しない。 |
| 3. 単発の描画待ち | 実機確認待ち | HARROW突進予告の描画容量例外は修正前失敗/修正後成功。修正後の人工混在4画面は例外0だがRAF最大550.2ms、1画面でも499.9ms。通常生存60秒は最大66.6ms・100ms超0。過去の150/499.9msと同じ原因とは未確定。 |
| 4. 着弾抜け・消失 | 解消（証拠あり、特定した症状） | 旧コードで敵弾100時の空発射・ロケット球通過・省略中の受信済み敵消失を再現し、同じ試験で現行成功。実通信でも全敵・弾を復元。未知の別原因や実機全症状の解消は主張しない。[回帰照合](regression.md)。 |
| 5. サーバー負荷・無料枠 | 改善したが残る（数値・条件付き試算） | 人工混在49体/描画1画面のローカルDO tickは中央値17/p95 38/最大59ms、下り4人合計475,529B/s。4画面は25/72/164ms。1時間のDO実行時間は460.8GB-s、通常入力＋pingは14,544要求相当。実アカウントのDO残量・実クラウドCPUは未取得。現在契約は本人がFree継続と回答。 |

本人用の手順は[5分のOPPO Find X8・ホーム画面版チェック](device-check.md)。Wi-Fi固定36で解消済みの約15秒周期停止と、公開済みの自機予測は再調査していない。前者は11/02の本人確認を維持する「製品外の要因（根拠あり）」で、今回の未解決な単発停止へ一般化しない。

## 64KiBの方針比較と採用

| 案 | 判断 | 理由 |
| --- | --- | --- |
| 旧方式を64KiBぎりぎりまで維持 | 不採用 | 実通信でも余裕11B。演出削減後もcoreが超えると4009となる。 |
| 敵・HP・経験値などを省略して旧画面を延命 | 不採用 | 未受信の敵や古い位置が残り、今回守る判定状態と表示の対応を保証できない。 |
| 上限を上げる/無条件に旧画面を拒否する | 不採用 | 受信側の既存制限を変える必要、または小さい通常状態まで接続を失う。 |
| 60KiB予算＋交渉済み分割、非対応は収まる間だけ継続 | 採用 | 4KiB以上の転送余裕を確保。coreを削らず、超過した旧画面へ再読込みを案内する。v1 tupleも予算内なら継続。 |

64KiBの受信上限・256KiB/16片・checksum・2秒期限は維持。60〜64KiBを早期に分割する対応をhelloの追加項目stateChunkBudget:1で通知する。通知のない旧分割対応画面も、coreが60KiBを超えたときは更新案内へ進む。これにより旧受信側の「分割は64KiB超」という制約を壊さない。古い演出から減らす順も従来どおり。命中・HP・撃破、敵の識別、攻撃予告、報酬・保存形式・250ms入力期限・35件/秒制限は変えていない。

新しい60KiB分割試験が、受信側に残っていた64KiB超という条件を検出した。対応通知と受信の下限を整合し、関連87件・実Worker14項目を成功。通知のない旧分割側と通知ありの現行を、550/1000弾でも比較し、旧側は更新案内、現行は全状態を復元した。[旧分割との実通信](chunk-compat.json)、[境界の修正前](wire-before.json)、[修正後12条件](wire-after.json)。

実通信は4人×旧object/v1/current/混在の12条件、弾100/400/1000。1000弾は合法最大という主張ではなく超過注入。旧object400弾は修正前4接続とも4009、修正後は部分stateを送らず更新案内。混在時の現行3接続は継続。更新後の同じtokenで同じ隊員・敵97/弾400を受信した。初期記録では終了後のイベントが生配列参照へ混入し得たため、原本のerror1件は保持。配列を計測終点で固定し、復帰後300msまで接続を開いた追加試験では同じ隊員・敵97/弾400・エラー0を確認した。[復帰の最終確認](recovery.json)。

## 負荷計測の条件と限界

実ローカルWrangler/workerd、実WebSocket、Chromeの独立4プロセス、844×390、既存Renderer/FrontNetwork/NetworkInputLoopで計測。描画1画面＋通信専用3接続と4画面を対照にした。通信専用側もブラウザプロセスを使い、スマホ3台を再現するものではない。全件試験や別の重い検証と並行実行していない。

人工混在はseed4520、PLEAT40・BASTION3・HARROW3・CATENA3、弾100、経験値160・地雷20から開始。耐久を上げて生存密集を保ち、以後のstep・予告・命中・配信は製品処理。通常の生存マップにCATENAの巡回経路がないため、このストレス条件だけローカル検査口で既存進撃草原を使用し、client/server双方を揃えた。自然に生成される生存戦や合法同時最大の証明にはしない。現行生存は敵上限48＋予備1、A-1の旧互換試験は96＋予備1で、製品上限を今回変えてはいない。

| 条件 | 入力間隔最大（4人中最大） | 猶予外ACK=0（4人順） | 描画RAF最大 | ローカルDO tick 中央値/p95/最大 | 合計下りpayload |
| --- | ---: | --- | ---: | --- | ---: |
| 人工混在・描画1・45秒 | 813.1ms | 5/2/2/6 | 499.9ms | 17/38/59ms | 475,529B/s |
| 同じ人工混在・描画4・45秒 | 2546.8ms | 41/40/41/38 | 550.2ms | 25/72/164ms | 119,073B/s |
| 人工混在・描画1・上り1000B/s・片道75ms・30秒 | 2603.2ms | 17/14/2/4 | 533.2ms | 12/23/69ms | 123,023B/s |
| fixtureなしの現行生存・描画1・60秒 | 111.7ms | 0/0/0/0 | 66.6ms | 対象外 | 180,469B/s |

開始前をまたぐ最初のRAF間隔は全員1件ずつ除外し、長いframeも開始・終了が計測窓内のものだけを集計した。元のraw最大値は保持している。入力の猶予外は両端がcombat/bossで同じ再開猶予、serverNow > resumeUntil+1秒。受理ACKは実inputWindow.acknowledgeのseqと送信時刻を対応させる。適用ACKとは分ける。旧検査のraw全量stateだけを見る受理値はdeltaを取りこぼすため参考値に分離した。

描画4ではゲーム進行・受信更新も遅い。下り減少を圧縮率改善とは扱わない。seed・開始人数/構成・回線条件は揃えたが、自動操作は時系列の受信状態に反応するため入力列そのものは完全一致しない。GPU/CPUを4ブラウザとローカルWorkerで共有し、試行は各1回。スマホ性能・クラウド容量・改善率は推定しない。

tickはTestRoomの実Room.tick呼出し前後をperformance.nowで測り、step・broadcast/encode/sendを含む経過時間（1ms粒度、最大4096標本）。課金用の実クラウドCPU時間ではない。ローカルはI/Oなしでも時計が進む。[公式のローカル計測説明](https://developers.cloudflare.com/workers/runtime-apis/performance/)。

## 検査中の失敗と未採用

- 深いWindows保存パスのWorker内部500は、今回専用の短い `repo/output/close-do` で解消。旧データ・他プロセスは削除していない。部屋作成失敗を実通信成功へ数えない。
- 検査器の装備pool欠落、PNG読込み未対応、旧2武器準備判定、CATENAの非対応生存地形を修正。製品ガード・認証を緩めていない。
- 初期mixed-render1-profile/mixed-render4は地形が片側だけ異なり主比較から除外。後者の描画容量例外は正規HARROWの小数座標でも独立再現でき、dashFillsを1024から既存共通上限4096へ拡張。13枠は固定、追加バッファは約1.83MiB、形/予告/判定は不変。上限チェックの削除・例外の握り潰し・予告削除はしていない。
- 入力窓や失効時間を推測で緩める案、敵/攻撃/予告を減らして合格にする案は採用しない。通常生存の60秒成功を、人工密集や単発待ちの恒久解消へ読み替えない。

## 証拠と再現

最終 `npm run typecheck`、`npm test`（1769件/174ファイルすべて成功、341.06秒）、`npm run format:check`、`npm run build`、`npm run server:build` は全て終了コード0。[終了コード](checks/summary.json)、[全件テスト](checks/test.txt)、[実Worker14項目](checks/integration.txt)。新規の早期分割試験が初回の全件で検出した1件は対応通知/受信条件の整合で解消し、全件を再実行した。初回の失敗原本はGit除外 `dist-validation/coop-comfort-close-20261113/initial-full-test.txt` に保持。検査口は本番用Worker bundleに含まれないことを確認した。

GitHub正本は https://github.com/futsalife24-bot/swarm-front 、ローカルは `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-coop-comfort-close-20261113`。

実製品UIのHARROWレポートでDash選択・モデル・説明を確認し、同じHarrowEffectsを使うことも照合した。[レポート画面](harrow-report-dash.png)。ソロの開始/移動と、非公開自室の2人入室/デッキ準備/出撃/移動は画面例外0。[協力結果](local-coop-ui.json)、[ソロ](local-solo.png)、[協力](local-coop.png)。協力UI検査は既存検査に合わせprefers-reduced-motion:reduceを使用。通常演出の早押しで画面切替待ちになった初期試行は原本に残し、通常演出の全手順の成功とは読み替えない。

旧profileの計測窓内の最大216.7msをCPU標本と受信時刻5点で照合すると、約175.3msがgetProgramInfoLogだった。[推定照合](cpu-profile-analysis.json)。人工混在を後から投入した初期のシェーダー準備待ちが一部を占める推定であり、地形不一致の旧試行・sampling位置ずれを含む。この結果を、以前の499.9ms・約96% idleの原因確定や、修正後に残る499.9/550.2msの説明へ一般化しない。

匿名集計は[measurements.json](measurements.json)、回帰は[regression.md](regression.md)。生データはGit除外 `dist-validation/coop-comfort-close-20261113/`。部屋ID・token・入力本文を公開証拠へ保存しない。

```powershell
node scripts/setup-local.mjs
node node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.test.jsonc --port 8796 --inspector-port 9346 --persist-to ../output/close-do
node scripts/measure-coop-comfort-close.mjs
# 別のshellでSWARM_LIVE_ENDPOINT=http://127.0.0.1:8796と各条件を設定
# SWARM_LIVE_FIXTURE=mixed / SWARM_LIVE_RENDER_CLIENTS=1または4 / SWARM_LIVE_SECONDS=45
# SWARM_LIVE_NETWORK_TIMING=1 / SWARM_LIVE_GL_PROBE=end / SWARM_LIVE_OUTPUT=試行別の保存先
node scripts/check-coop-live.mjs
node scripts/summarize-coop-comfort-close.mjs
node scripts/check-coop-comfort-regression.mjs
```

主担当の実モデルID/effortは未確認。補助は `gpt-6-sol/medium` 指定、実行値未確認。補助担当の旧版回帰・集計・読取りレビューを主担当が差分確認し、統合検証を担当。通常Chatの独立監査ではない。
