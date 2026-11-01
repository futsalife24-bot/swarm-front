# 更新停止への耐性改善（2026-11-01）

## 範囲

本人の「有効なものから順に全て実装して」に基づき、診断、送信集中の抑制、情報を失わない通信量削減、4008切断の限定復帰を実装。敵数・難易度・攻撃・入力250ms失効・35件/秒の制限・保存形式は変更しない。動画の根因を確定した修正ではなく、実スマホの改善は未確認。merge・公開の個別承認条件を維持する。

- 正本: https://github.com/futsalife24-bot/swarm-front
- base: `27076b2cbdb48cdb4f0af707ffd3f96a9e73aee2`
- 製品実装・ビルド対象: `23a45783ac841cdf7e35a30a5e073974c312058e`（最終記録commitでも製品6ファイルは同一、`source-hashes.json`）
- branch: `codex/lag-resilience-20261101`
- worktree: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-lag-fix`
- 元root、dist-h、Claude・Codexの調査worktreeは編集しない。調査用seed固定や重いCPU記録を製品に取り込まない。

## 採用した変更

1. `connection-diagnostics.ts` / `front-app.ts`: 状態ID、受理時刻、入力・受信確認の番号、pong、RAF間隔、visibility、接続境界を4096件のリングに記録。フレームは通常250msごとの標本と50ms超の間隔。自動送信・保存、名前・token・操作内容の記録はしない。取得は既存の `?networkDiagnostics=1` と `window.swarmNetworkDiagnostics()`。返す配列はコピー、再接続の直前も保持する。`at` は端末のperformance.now、`state` のvalueはstateIdであり厳密なサーバー送出時刻ではない。RAF間隔はGPU時間ではない。visibilityはRAF停止中もイベントから記録する。
2. `state-receipt.ts`: 遅い戦況の単独ACKを即時送信する前に50ms同梱を待つ。通常入力の50ms間隔と短押しの保持は変更しない。単独ACKの10Hz上限は維持。遅延復帰時の通知集中を減らすが、どんな回線でも4008が起きなくなる保証ではない。
3. `state-delta.ts` / `worker.ts` / `front-network.ts`: 対応クライアントだけ `stateDeltaPlayers:1` を追加交渉し、v2差分の7番目で最大4人のプレイヤー情報をID対応で差分化する。順序、追加・削除、変更した値を復元する。精度・更新頻度・状態内容を変えない。v1は既定のまま、新クライアント→旧Workerも従来 `stateDelta:1` を維持。旧クライアントへv2を送らない。DOの接続attachmentに交渉結果を保持し、再開時も形式を維持。不適格な状態・大きくなる差分は全量へ戻す。既存のサイズ・深さ・作業量の上限と危険キーの拒否を維持する。
4. `worker.ts` / `front-network.ts`: 4008のerrorだけに数値codeを付与。新クライアントは既存tokenで1秒以上待って最大2回復帰する。他の致命的エラーは従来通り。再接続時は未送信の古い操作を破棄し、新しい入力から再開。退出後の予約再接続を取消す。認証、部屋の復帰期限、切断中の戦闘ルールを変更せず、無敵化や失った時間の巻戻しはしない。旧Workerがcodeを返さないerrorは従来通り終了する。

## 採用しなかった案

- 未確認入力が300msを超えたら4枠に縮める案: 下りだけが遅い場合にも操作送信を止めやすい。既存の「下り応答900msでも入力の空白250ms未満」の条件を守るため不採用。現在の上り受信時刻に基づく適応と最大16件の有限枠は維持する。
- 戦況送信枠2→3: 遅れた古い状態とメモリーを増やし、差分履歴の上限にも関係する。今回の動画根因を直す根拠がないため採用しない。
- トークンバケツへの変更: 流量制限の意味を変える案は採用しない。
- 敵の予測描画で停止を隠す案: 当たり判定との差や位置飛びを持ち込むため採用しない。
- tuple行をバイト比較で短縮する初案: 合成例では400B減ったが実ゲームfixtureでは0B。実ゲームでの採用根拠がなく撤去し、プレイヤー差分へ切り替えた。

## 検証

最終統合版で関連単体116件、実Workerの2項目（旧JSON・v1・v2の4人混在、および戦況2枠が埋まっている時の入力受信確認）、client/Worker型を確認。無関係な全件テストを合格扱いにしない。結果は `unit-front.txt` / `unit-wire.txt` / `integration.txt`。

通信削減の比較は同じ状態・同じACK順・同じ敵と操作で行う。実ゲーム生成器の単一移動更新でv1 2113B→v2 187B。ただしこれは他の値がほぼ変わらない比較で、通常戦闘の削減率ではない。実stepを20回進めた比較では、初回全量込み514142B→475624B、約7.49%減。全状態がv1/v2とも同じJSONに復元されることを確認した。この20step fixtureのboss wormは安全spawn経路がないため、両方式とも同じように除外した。製品の敵数を減らした改善ではなく、この条件での符号化比較に限る。実戦・実機全体の削減率へ外挿しない。

画面試験はPC Chrome 844×390、隔離Worker、協力1人の自然進行・射撃・移動・強化選択。Claudeの中継・記録器を自分のworktreeへ複製し、ポート・保存先を分離、stateIdの引数転送、実射撃assert、4008故障注入と復帰assertを追加した。製品をモックに置き換えない。Worker 8837/inspector 9337、Vite 5317、fixture Worker 8838/inspector 9338。生ログはgit対象外 `dist-validation/lag-resilience-20261101/runs/`。最終試験は `rate-burst-recovery-verified` と他3条件の `*-final`、途中試行とは区別する。

### 最終画面試験の結果

| 条件 | 壁時計の計測時間 | 射撃入力 | 最大戦況受理間隔 | 結果 |
|---|---:|---:|---:|---|
| 通常 | 65.78秒 | 1062 | 152.2ms | 切断・画面例外0 |
| 上り1200ms停止 | 65.99秒 | 1093 | 1143.1ms | 切断・画面例外0、中継の近似窓最大30件 |
| 下り停止 | 66.13秒 | 1054 | 1251.5ms | 表示停止は残るが復帰、切断・画面例外0 |
| 意図的な4008 | 35.16秒 | 565 | 1119.5ms | 同じ部屋へ再接続、状態受理まで1056.1ms、復帰後の新しい射撃338件 |

`browser-summary.json` に原記録のパス・SHA256、計測範囲、RAF間隔と時系列の件数を保存。4本とも早期終了なし、リング上書き0。計測開始後のRAF最大間隔は通常75.8ms、上り77.3ms、下り69.6ms、4008試験47.8ms。ただしPCの異なる試行であり、スマホの改善やFPS非劣化を証明するものではない。故障注入の試験は通常条件の遅延統計に混ぜない。中継の送出時刻はサーバー受信時刻の近似にすぎず、36件等の厳密なサーバー窓を示さない。

製品buildと本番設定のWorker dry-runが成功（457.65KiB / gzip117.04KiB）。500KB超のchunk警告は残り、警告を消すための上限変更はしていない。デプロイなし。`wire-measurement.txt` に同一状態比較の生の計測数値を保存。

## 失敗・限界

最初のPython編集はWindows既定文字コードで途中失敗したためUTF-8指定で再実行。単体の初回sandbox実行は一時変換ファイルENOENTがあり、通常ローカル実行で確認。実画面の初回はVite起動前に接続拒否、次は初回依存準備の読込timeout。依存準備完了後に進行できた。途中の上り停止試行は開発更新によるページ再読込で記録が消え、実射撃assert失敗として不採用。HMRを無効にし、製品コード固定後の試行を分離する。4008試験の初期assertは状態再受理までしか見ておらず、追加照合で復帰後の射撃0を検出。復帰時は既存の戦場読み込みと入力解除が入るため、固定300ms後のクリックでも早過ぎた。製品を変えず、実入力ループの再開を待って新たに押す試験へ修正し、射撃338件を確認した。これらの途中記録を成功試験に含めない。

Wi-Fi/Cloudflare経路のどこで止まったか、実スマホ性能、長時間・多数回の発生率は未確認。本番 `performance.now()` / `Date.now()` の同期処理中の時計制約もあり、tickMsを本番CPU時間と断定しない。

## 再現コマンド

```powershell
node scripts/setup-local.mjs
node node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.lag.jsonc --ip 127.0.0.1 --port 8837 --inspector-port 9337 --persist-to dist-validation/lag-resilience-worker
node node_modules/vite/bin/vite.js --config vite.lag.config.ts --host 127.0.0.1 --port 5317
# 両方の起動完了を確認後、別シェルで順番に実行
$env:LAG_REP='recovery-verified'
node scripts/lag-resilience/trace-coop.mjs rate-burst 35
$env:LAG_REP='final'
$env:LAG_PAUSE_MS='1200'
node scripts/lag-resilience/trace-coop.mjs up-pause-once 65
node scripts/lag-resilience/trace-coop.mjs down-pause 65
node scripts/lag-resilience/trace-coop.mjs baseline 65
python -X utf8 scripts/lag-resilience/summarize.py
node node_modules/vitest/vitest.mjs run --config vitest.front.config.ts tests/front-network-input.test.ts tests/front-connection-diagnostics.test.ts
node node_modules/vitest/vitest.mjs run tests/state-delta.test.ts tests/state-delivery.test.ts tests/state-chunks.test.ts tests/state-receipt.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.json
node node_modules/typescript/bin/tsc -p tsconfig.worker.json
# fixture Workerを専用設定で8838へ起動してから
$env:SWARM_TEST_SERVER_URL='http://127.0.0.1:8838'
node node_modules/vitest/vitest.mjs run --config vitest.front-integration.config.ts -t 'PLEAT姿勢の新旧JSON|新通信は戦況2枠'
```

主担当の実モデルID・effortは未確認。通信差分の限定担当へ `gpt-6-sol` / `high` を指定した（実行側設定は未確認）。独立Chat監査ではない。主担当が交渉・接続再開・診断・統合検証を担当した。

終了時に専用サーバー3系統を停止。書式・差分空白確認済み。製品実装commit以後の変更は検証器・証拠・STATEのみで、製品再ビルドを要するコード差分はない。
