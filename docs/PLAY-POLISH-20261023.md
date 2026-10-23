# 既存の遊びの点検とローカル改善（2026-10-22開始、10-23継続）

## 対象と保護

- 正本: https://github.com/futsalife24-bot/swarm-front 。作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。
- branch: `claude/motion-toggle-balance-20261019`。base/head: `a3d8f076935620b2c264825bb3b849c544e2842f`。本件は未コミット差分。commit/push/merge/公開/外部送信は今回禁止。
- 開始時から存在した `AGENTS.md` 差分、未追跡の `ARGON_ADAPTER.md`、`CLAUDE.md`、`PROJECT_CONTEXT.md`、`PROJECT_RULES.md`、`docs/agent-handoff/`、BASTION `concept-v2/`・`concept-v3/` は本件の変更ではなく保持。
- COMMON、PROJECT_RULES、PROJECT_CONTEXT、STATE、WORKFLOW、TESTS、MainVault START/memory-workflow/AGENTSと既存 `10_プロジェクト/swarm-front.md` を照合。ノートは10/18時点の履歴で、現行STATEを優先。
- 別チャット「スワフロ武器バランスを段階調整」は一覧でidle。下記worktreeの候補を本件へ取り込まない。別担当への送信もしていない。

## 8項目の分類

| 項目 | 分類 | 現行の根拠・今回の扱い |
|---|---|---|
| 武器比較と選択理由 | 改善余地あり | `src/shared/defs.ts`・`game.ts`。現行値で固定標的88＋移動入力48の136条件を新規測定。既存の段階2測定207条件とは版・条件が異なるため混合しない。新数値は未適用。 |
| ボス予告と判定 | 実装済み／改善余地あり、Ω候補は承認待ち | `src/client/attack-telegraph.ts`、`harrow-effects.ts`、`src/shared/harrow.ts`、`tests/attack-telegraph.test.ts`。予備動作→赤予告の区分と地形投影は既存。HARROWの翼による遮蔽を一律depthTest解除で直したことにはしない。Ωは別候補に着地まで実装済み、採用保留。 |
| 命中・撃破演出 | 実装済み／改善余地あり | `combat-audio.ts` の材質別命中音、`audio.ts` の撃破音と発音間隔、`render.ts`・`combat-effects.ts` の粒子/火花/数値。耐性音の区別は別段階1候補で実装済みなので重複しない。新弱点・時間停止・ダメージ変更なし。 |
| 密集負荷 | 改善余地あり（配列生成を削減） | `combat-effects.ts:update` の毎フレームfilter配列生成を順序保持の詰め直しへ。演出予算・寿命・描画数・権威処理は不変。部品負荷試験では配列置換720→0、FPS改善は未確認。 |
| スマホ入力 | 実装済み、周辺の再現不具合を修正 | `input.ts` の指ごとのcapture・cancel、blur/pagehide/非表示/画面方向変更のresetは既存。マウス左右同時押し・取消の不具合を修正。CDP三点タッチで移動/射撃/回避・個別解放・取消を確認。実スマホは未確認。 |
| 協力時の状況表示 | 改善余地あり（既存マークを修正） | `minimap.ts` の味方だけが範囲外へ消える処理を、敵と同じ方角保持の縁配置へ。既存の生存/ダウン色・接続判定を維持。`hud.ts` に味方HP/切断/ダウン表示あり。新ピン・蘇生機能の新設なし。 |
| 訓練場 | 固定標的は実装済み、予告練習拡張は未実装／承認待ち | `src/shared/training.ts`、`src/client/training-app.ts`、`tests/training.test.ts`。保存・報酬なしの既存射撃場を再利用する設計を下記へ。通常ゲームへの組込みなし。 |
| 保存・報酬回帰 | 実装済み、今回再検証 | `docs/SAVE-REGRESSION.md`、既存receipt/journal/checkpointと固定合成fixture。単体147件、ブラウザ4本の個別実行成功。古い検証入口/fixture前提を修正。本人の実セーブは不使用。 |

