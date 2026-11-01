# 更新停止の再調査（進行中）

## 対象と承認

本人は公開後も解消しないと申告し、新動画を共有。サブエージェントによる徹底調査、必要な修正・公開、PLEAT等のポリゴン数/動作滑らかさを落とす軽量化を明示承認。goalは実機の同等条件で快適さを証明するまでactive。敵数・難易度の削減や未確認のスマホ改善を成功扱いしない。

- 調査基点main: `aaf436cd126d360546682c49ad2304c82c3303c2`
- 前回公開ソース: `334c736b000c635e719f4b9d2b9b78d2c55eb697`
- 作業branch: `codex/lag-root-cause-20261101` / worktree `task-lag-fix`
- 本人申告: OPPO Find X8、Wi-Fi、ホーム画面に追加したゲーム。更新してから録画したはずとのこと。
- 原本: https://drive.google.com/file/d/1dwae7cPRTt1lg9WZs4HImA2kHHVsOlbK/view
- 動画ローカル: `dist-validation/lag-root-cause-20261101/video.mp4`（158757895 bytes、82.410667秒、Git対象外）

## 動画から分かったこと

全編を5秒間隔の画面一覧と5fpsのHUD一覧411枚（`hud-0.jpg`〜`hud-8.jpg`）で確認。戦闘中は主に59〜60FPS。停止候補は約17秒、32秒、48秒、62秒、77秒でほぼ15秒周期。約48秒のHUDは59FPS/往復42ms/更新待ち1201ms。これは表示更新時点の値で停止全長ではない。更新2/sや4/sの区間もあり、60FPSだけで快適とは判断できない。約62秒では残弾24が複数サンプル固定し、その後15へ進む。射撃の継続を支持するが、上り/サーバーが全瞬間無停止との証明ではない。停止の厳密な開始・終了時刻は追加確認中。

15秒周期に合う既存コードは `cloud-save.ts` の同期確認。ただし未連携/同期済みならネット通信をしない。保存先Gate DOはRoom DOと別なので、GateのstorageがRoomのoutput gateを直接塞ぐとは言えない。端末CPUの1秒停止だけならFPS継続とも合わない。現段階は周期相関であり原因確定ではない。

## 版の確認

前回配信検査 `lag-release-20261101/delivery.json` は2026-11-01 20:36:19 JST。動画名の撮影時刻は20:39:43 JSTなので公開後。録画にbuild番号がなく、端末の実行版は未確定。古い版だったと扱う証拠はない。

`node scripts/check-sw-version-switch.mjs` で実 `public/sw.js` を使い、同一SWのままHTML/hashed JSだけ旧→新にする隔離Chrome実験。開いたまま=旧版、オフライン再読込=旧版、オンライン再読込=新版を確認。本人キャッシュ/保存は不使用。初回はsandboxのloopback拒否、正式エスカレーション後は到達。初回未制御ページにfrontキャッシュがない問題を試験側で修正し、SW制御下で確認した。

## 描画調査

PLEAT v5実体は11304三角形/18784頂点、4メッシュ/4材質、20骨。InstancedMeshなので個体数によるdraw call増殖が主因とは言えない。10Hzで届く位置へ毎フレーム指数平滑しており、定速でも表示速度に周期的なむらがある。

`node scripts/measure-enemy-motion.mjs` は理想定速/反転モデルの比較で実機計測ではない。100ms受信で現行のフレーム移動量CV0.649、平均遅れ75.5ms。100ms上限の速度外挿はCV0、遅れ33.9msになる一方、反転時最大誤差0.373→0.531mへ悪化。固定時間補間は遅延追加を伴う。停止根因と別で射撃位置ずれを悪化させるため、製品への外挿採用は見送った。ポリゴン削減も現時点ではこの15秒周期停止の解決と称さない。

## 追加診断（公開済み、実機記録待ち）

実行build SHAと端末条件、受信メッセージ/受理状態/描画間隔/入力確認/クラウド同期確認の有限時系列を端末からJSON保存する。部屋ID・token・名前・入力内容・保存本文を含めず、自動送信しない。400ms超の受理空白の直前を6件まで保持する。

詳細診断を明示オンにした接続だけ、サーバーtick・encode・ws.send呼出・ACK・Room.persist開始終了を最大128件/8192 bytesの数値履歴として異常後に付ける。同期CPU中にDate.nowが進まない本番制約から、CPU時間や実配送完了とは呼ばない。通常接続にtraceを付けない。設定オン後の次の接続に適用。

