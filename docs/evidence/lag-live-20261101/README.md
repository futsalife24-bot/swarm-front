# 本番の更新停止とWi-Fi経路の照合（2026-11-01）

## 同条件の実機で停止解消を確認（2026-11-02）

本人は36チャンネル反映後、同じOPPO Find X8・Wi-Fi・ホーム画面版の協力プレイ1～2分で「止まらなくなった」、さらに約5分でも「止まらなかった」と回答した。PCの3分測定でも約15秒周期の失敗が観測されなくなったことと整合する。今回の再現条件で快適に遊べることを確認。観測期間を超える無停止の保証や、DFS・電波干渉等の物理原因の特定とは区別する。

採用した対処は5GHzの自動/52から固定36への変更。ファームウェア・帯域80MHz・認証方式は変更していない。改善を確認した公開ソースb645183/Worker54e4881bを維持する。匿名サーバー観測は今回の解消には不要と判断し、codex/lag-live-trace-20261101に実装・検証記録を保管して未採用とする。調査の記録と再現用スクリプトだけをmainへ反映し、追加デプロイは行わない。記録と再現用スクリプトのmain反映先は[PR #255](https://github.com/futsalife24-bot/swarm-front/pull/255)、記録branchはcodex/lag-resolution-20261102。匿名ログ抽出2テスト、追加スクリプト構文、JSON構文、数値照合、diff check成功。GitHubチェック0件でCI合格とは扱わない。元の診断PR #254は未採用として終了し、branchは保持する。以下の実機結果待ち・PR draftは測定中の履歴。

本人がルーターへのログイン・設定確認を明示承認し、再試行を依頼。通常のブラウザー経路でログイン後、5GHzの保存値 `36`、PCの実接続 `Channel 36` を測定の前後で確認した。元の設定は自動・実接続52、帯域80MHz。今回の比較で操作した無線項目はチャンネルのみ。前のターンでは保存確認前にWindowsブラウザーのURL安全確認が停止したため、当時は未確認と報告した。正確な適用時刻は不明だが、今回の新規ログイン後の読み直しで保存済みと確認できた。安全停止を別ツールで迂回していない。ブラウザー接続の恒久復旧を証明するものではない。

36確認後の3分間ではgateway timeoutは **2/650（0.31%）**、公開DNSは8/650。変更前の配置不変3分は45/563（7.99%）、直前1分は14/189（7.41%）だった。PCからルーターへの到達は大きく改善したが、時刻・周辺通信量を固定した比較やA→B→A再現ではない。DFS検知、干渉、ルーター内部処理のいずれを解消したかは未特定。OPPOでの同じWi-Fi・協力1～2分の結果を本人へ依頼中。PCの結果をスマホ改善・長時間の快適性・goal達成と扱わない。工程目安70%。

集計は [変更前](router-before-summary.json) と [36確認後](router-after36-summary.json)。生データはGit除外の `dist-validation/lag-live-20261101/route-1793546725628/probes.json`。画面証拠は同ディレクトリ直下 `router-channel36.jpg`（チャンネル欄のみ、認証情報なし）。確認コマンドは `netsh wlan show interfaces` のチャンネル等だけを抽出、および `./scripts/trace-route-probes.ps1 -Seconds 180`。変更前3本には全件 `endAt` があり、timeout指定500msと実際の呼出所要を区別する。設定操作中3分は反映時刻が不確かなため、比較の主基準にしない。

追加照合: 36確認後の成功gateway RTTはp95 5ms・最大105ms。UTCの00/15/30/45秒境界±1秒に開始した失敗はgateway/公開DNSとも0/89件で、変更前に観測した約15秒周期の失敗は今回の3分では観測されなかった。定常的に解消した証明とは区別する。

製品コード・公開版は変更していない。作業branch/基点・公開SHAは下記のまま。PR #254はdraft・未merge・未公開で、診断実装は既存検証済み。Wi-Fi比較中の公開条件を維持している。写真、SSID、MAC、キー、管理パスワードはGit記録に含めない。以下の「ログイン許可待ち」「パスワード未入力」は前回記録で、今回の承認・ログインにより解消済み。

機器確認の追記: 写真から `BUFFALO WSR-3200AX4S/NBK`、管理画面のログイン前表示から `Version 1.47` を確認。[公式の現行ファームウェア](https://www.buffalo.jp/support/download/detail/?dl_contents_id=62205)も1.47で、更新は実施しない。本人はケーブルが短く設置場所の移動はできないと回答。5GHz ch52はDFS対象だが、典型的なレーダー検知後の約60秒停止と今回の約1秒は異なり、根因と断定しない。ログイン後に現在のチャンネル設定・帯域誘導等を読む方針。ブラウザー操作規則に従い、写真の管理用情報を当該ルーターへ入力してログイン・設定確認する許可を本人へ依頼した。パスワード未入力、設定変更・再起動なし。写真・SSID・MAC・暗号化キー・管理パスワードはGit記録に含めない。先の型番未確認は解消。

本人の追加回答: OPPOのモバイル回線による協力1人・約1分では「正直カクつかなかった」。同端末のWi-Fiでは何度も停止しており、共通Wi-Fi経路を優先する判断を補強する。端末JSONや回線以外の完全同一条件は未検証、1分で長時間の快適性は証明しない。工程目安は60%へ更新。本人提供の機器写真はTV裏の狭い配置を示すが、故障・過熱・干渉原因を写真だけで断定しない。接続先の未ログイン画面はBUFFALOと確認、型番未取得。認証・設定変更・再起動は行っていない。

保存済み実装HEADは `c8e8c2ca5a4f0f8e541103d56ca270bf48ea3fef`、[ドラフトPR #254](https://github.com/futsalife24-bot/swarm-front/pull/254)。remote一致・worktree cleanを確認。GitHubチェック0件で、CI合格とは扱わない。実装commit後のproduction buildとWorker dry-run（467.68KiB、gzip119.59KiB）も成功。既存のchunkサイズ警告は継続。本番は比較条件を固定するため未更新、merge未実施。

公開クライアント/サーバーの対象ソースは `b645183c1d60d3eeb351b8e142d206f08f05683a`、Worker Versionは `54e4881b-82d0-4091-88af-47d3ab9a957f`。作業基点はmain `852906439faf895796adef1cd7efe1a24f6819de`、branchは `codex/lag-live-trace-20261101`、worktreeは `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-lag-fix`。GitHub正本は https://github.com/futsalife24-bot/swarm-front 。本節は原因調査の記録で、スマホで快適になったという完了報告ではない。

## 現時点の結論

本人提供の検証部屋へPC Chromeで参加し、障害注入なしで約1秒の受信停止を再現した。初回25.41秒は計測スクリプトが強化選択待ちを終了と誤認してブラウザを閉じた。本人が指摘した切断はこの計測側の不具合であり、自然切断に数えない。スクリプトを修正し、別の検証部屋で120.419秒、画面例外0件で測定を完了した。

2回目の700ms超の状態空白8件のうち、7件は空白中に開始したPC→ルーターのICMPが `TimedOut`。残る1件は空白開始229ms前にtimeoutとなるpingを開始しており、近接はするが厳密な重複は未証明。8件中7件で別HTTPS `/api/health` も318～1117ms遅れ、完了が状態受理再開の約1.6～6.7ms後に集中した。描画間隔の最大値は各窓で約17～83msであり、700ms超の主スレッド停止だけでは説明しにくい。[集計](second-live-route.json)。

さらにPCで計測ブラウザを閉じた後の120秒でも、ルーターへのping390件中25件、公開DNSへのping390件中10件がtimeoutだった。[ゲーム終了後の集計](idle-route.json)。ゲームの高い通信量や描画が発生している時だけの現象ではない。ただし他端末の活動はこの測定では管理していない。

本人は「PCとOPPO Find X8は同じWi-Fi名」「2回目の約2分間、スマホでも何度も止まった」と回答。PCの無線はIntel AX211、5GHz、channel52、802.11ax、電波強度86%、ドライバー24.60.0.3。907～1081Mbps等の表示はリンク速度で、実効速度や安定性ではない。同SSIDでも同じAP/BSSID・電波条件とは限らない。

**優先候補はPC～Wi-Fiルーターを含む共通の通信経路。** ゲームRoom固有の状態生成だけ、PLEAT描画負荷だけ、クラウド保存だけを主因とする説明は実測に合わない。一方、Wi-Fiアダプター、OS、AP、ルーターのどこが原因かは未特定。ICMP優先度や一時損失の影響もあり、無線が空白全長で完全切断したとは言えない。スマホのモバイル回線比較は本人が実施可能と回答し、結果待ち。

## サーバーと端末の時系列

[初回の詳しい照合](first-live-analysis.md)に、918.1/1127.2msの空白と各stateIdの送信呼出・受信・ACKを記録した。同じ状態列の送信間隔と受信間隔の差は698.1/1039.2ms。tickは約50msで継続し、pendingWritesとclockDroppedは0、保存開始/完了は記録されない。既に送信呼出された状態とcontrolが端末でまとめて届く。`ws.send`成功は物理配送完了を保証しない。

未ACK2枠の詰まりはこの遅延を受けて後続送信を止めるが、先に送ったデータが到着しない時間の説明にはならない。traceの推定増分は受信量の約5.7%、大きい履歴2件は空白終了後に届いた。初回はHTTP/ICMPの追加probeなしでも再現しており、追加probeだけが現象を作ったとは考えにくい。敵数・難易度・35件/秒制限は変更していない。

## 新動画の時刻とCloudflare実績

既存Wrangler OAuthを正規に更新し、同じアカウントの読み取りAPIで20:39～20:42 JSTのDO集計を取得した。[匿名集計](cloudflare-summary.json)、[Room照会](video-window.graphql)、[Gate照会](gate-window.graphql)。

この窓のRoomは1 object、呼出2148件が成功、CPU/メモリー/内部fatalエラー0。server scriptVersionは前回耐性修正の `3f46e046-54d3-412c-9659-a5a498c6d07d`。periodic集計のCPU合計10.47秒、active約124秒。1分集計なので短時間のCPU停止は排除できず、invocation wallTimeはCPUや停止時間と同義ではない。cloud-admissionの呼出行は0。動画の端末側ビルドは未確認だが、撮影時のサーバーは前回修正版に整合する。本人の部屋との厳密なID照合はしていない。

公式根拠: [DO metrics](https://developers.cloudflare.com/durable-objects/observability/metrics-and-analytics/)、[GraphQL discovery](https://developers.cloudflare.com/analytics/graphql-api/features/discovery/introspection/)。

## 計測と再現

生データはすべてGit除外の `dist-validation/lag-live-20261101/`。初回 `1793538631405/trace.json`、2回目 `1793539440319/trace.json`、同時ICMP `route-1793539473973/probes.json`、終了後ICMP `route-1793539793379/probes.json`。画像やロビー失敗時のスクリーンショットには部屋情報が映る可能性があるため公開成果物に含めない。トークン・送信本文・ヘッダーは保存しない。

```powershell
# 通常のOAuth更新。出力はGit除外の作業ログへ保存した。
node node_modules/wrangler/bin/wrangler.js whoami
node scripts/read-lag-cloudflare-metrics.mjs video-window docs/evidence/lag-live-20261101/video-window.graphql
node scripts/read-lag-cloudflare-metrics.mjs gate-window docs/evidence/lag-live-20261101/gate-window.graphql
node scripts/summarize-lag-cloudflare-metrics.mjs
# 本人提供コードは環境変数SWARM_LAG_ROOMへ設定し、値を記録しない。
node scripts/trace-live-coop.mjs 120
./scripts/trace-route-probes.ps1 -Seconds 180
# 上の計測完了後、PCゲームを閉じたまま追加で120秒測定。
./scripts/trace-route-probes.ps1 -Seconds 120
node scripts/summarize-live-route.mjs dist-validation/lag-live-20261101/1793539440319/trace.json dist-validation/lag-live-20261101/route-1793539473973/probes.json
```

初回ICMPは開始時刻・status・RTTのみ。timeout設定500msを実測の継続時間とみなしていた集計を訂正し、初回データは開始点だけで状態空白と照合する。今後のprobeでは実際の終了時刻も保存する。状態空白は強化選択/再開を含み得るため、入力0や状態頻度だけを回線停止と解釈しない。

## 匿名サーバー観測の準備

端末JSONがなくても状態の未確認待ち・tick遅れ・保存遅れを調べられるよう、`RoomLagObserver`を準備した。数値16項目だけ、部屋ごと10秒以上の間隔・最大64行、保存本文/名前/部屋コード/tokenなし。通常通信・保存形式・流量制限は変更しない。既存OAuthの短時間tailから専用数値だけを抽出し、HTTPヘッダー等の生tailは保存しない。

単体12件、worker型検査成功。隔離した実Worker8838で既存の「新通信は戦況2枠」「PLEAT姿勢の新旧JSON」2項目が成功し、未確認2枠・402ms待ちの数値ログを実際に確認した。Worker51108と子プロセスは検証後に停止。レビューで指摘された再接続時の旧WebSocket Map参照残りを修正した。

tailは既存本番へ15秒接続→自分のtailだけ削除に成功。記録0件、closeCode1006であり、**本番の診断ログ取得成功の証明ではない**。現公開コードにはこの観測器は未反映。10秒制限は同時間帯の別異常を隠し得る、保存記録は完了時点の状態、匿名ゆえ複数部屋を厳密同定できないという限界がある。[公式のリアルタイムログ仕様](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/)ではWebSocketログが終了まで出ない場合があり、無ログを正常と扱わない。

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.front.config.ts tests/front-room-lag-observer.test.ts tests/front-room-network-trace.test.ts tests/front-lag-tail-filter.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.worker.json
node node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.lag-test.jsonc --port 8838 --inspector-port 9338 --persist-to dist-validation/lag-live-20261101/observer-fixture
$env:SWARM_TEST_SERVER_URL='http://127.0.0.1:8838'
node node_modules/vitest/vitest.mjs run --config vitest.front-integration.config.ts -t '新通信は戦況2枠|PLEAT姿勢の新旧JSON'
node scripts/watch-room-lag.mjs 15
```

主担当の実モデル/effortは未取得。既存のサーバー・描画サブエージェント（起動指定gpt-6-sol/high、実行設定は未確認）で独立照合。通常Chatの独立監査ではない。進捗は工程の目安50%、実機の快適さは未確認。goalツールの記録は以前の入力待ちでblockedのまま、ユーザーの再開指示後は実作業を再開している。提供APIにactiveへ戻す操作がないため、ツール上の状態と実作業を区別する。