銃口とPV v13は `STATE.md` のPR213/214公開記録、`render.ts` のshotLine→aimAt、`standard-trooper.ts` のalignBarrel、`media-menu.ts` のPV_SOURCEで現存を確認。今回の公開確認ではない。銃口関連13件は現行差分で再成功。

## 別候補の境界

- `C:/Users/futsa/Documents/Codex/2026-10-20/task-5/swarm-front`：BASTION開放2.2秒中の軽減解除と音の区別、段階1。HEAD `8fb37dc752265b32a190db247704cd3ab104e86c`。
- 同 `swarm-front-stage2`：HEAD `0330ff5d1c0114917d0d56f545dffa32007897a5`。`WEAPON-STAGE2-RESULTS.md` に207条件、SMG13維持とMD新規ソロ報酬除外の候補。現行checkoutとの差を「新規実装漏れ」と解釈して再実装しない。
- 同 `swarm-front-stage3`：同HEAD＋未コミット支援報酬候補。STATEに採用/commit承認不足で停止の記録。採用しない。
- `C:/Users/futsa/Documents/Codex/2026-10-21/task-2/swarm-front`：HEAD `4e2b632e2373cb10319dda12f095a32ec2eb1a45`。CATENA Ω着地を含む14節候補。最新 `CATENA-OMEGA-P1-FIX-20261021.md` とSTATEではST10の到達回帰を修正後、再独立監査/採用保留。旧説明の「botだけの問題」は撤回済み。着地攻撃を削除・無効化していない。
- BASTIONの連射履歴は敵に共有されたまま。狙撃を影響除外しない。進撃報酬 `[6,0]→[3,3]` は未承認で未適用。生存/進撃、ソロ/協力構成を維持。

## 現行武器の測定

再現スクリプト: `scripts/measure-play-polish.test.ts`。出力: `dist-validation/play-polish-20261022/weapons/`。dt=0.05、seed814/723、Lv1/N/改造・効果なし。11攻撃武器×12/30m×単体/3体×2seedの固定標的88条件、代表6武器×生存90秒/進撃ST2×ソロ/ARの味方1人×2seedの48条件。代表試行の再実行一致。

固定標的はHP100万・移動/攻撃停止のant、20秒。移動試行は同じ既存pilotと接近条件、実提示カードの既定選択。各seedの被ダメ・射撃イベント・移動入力数・強化履歴をJSONへ記録。メディックは支援武器なので火力順位へ入れない。命中イベント/射撃イベントは散弾・貫通・爆風で意味が異なるため「命中率」として割り算しない。

| 武器 | 固定12m単体HP減少/s | 固定12m3体HP減少/s | 進撃ソロ平均秒 | 生存90秒ソロ撃破 |
|---|---:|---:|---:|---:|
| AR | 142.8 | 142.8 | 71.5 | 162 |
| SMG | 131.9 | 131.9 | 84.7 | 141 |
| 散弾 | 105.0 | 199.4 | 95.0 | 127 |
| ロケット | 85.1 | 205.8 | 120.4 | 93 |
| スナイパー | 140.3 | 140.3 | 70.2 | 70 |
| レーザー | 123.6 | 247.2 | 62.4 | 173 |

群れへの合計損傷と序盤の撃破効率は別指標。近距離接近・再装填・貫通・味方ARの有無で差が変わる。この限定結果だけで人間の使いやすさ、後半、4人、全レア度、一般勝率、調整値を決めない。被ダメはtick間HP減少で、回復/シールド前の総被弾量ではない。

## 再現と修正

1. 左射撃中に右を押す/離すとfireを書き換えていた。さらに実Chromeは同時押しの一部解放をpointermoveで通知するため、左だけ離しても射撃が残った。左ボタンだけで射撃状態を操作し、取消とbuttonsビットからの解放を補完。戦闘数値と通信形式は不変。
2. ミニマップでは敵だけ縁へ収め、味方は生座標だった。範囲外の接続中味方/ダウン状態を既存色のまま縁へ収める。修正前2失敗・1成功→修正後3成功。ソロはマークなし。
3. 演出update後のfilterを順序保持の詰め直しへ。途中の失効、残存演出の移動、Mesh再利用、全失効を試験。描画予算180・重要演出の予約24枠・敵数・当たり判定は不変。