## 担当と残り

主担当は動画・端末診断・統合/公開。描画/PWA担当とサーバー担当に `gpt-6-sol` / `high` を指定（実行側モデル設定は未確認）、再委任なし。重いPC実測を同時実行せず競合を避ける。実機時系列採取、停止箇所の確定、必要修正と前後比較は未完了。


## 追加診断の検証記録

- 関連単体4ファイル54件成功、クライアント/Worker型チェック成功。
- 旧JSON/v1/v2混在4clientの実Worker試験1件成功、20件は対象外としてskip。詳細診断はv2の指定接続だけに付き、他3接続には付かない。
- 通常PC実戦86.484秒: 画面例外0、戦況受理間隔最大164.5ms（harness観測範囲）、400ms超incident0、cloud確認6回。端末最後128サンプル集計とは観測区間が違うため最大値を混同しない。
- 下り停止注入PC実戦101.547秒: 画面例外0、最大受理空白1255.2ms、異常historyと診断保存成功。保存JSON約301KB。既知の下り停止に対しサーバーtick継続・pendingWrites0・clockDropped0の履歴を取得できた。
- 生記録: `dist-validation/lag-root-cause-20261101/runs/`（Git除外）。採用集計は [browser-summary.json](browser-summary.json)。`baseline-trace-ui` は途中Worker再読込のため不採用。`baseline-frozen` は戦闘測定後のpauseクリックで視点領域に遮られ、保存UI試験は失敗。後続試験ではPC用Escapeを使い保存成功。タッチpauseは別途確認中。
- 最初のnetwork単体21失敗は診断フラグがglobal locationに依存した実装ミス。constructor引数へ移し49件成功、その後設定オン/オフ等を加え54件成功。テストを弱めていない。