## 負荷測定の範囲

`scripts/check-play-polish-effects.mjs before|after`。同PC Windows・Chrome155.0.8059.85/SwiftShader、844×390、固定dt1/60、97個の敵を模した描画物、毎フレーム12演出、120フレーム準備＋600標本、各3試行。**実敵AI・通信を含む実戦のフレーム測定ではない**。

| 指標 | 前 | 後 |
|---|---|---|
| 配列置換/720フレーム | 各720 | 各0 |
| frame p95 ms | 18/18/18 | 18/18.1/18 |
| CPU＋描画投入p95 ms | 0.9/1/1 | 0.9/1/1.2 |
| 50ms超停止 | 全0 | 全0 |
| 最終演出/描画呼出し/geometry | 148/245/3 | 148/245/3 |

配列生成の削減だけ確認。フレーム時間の向上は示さない。heapは全標本10,000,000に丸められており増加/リークの判断には使えない。実戦密集の長時間・実機測定は未確認で、過去 `COOP-PERFORMANCE.md` の結果を今回の成果へ流用しない。

追加の実Renderer固定97体比較は `scripts/check-play-polish-dense.mjs`。seed4520・844×390・標準品質・SwiftShader・180準備＋360標本、AI/通信なし、前→後→後→前を予定したが、最初の修正前試行が180秒以内に完了せず中止。モジュール読込までは成功し、固定フレーム計測で時間上限に達した。`dense-incomplete.log` を証拠へ保存。修正後との比較値は取得できておらず、実Rendererでの改善・長停止・メモリ増加の合否は未確認。この未完了を部品比較の成功で置き換えない。

## 開発用訓練場の設計案（本体は未実装）

既存の固定標的射撃場は維持し、開発専用の予告シナリオ選択器を追加する案。通常メニューには追加せず、既存 `scripts/harrow-preview.*`・地形マーカーpreviewと同様の開発ページを入口にする。既存Renderer/Controls/戦闘stepを利用し、BASTION共有履歴、HARROW翼、FOUNDRY Ω着地をそのまま試す。

保存隔離は「報酬を後から消す」だけに依存しない。通常save/cloud-save/receipt/checkpoint/成長ログ/ランキング送信をimportしない入口、専用Worldのrun ID、メモリだけの設定、通常のsocket/Workerへ接続しない構成とする。既存trainingの固定標的モードは敵行動を止めるので、予告検証にそのまま流用したと主張せず、敵が通常stepで動く専用シナリオを分ける。通常セーブを初期状態として読まない。

選択項目案は既存武器、敵1体/群れ、地形、seed、予備→赤→攻撃の停止時刻。勝利/報酬画面へ遷移させず、リセットでメモリを破棄。合格条件はstorage変更0、外部通信0、通常出撃との判定一致、重複範囲の被弾回数一致、既存ルートへの混入0。この入口/スコープの採用を受けてから実装する。

## 検証・残件

型チェックとbuild成功（既存の500kB超chunk警告あり）。関連単体はファイル別実行で93件成功（入力8、味方表示3、演出1、layout7、network-input3、銃口9＋4、training2、telegraph4、HARROW16、BASTION36）。保存関連は別途147件成功。training2件は両方に含むため単純合算しない。全体テストは今回再実行しておらず、STATE記載の既存7失敗・weapon-stat-marks読込失敗が解消したとは扱わない。

実Chrome155でControlsを読み込む隔離ページを使用し、左右同時押しから左だけ解放、CDP三点タッチの移動/射撃/回避、範囲外移動、個別解放、touchCancel、合成blurの保持解除を確認。エラー0。実スマホの確認とは区別する。

HARROWは既存previewと実GLBを使い、地上カメラでSpinの0.6/1.15/1.675秒を確認。大型・非対称翼を維持し、採取視点では赤予告の外周が左右に見え、攻撃時は白い風跡へ移る。3画面と状態JSONを保存し、例外0。全攻撃・画面端・密集・全カメラで遮蔽がないと保証する試験ではなく、根拠のない描画順変更はしていない。

保存ブラウザは個別実行で安全性7ケース・fixture10ケース・受取履歴3ケース・戦闘checkpointが成功。checkpointは3回のreload/復帰、各pauseの保存Worldと進行一致、時刻の前進、合成クリア後の二重受取防止を確認。単一runnerの全件合格とは区別し、各最終JSONを証拠へ保存。

独立監査は未実施で、自己レビューを監査合格と扱わない。本人のスマホ実機、安全領域の実表示、実聴、実戦の長時間密集、HARROW全攻撃/全視点の保証は未確認。

再現コマンド: 武器測定は `npx vitest run --config scripts/vitest.play-polish.config.mjs`。隔離ブラウザは `node scripts/check-play-polish-input.mjs`、`node scripts/check-play-polish-harrow.mjs`、部品負荷は `node scripts/check-play-polish-effects.mjs before` と `after`。部品負荷のbeforeは上記base SHAの演出ソースを読み、作業ファイルは書き換えない。保存は `npm run test:save:browser`。生ログ/画面の保存先は `dist-validation/play-polish-20261022/`。

再現前失敗・検証用DOMの不足（jump自動追加の重なり）・CDP解放対象の誤指定・sandbox localhost拒否・既存SSR temp ENOENTを、製品の回帰と区別してログに保持。期待値緩和やテスト削除では合格にしていない。

保存ブラウザの準備修正: `check-save-safety.mjs`・`check-save-fixtures.mjs`・`check-recovery-receipts.mjs`・`check-battle-checkpoint.mjs` は現行タイトル入口→ソロ→進撃を単発で操作し、`.split-shutter` の消滅を待つ。`screen-transition.ts` が550ms表示する6枚のShadow DOM残像をPlaywrightが検索していたため、dialog重複に見えていた。単発操作のprobeで進撃gear到達を確認し、製品のdialog重複とは判定しない。`run-save-regression.mjs` はViteキャッシュを試行ごとに隔離し、`dist-validation` をwatch対象から除外する。共有キャッシュ競合のdynamic import失敗と、生成JSONをwatchした際のWindows EBUSYは保存assertion失敗と分ける。復旧・再試行で検査するケースと不変条件は維持。

受取履歴fixtureの古い自己検査を修正した。`later-run` / `unreceived-once` でX解体後の残高6に続きST2勝利を作るのに、残高が6のままという期待だった（実際10）。既存承認仕様 `SWARM-GROWTH-REDESIGN.md` の「進撃の素材: 勝利ごとに2+任務ST」と `progression-save.ts:grantResult` に基づき、同runなら追加0・別のST2勝利なら追加4と厳密に検査する。復旧前後の残高一致、解体済み武器を再生成しない、再replay不変の検査は維持。検査の削除/緩和や、新報酬案の期待値先行適用ではない。製品の報酬処理は変更しない。

監査向けの持続する証拠は [証拠一覧](evidence/play-polish-20261023/README.md) に複製。生ログ全体はGit管理対象外の `dist-validation` に残す。対象は本件の未コミット差分であり、開始時の別差分を監査対象へ混ぜない。

checkpointの比較は、ライブWorldの`local: undefined` / `targetLocal: undefined`がJSONでは省略される表現差だけで失敗したため、保存形式と同じJSON表現へ揃えて全保存項目をdeepEqualする。復帰直後のWorld一致、3サイクルの時刻前進、進行・報酬の検査は維持。製品の保存スキーマは変更していない。

担当モデル: 主担当と読み取り子の実モデル/effortは未確認。保存検証と武器測定は `gpt-6-sol` / `medium` を明示指定。再委任なし。共通描画・製品統合・STATE更新は主担当のみ。