再現コマンド:

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.front.config.ts tests/front-diagnostic-export.test.ts tests/front-network-input.test.ts tests/front-connection-diagnostics.test.ts tests/front-room-network-trace.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.json
node node_modules/typescript/bin/tsc -p tsconfig.worker.json
node node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.lag.jsonc --port 8837 --inspector-port 9337 --persist-to dist-validation/lag-root-cause-worker
node node_modules/vite/bin/vite.js --config vite.lag.config.ts --port 5317
$env:LAG_REP='frozen'
$env:LAG_OUT_ROOT='dist-validation/lag-root-cause-20261101/runs'
$env:LAG_CHECK_DIAGNOSTIC_EXPORT='1'
node scripts/lag-resilience/trace-coop.mjs baseline 85
node scripts/lag-resilience/trace-coop.mjs down-pause 100
# fixture Worker 8838起動後
$env:SWARM_TEST_SERVER_URL='http://127.0.0.1:8838'
node node_modules/vitest/vitest.mjs run --config vitest.front-integration.config.ts -t 'PLEAT姿勢の新旧JSON'
```

Cloudflare同期時計/ゲートの制約は [公式DO規則](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) を参照。公開後の本人端末データで切り分けるまで、15秒周期をWi-Fi/端末/クラウド保存のどれかに断定しない。


公式資料の追加調査では [OPPO Wi-Fi Assistant](https://support.oppo.com/ae/answer/?aid=neu4992)、[Android Wi-Fi scanning](https://developer.android.com/develop/connectivity/wifi/wifi-scan)、[Chrome背景timer](https://developer.chrome.com/blog/background_tabs)、[Cloudflare WebSocket](https://developers.cloudflare.com/network/websockets/) に今回の前景PWA・15秒周期停止を特定する記述は見つからなかった。OS/無線を否定する証拠でもないため、端末設定変更を根因修正として扱わず、実機時系列を優先する。


## 本人への進捗表示

本人の希望で以降10%刻みに報告する。割合は改善率/所要時間予測ではなく、確認済み工程の目安。現在30%: 10%=新動画/周期の把握、20%=端末/サーバー診断の実装・既知停止の記録検証、30%=設定のタッチ操作と診断保存を検証し診断版公開。以後の目安は40%=実機時系列取得、50%=原因の再現/反証による特定、60%=原因に対応する修正、70%=同条件ローカル前後比較・回帰確認、80%=修正版公開/配信確認、90%=実機同条件前後確認、100%=残る問題を解消し快適な実機動作を確認。証拠不足の段階を完了へ繰り上げない。


動画の追加目視: `ffmpeg -ss 61.8 -t 1.8 ... -vf "fps=8,scale=594:-1,tile=3x5"` の `freeze62.jpg` で、視点/自分の表示が動く間も残弾24・時計1:29が固定され、その後残弾15/時計1:30に進むことを確認。`-ss 46.8 -t 2.8` の `freeze48.jpg` は強化選択終了→59FPS/更新待ち1201ms→状態再開で、再開後もしばらく古い1201ms表示が残る。HUD表示の残留を停止継続と扱わない。切出しはGit除外の同動画保存先。


タッチ設定追加確認: 844×390/640×360で詳細診断のオフ→オン→オフ、保存値null→1→0、版f87a35c案内を確認（[settings-touch.json](settings-touch.json)）。最初の操作無反応は画面遷移の入力ガード中だったため、試験をレイヤー終了待機へ修正しassert付きで合格。CSS変更なし。先行のタッチ2条件/PC fine844のpause実クリックも成功。通常PC86秒試行のpause失敗を恒常的なCSS不具合とは断定しない。

## 診断版の公開記録

[PR #251](https://github.com/futsalife24-bot/swarm-front/pull/251) を通常merge。実装head `1c0a20af1529272df6e847a50272117052faec16` とmerge後ソース `b645183c1d60d3eeb351b8e142d206f08f05683a` のツリー一致を確認。GitHubチェック0件でありCI合格とは扱わない。既存Worker Versionは `54e4881b-82d0-4091-88af-47d3ab9a957f`。

2026-11-01 21:25:35 JSTに公開27ファイルSHA一致、health 200/ok、空Chromeの844×390でソロ起動・移動・画面例外0、実行clientBuildが上記ソースSHAと一致。[配信検査](delivery.json)、[公開画面](published-844.png)。公開ビルドとWorker dry-run成功（462.63KiB、gzip118.27KiB）。既存の500KB超chunk警告は残る。診断は既定オフで、停止の根因修正・実機改善は未確認。

```powershell
node node_modules/vite/bin/vite.js build
node node_modules/wrangler/bin/wrangler.js deploy --config wrangler.production.jsonc --dry-run
node node_modules/wrangler/bin/wrangler.js deploy --config wrangler.production.jsonc
$env:SWARM_RELEASE_EVIDENCE='docs/evidence/lag-root-cause-20261101'
$env:SWARM_WORKER_VERSION='54e4881b-82d0-4091-88af-47d3ab9a957f'
$env:SWARM_EXPECT_BUILD='1'
node scripts/check-coop-response-release.mjs
```

本人にはホーム画面版を再読込→タイトル「設定・操作」から詳細診断オン→版b645183確認→同じWi-Fiで約1分プレイし症状後に一時停止→「通信診断を保存」→JSON共有を依頼。クラウド保存利用の本人回答は「分からない」で、未使用とは扱わず実際のrequestイベントで判断する。診断には自動アップロード・保存本文・認証値を含めない。

公開記録branch `codex/lag-diagnostic-release-20261101`、ローカル `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-lag-fix`。GitHub正本は https://github.com/futsalife24-bot/swarm-front 。実機記録後は端末の受信・描画・クラウド送信と、サーバーtick・保存・送信呼出・ACKの順序を照合する。

ローカル解析器 `scripts/analyze-network-diagnostics.mjs` は保存JSONを読むだけで通信しない。`node scripts/analyze-network-diagnostics.mjs dist-validation/lag-root-cause-20261101/runs/down-pause-frozen/diagnostic-export.json` の結果を [injected-diagnostic-analysis.json](injected-diagnostic-analysis.json) に保存。サブエージェントの独立読み取りレビューにより、別々の有限履歴を混ぜた接続全体の相対遅延計算を取り除き、各incidentの連続記録内だけを基準にした。server historyは時刻の近い候補として列挙し、自動的な因果対応とは扱わない。結果/再出撃/選択中の状態空白も含み得るため動画・操作状態との照合を要する。現packetの送信履歴は含まれず、HTTPの開始が離れているとcloudNearが空でも送信待ちは否定できない。既知の注入4件は約658/1255/643/583ms、各server履歴の最大tick間隔63/62/62/74ms、保存開始0・clockDropped0で注入条件に整合。実機の根因証明とは区別する。