記憶記録: `C:/Users/futsa/Obsidian/MainVault/10_プロジェクト/swarm-front.md` の既存差分を保持し、今回の現在地を挿入して以前の現在地を前回記録へ移した。SHA256は `A92B0128A6616033E7EBB6CC8682A5E8DD97FD650D5A7BEB768F33713E7F2464` → `AD59FFA90D30E690CDD67316B049BBF72C897B1241042BAF27BA0FF410C20C05`。読み戻し確認済み。本人の今回の禁止を優先してstage/commit/pushは未実施、GitHubへの同期は未確認。

## 継続検証：密集計測と操作保護（2026-10-23）

### 範囲と既存差分

今回の完了範囲は優先1・2。実branch/HEADは前回と同じ。T3の同一プロジェクトの実行中/待機中一覧では本チャットだけを確認したが、他環境全体の作業停止を保証するものではない。他worktree・入口文書・素材は編集しない。前回manifestとの差は `input.ts`、入力単体、密集計測器の3ファイルだけ。新規 `check-play-polish-mobile.mjs` を追加し、前回証拠は上書きしない。

### 密集計測の切り分け

`check-play-polish-dense.mjs` にGPU経路、準備/標本数、時間上限、出力先の指定、30フレームごとの進捗、実GPU名、資産読込状態、longtask、CDP heapを追加。演出乱数を各隔離ページで4520から固定した。既定の敵97体・準備180・標本360・固定dt1/60・844×390・品質1は維持。診断用 `draw=false` は最終WebGL描画だけ除外し、製品の品質設定・敵数・権威処理を変更しない。AI/通信は元から計測対象外。

- 実行環境：Windows、Chrome `155.0.8059.85`。旧器のSwiftShader経路を明示確認。準備0・標本3は完了したが、標本60では30フレーム時点で11.7秒経過し25秒で未完了。最初の描画は約14万三角形で、標準GPUの読込後は約140万三角形へ増える。3フレームだけでは資産読込後の負荷を捉えられない。
- SwiftShaderのまま最終描画を除いた診断（準備30・標本60、4試行）は完了。p95 17.8〜18.2ms、更新CPU p95 1.1〜2.4ms。これは描画負荷の所在を分ける診断で、改善成果/製品性能の値ではない。
- 標準GPU `Intel Iris Xe / D3D11` では元の標本数で4試行完了。全試行で97体、540更新、最終200 draw calls・1,404,952三角形、geometry78・texture29、未完了資産0・資産エラー0。準備後の記録はgeometry78で安定。ソフトウェア描画を主因と判断するが、前回180秒当時の厳密な停止フレームは未記録で断定しない。

| 順番 | 演出ソース | 標本数 | フレームp95 | 最大 | 更新CPU p95 | 50ms超 / longtask | 終了時JS heap |
|---|---|---:|---:|---:|---:|---|---:|
| 1 | baseのfilter版 | 360 | 17.0ms | 17.5ms | 3.5ms | 0 / 0 | 37,015,140 bytes |
| 2 | 前回の詰め直し版 | 360 | 16.9ms | 17.2ms | 3.4ms | 0 / 0 | 25,731,388 bytes |
| 3 | 前回の詰め直し版 | 360 | 16.9ms | 17.4ms | 4.2ms | 0 / 0 | 28,493,788 bytes |
| 4 | baseのfilter版 | 360 | 17.0ms | 17.2ms | 3.1ms | 0 / 0 | 34,521,324 bytes |

約60fpsの上限下で0.1ms程度の差しかなく、フレーム時間改善は示せていない。CPUの差も一方向ではない。CDP heapは構築前/計測後の値で、GCタイミング・資産の影響を含むため、メモリ削減量やリークなしの証明にはしない。配列置換は全540更新で修正前540、後1（初回マップ切替時のclearを含む）。前回の部品試験720→0とは計測範囲を区別する。密集の前後画面も実見し、敵モデル・マップ・演出を削っていないことを確認。

再開コマンド：`node scripts/check-play-polish-dense.mjs --gpu=native`。診断は `--warmup=0 --samples=60 --timeout=25000 --out=...` または `--draw=false --warmup=30 --samples=60`。独立した計測を同時実行しない。sandbox内のesbuildはAccess is deniedだったため、各ブラウザ検証は承認されたsandbox外のlocalhost実行。本人のChromeプロファイル・実セーブは不使用。

### 入力の再現と最小修正

実HTML/CSS/Controls/Layoutを読み込む隔離ページを新設した。最初のタブ切替試行ではPlaywrightのフォーカス模擬のため `hasFocus=true` のまま。模擬を解除した通常Chromeの試行で `true→false` を観測したが、保持中の移動/射撃が残り、解除の待ちが失敗。これは「通常のOS切替でも常にblurが欠落する」との断定ではない。通知欠落時の保険がないことを、単体2件でも再現した（修正前は追加2件失敗、既存8件成功）。検証器のread二重呼び出しによるseq比較ミスも別に修正し、生ログを保持。

製品修正は `input.ts` の3行追加：既存resetを保持し、`read()` 時に `document.hidden || !document.hasFocus()` なら同じresetを実行する。移動・射撃・未消費アクション・指・キーを解除し、yaw/pitch/seqの継承は既存どおり。復帰で勝手に再射撃せず、新しい指の射撃が可能なことを確認。通信形式・戦闘数値・保存/報酬は無変更。画面配置そのものの修正は不要だった。

`node scripts/check-play-polish-mobile.mjs` の最終結果：

- 568×320、667×375、844×390、932×430、1024×768。安全領域0と左右44/下21pxの合成値、スコープ2なし/ありの20条件。全ボタン非重複、44px以上、安全領域内、中央hit-testが成功。568/844の画面を実見。狭幅スコープの改行は既存表示を維持。
- 実配置で移動＋射撃＋ジャンプの三点同時操作、画面外への指移動とcapture、射撃だけ解放、移動維持、全取消を確認。
- 切替前の実フォーカスあり/射撃保持をassertし、別タブ切替でフォーカスなしをassert。修正後は入力neutral・指0、復帰で新規射撃が可能。実ブラウザでの観測であり、実スマホ/OSの安全領域/戦闘HUD全体の保証ではない。

### 検証・引継ぎ

- 入力単体10件＋network-input3件、配置7件の計20件成功。型・build成功、既存の大きいchunk警告あり。新規/変更スクリプトの構文確認と対象4ファイルのPrettier確認、`git diff --check` 成功。
- 今回は製品ソースが入力だけ変わった。保存回帰・HARROW・武器・演出の成功済み試験は再実行しない。前回の93/147件へ20件を単純合算しない。全体の既存7失敗等も解消扱いにしない。
- 優先3のHARROW全攻撃/画面端/密集と実聴、優先4の後半/移動/協力人数の比較は今回未実施。音はソースの材質別命中/撃破の経路を確認しただけで、聞き分け確認済みではない。耐性音の別候補は取り込まない。次はHARROWの攻撃ごと・予告/攻撃時刻ごと・地上/端/密集の固定fixtureを作る。実聴と本人実機は別に残す。
- 訓練場拡張本体、未承認報酬/新数値、他worktree候補の採用は承認後。BASTION共有耐性、FOUNDRY Ω着地攻撃、生存/進撃とソロ/協力、銃口/PVは維持。
- 独立監査未実施。外部送信・stage/commit/push/merge/公開なし。追加証拠と再開条件はREADME。主担当 `gpt-6.1-sol`（T3の実設定）、推論設定未確認、子なし。goalは予算なしで登録し、この追加範囲の記録確認後に完了とする。
- MainVaultはsandboxのGit所有者不一致を安全設定で回避せず、承認された通常ユーザー権限で該当ノートの状態だけ確認。前回の未コミット記録を保護し、先頭に追加範囲の概要を挿入して読み戻した。SHA256 `AD59FFA90D30E690CDD67316B049BBF72C897B1241042BAF27BA0FF410C20C05` → `C0F7AD7FB46378567902CFF6ABDA5C663E448EEEE3F9C1B226D43FF04607E224`。ローカル保存のみ、stage/commit/pushなし、GitHub同期未確認。
