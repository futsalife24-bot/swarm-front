# 実タブ非表示・復帰のcleanup調査（2026-10-07）

対象製品SHA: `1c2f4ba44348ab95558ca0362f4f50a561e900d0`（main/remote一致・cleanから開始）。調査branch `codex/visibility-cleanup-investigation-20261007`。正本 https://github.com/futsalife24-bot/swarm-front 、ローカル `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。

調整担当からの既存仕様内の原因切り分け1件。製品コード・保存仕様・main・公開は変更しない。独立監査やPR137、全画面・長時間GPU試験へ広げない。モデルID/推論設定は未確認。

## 配置不備の修正準備（9f00779後、新規UI貸出待ち）

調整担当の次の1件として、UI054で特定した検証補助の配置不備を修正。新規プロフィールはOS temp直下の`swarm-front-visibility-*`へ置き、生成前に実体の親がリポジトリの外か照合する。削除はこのプロセスが生成したパスの台帳・絶対パス・親の実体・非symlinkが全部一致した時だけ許可する。出力証拠だけを従来のリポジトリ内へ残す。製品/Vite/ライブラリの監視設定は変更しない。

起動後はChromeのPID・親PID・実行ファイル・専用プロフィール引数を照合し、CDP実リスナーがloopbackかつ同じPIDであることを確認してから接続する。終了要求/必要時の自分のPIDツリー終了前にも所有を再照合する。これらの実Chromeに対する追加確認は**未実行**。非UIでは2スクリプトの構文/書式、temp外置きと1件の生成→削除、未所有パスの削除拒否を確認済み。[構成](evidence/menu-visibility-20261007/temp-preflight.json)、[確認結果](evidence/menu-visibility-20261007/temp-preparation-checks.json)。ブラウザ起動0、作成したtempの残存0。

Turnstileのソース切り分け:

- `index.html:67`はTurnstileをasync/deferの別scriptとして読み、`src/bootstrap.ts`のmoduleとは独立している。`bootstrap.ts:35`の通常・新規保存・招待/協力指定なしの入口は`playtest-app.ts`へ進む。`playtest-app.ts:1551`のソロボタンは`enter(gear)`、同`:2038`前後の装備保存成功後に`menuEquip`を開始し、Turnstile tokenを参照しない。
- `src/main.ts:311`のTurnstile配置は協力画面のholderがなければ戻り、部屋作成時`:1118`でtokenを必須としている。今回の通常ソロ経路はその画面/操作へ入らない。中断したTurnstile取得が前回の入口未達へ単独で作用したかは実測していないが、ソロ入口がその結果を待つ依存は見つからなかった。
- 検証補助のURLを通常の`/`にし、不要だった`?developer=1`を外す。以前の指定は`bootstrap.ts:26`から管理者session照会を発生させ、未許可なら通常経路へ戻るものだった。認証結果や保存保護は置き換えず、正規のソロ入口を使う。
- 既存indexのTurnstile取得は前回同様abortするが、解析と区別した「今回使わないscript」として件数を記録する。認証token/成功callback/成功応答は作らない。通常ソロのbodyクラス・空query/hash・協力holderなしを実画面で照合し、管理者session/協力部屋/Turnstile設定の要求が発生したら範囲外として未合格にする。その他の予期しない外部HTTPも引き続き中断・未合格。認証機能の動作検証や迂回の結果には一般化しない。

次の1回の判定条件: devが生存→専用Chrome/外置きtemp/自分のPIDとloopback確認→通常ソロ入口→装備保存とrunning演出→trusted hiddenの同一イベントで製品処理前/後を観測→cancel/装飾0→架空保存の文字列不変・writer lock保持→復帰と新規操作。失敗時は段階と最小DOM状態を残し同条件を反復しない。所要約4分を新規UIへ要求、現在UI055は別担当。旧UI054を再利用しない。製品main `1c2f4ba`・公開不変、使用モデルID/推論設定は未確認。

## 追加1件の結果: 専用Chrome起動後、装備操作の前に中止

UI-20261007-054で対象`5916616d96e89c5193fd76c8e9243567959b9fad`を**1回**実行（2026-10-07 19:15:30 JST開始）。Chrome `154.0.8037.98`、CDP実リスナー`127.0.0.1`だけ、`noDefaults:true`、専用default contextと初期about:blankは確認できた。しかし、最初の`#solo`表示待ちで30秒timeoutとなり、架空保存の設定・装備操作・タブ切替へ進んでいない。**実非表示cleanup・保存不変・ロック保持・復帰は今回も未確認、製品不具合は再現していない。** 前の2試行と異なり、今回は非表示への切替自体が未実行。

原因として確認した検証補助の不備: 一時Chromeプロフィールをリポジトリ内の`dist-validation/menu-visibility-cdp/profile-*`へ置いたため、Viteの監視が使用中の`Default/Network/Cookies`に触れ、`EBUSY`を処理できずdevサーバーが終了した。ブラウザには接続拒否/切断が記録された。Cookie内容は読み取っておらず、プロフィールは終了時に削除済み。製品やライブラリの不具合として扱わない。

原本は[結果JSON](evidence/menu-visibility-20261007/cdp-result.json)、[実行ログ](evidence/menu-visibility-20261007/cdp-run.txt)、[Viteエラー](evidence/menu-visibility-20261007/cdp-dev.stderr.txt)、[Vite起動](evidence/menu-visibility-20261007/cdp-dev.stdout.txt)。[集計・片付け・原本SHA](evidence/menu-visibility-20261007/cdp-summary.json)も保存。ソースが出す実際の`visibilitychange`を確認する段階へ未到達で、観測順の実測成功やfocus問題の解消は主張しない。

副次観測: 解析の中断件数は0で、実リクエストを止めた成功実績はまだない。`index.html:68`の既存Turnstileスクリプト取得1件が「その他の外部HTTP」としてabortされた。これは解析とは区別して記録し、成功モックや認証通過へ置き換えていない。入口未到達への単独影響は未検証。pageerrorは0、console errorは13件（中断1・接続拒否11・切断1）で、error 0とはしない。

専用Chromeは`Browser.close`で通常終了（強制終了なし）、プロフィール除去成功。Chrome/Viteの記録PID2件・5351の待受・一時プロフィールがすべて0であることを別途確認し、**UI054返却済み**。同条件は再試行していない。

今回の有限確認は未到達の証拠と原因・再開条件の記録までで区切る。再開するなら、まずプロフィールをVite監視対象外の新規一時領域へ置く検証補助の修正と、対象外Turnstile取得の扱いを整理する必要がある。製品/Vite/ライブラリ設定や認証制御を変えて通す案は採らない。修正・再測定は今回は未実施で、新規UI貸出も未要求。製品main `1c2f4ba`と既存Workerは不変、独立監査/PR/main反映/公開は行わない。

## 追加1件の非UI準備記録（5916616時点）

前の限定調査は`2ee4dde2f4c9ca8403c528cfd268b47a7043e58a`で記録完了。調整担当の次の1件として、同じ装備演出→空白タブ→復帰を、**起動時からfocus上書きを適用しない構成**で有限確認する準備を追加した。前の2条件の再試行ではない。製品mainは引き続き`1c2f4ba`。

- `scripts/menu-visibility-cdp.mjs`で新しい一時プロフィールのChromeだけを起動し、動的CDP portの実リスナーがloopbackのみか検査してから`connectOverCDP({noDefaults:true})`へ接続する。最初のabout:blankがあるdefault contextだけを使用し、`newContext()`やfocus emulationの設定/解除はしない。普段のChrome/IABに接続しない。
- インストール済みPlaywright `1.63.0`の`noDefaults && default context`条件とfocus有効化の分岐を読取で照合し、実装hashを保存。依存ファイル・Hook・OS設定は変更しない。起動時の実リスナー/default context/通常モーションの確認は**まだ未実行**。
- 観測は初期captureで取消前を採取し、製品module読込後に登録する同じdocumentの非capture listenerで取消後を同期採取する。同一のブラウザ由来イベントをWeakMapで対応付け、前回のmicrotask順序への依存をなくす。製品`menu-effects.ts`のlistenerはdocument・非capture・同期cleanupとソース照合済み。実イベントでの順序証拠は実行後に確認する。
- ゲームのローカルHTTPは通し、対象外の解析はcontext routeでabort。その他の外部HTTPも止め、検知時は未合格とする。成功モック・hidden上書き・イベント合成は使わない。中断件数を記録し、console errorへ出た場合も隠さない。ブラウザ自体の全通信を無通信と証明する検査ではない。
- 専用Chrome終了後、この呼出しで作成したプロフィールだけを絶対パス/親/非symlinkを照合して除去。通常終了が届かない時は生成した自分のPIDのツリーだけを終了対象とする。既存の本人保存・lockは操作しない。

非UI確認: 2スクリプトの構文/書式、公開origin拒否、出力パス逸脱拒否、ローカル/解析/対象外リクエストの分類、貸出ID未指定の起動前拒否が成功。[構成確認](evidence/menu-visibility-20261007/cdp-preflight.json)、[準備確認](evidence/menu-visibility-20261007/cdp-preparation-checks.json)。ブラウザ起動0、一時プロフィール作成0。実cleanup合格とは扱わない。

準備時はUI053を別担当が使用していたため、新ID約4分を要求した。その後UI054を受領し、上記の1回を実行・返却済み。`VISIBILITY_UI_LEASE`へ**実際に受領した新規ID**を指定する運用は維持する。現行のプロフィール配置のまま再試行しない。

## 読取で確認した期待動作

| 対象 | 現実装と期待 | 今回の扱い |
| --- | --- | --- |
| 共通メニュー演出 | `src/client/menu-effects.ts`のvisibilitychangeでhiddenなら全登録Animationをcancel。cleanupを同期的に呼び、装飾DOMとMapを除去、空ならMutationObserver解除。hidden中の新規演出は作らずcleanupだけ実行 | 実測対象 |
| タイトル | `title-motion.ts`はhidden/blurで押下・キー保持・監視・演出を取消。非同期決定ガードは演出終了と独立 | 読取のみ。成功済み連続操作試験を反復しない |
| 入力/戦闘 | `input.ts`はhidden/blur/pagehideでキー・タッチ・入力をreset。`front-app.ts`は戦闘中hiddenでpause、activeとソロstepを抑止し、明示再開を使う | 読取のみ |
| 描画loop | `front-app.ts`のrAF登録自体は継続する。ソロstepのhiddenガードと描画条件は別。協力world更新時のrender条件も残る | 「すべての描画callback/GPU処理が即停止」とは断定しない。実測対象外 |
| 音声/試聴 | `audio.ts`はhiddenでvoices/speech停止、update/effectもhiddenをガード。`media-playback.ts`はhidden/pagehideでpauseしrevisionを進め、ロード完了後の古い自動再生を抑止 | 読取のみ。再生実測/実音声は今回対象外 |
| 協力接続 | hiddenのpauseは自分の操作を止める。`FrontNetwork`の接続終了は退出/closeであり、部隊の戦闘継続が表示仕様。activeでない時は新しいinputを送らない | 接続を切ることを合格条件にしない。実通信は今回対象外 |
| 保存 | `save-writer.ts`はdocumentの寿命にわたりWeb Lockを保持しpagehideで解放。visibilitychangeでは解放しない。BFCache復帰はreload | ロックの読取と保存文字列の不変だけ確認。解除/steal/本人の保存は扱わない |

## 未カバー経路の選定

既存 `scripts/check-menu-effects.mjs` はheadless既定の`browser.newPage()`で別ページを開き、`document.hidden`がtrueになった時だけcleanupを検査する。LinuxとWindowsの`docs/evidence/menu-polish-20261007/ui-result.json`、`menu-polish-windows-20261007/ui-result.json`はいずれも`actualHiddenCleanup:false`。既存のreduced切替・DOM除去・連続操作の成功を、実タブ非表示の成功へ読み替えない。

選ぶ1経路は**従来版の出撃準備で装備保存の演出が走っている最中に、同じウィンドウの空白タブへ切り替え、戻る**。改装版の一時装備に保存成功演出がない仕様は対象を選ぶ理由として維持する。

今回も製品の非表示不具合を再現した事実はない。2条件とも実際のhidden状態に到達しておらず、製品cleanupの正否を判定できない。どのブラウザ条件がその原因かは未確定で、headlessや別contextだけへ断定しない。

## 前の限定調査の観測方法（2ee4dde時点）

`scripts/check-menu-visibility.mjs`。インストール済みWindows Chromeのheaded起動と、隔離context内の2タブを使う。片方だけがゲーム、他方はabout:blank。新しい一時プロフィールの架空保存で実行し、IAB/普段のChrome/既存保存ロックへアクセスしない。localhost以外のoriginは起動前に拒否する。

1. 装備変更後の保存完了と、実在して走行中のAnimationを捕捉する。
2. 事前に作った空白タブへ切り替える。`document.hidden`/`visibilityState`を上書きせず、イベントも合成しない。
3. ブラウザ由来の`event.isTrusted`とhiddenを必須とし、capture時点で演出が残っていたことを検査する準備。microtaskで装飾0・捕捉したAnimation全件idleを照合する予定だったが、今回はこの経路へ未到達。microtaskが製品リスナー処理後になる保証も未検証のため、再開時に観測順を補正する。演出の時間や速度を変更しない。
4. 非表示前後の保存文字列一致とwriter lock保持を確認。記録へは架空保存のSHA256だけを出す。
5. 元タブへ戻っても取消済み演出が再出現しないこと、新しい装備変更は保存・演出・自然終了できることを確認する。finish/cancelイベント、状態、画面画像を保存し、専用ブラウザを終了する。

非表示に到達しない、演出が先に自然終了する等の場合は合格にしない。rAFやGPU負荷、戦闘・音声・実機タッチの観測には一般化しない。

準備確認: `node --check scripts/check-menu-visibility.mjs`成功。公開originを渡す負の確認も、ブラウザ起動前の拒否で成功。下記2試行後にコメント・出力説明を訂正したが、検証動作は変更していない。製品ソースは変更していない。

現在の実行入口（ローカルdev 5351起動後・新規UI貸出中のみ。貸出IDの事前指定が必要）:

```powershell
$env:VISIBILITY_ORIGIN='http://127.0.0.1:5351'
$env:VISIBILITY_OUTPUT='dist-validation/menu-visibility-temp'
node scripts/check-menu-visibility.mjs
```

## 結果

**2試行とも未合格。実非表示時の停止・復帰は未確認で、製品不具合は再現していない。** UI-20261007-052でWindows Chrome `154.0.8037.98`、Playwright `1.63.0`、844×390、通常モーション、同じ隔離contextのゲーム1タブ＋空白1タブを使用。両試行とも`document.hidden`、visibilityイベント、演出時間は上書きしていない。

| 試行 | 対象SHA / 時刻JST | 条件 | 実測 |
| --- | --- | --- | --- |
| 初回 | `6cf1df430116c2eba42255669a06c2fb7dc1ce0b` / 18:43:28 | headed Chrome、実タブのbringToFront | 開始時7 Animation running・装飾2。3秒待ってもvisible/hidden=false、visibilityイベント0。7件すべてfinish、cancel0、装飾0。timeoutで未合格 |
| 2回目 | `c971c4f80494e3dc66c0443b4a23826a06d9fe9d` / 18:47:01 | 各タブの追加CDP sessionからfocus emulation無効化を要求。開発用解析抑止も指定 | 同じくvisible/hidden=false、visibilityイベント0、7件finish・cancel0、装飾0。timeoutで未合格 |

原本: [初回JSON](evidence/menu-visibility-20261007/initial-result.json) / [ログ](evidence/menu-visibility-20261007/initial-run.txt)、[2回目JSON](evidence/menu-visibility-20261007/second-result.json) / [ログ](evidence/menu-visibility-20261007/second-run.txt)。JSON内容・ログ本文は改変せず保存。既存Git設定による改行LF正規化があるため、環境証拠には取得原本とGit上の両SHA256を記載。2回目JSONの`focusEmulation`に「disabled」とあるが、確認できたのは解除要求がエラーなく返ったことだけで、実際の無効化は未確認。後続スクリプトで記述を訂正した。

確認できたのは、隔離した架空保存で装備変更が完了し、writer lockが事前に1件保持され、演出が通常終了したことまで。**非表示中の保存不変/lock保持、取消、復帰、新規操作の確認は到達前に中止**している。復帰画像も生成していない。pageerrorは両方0、console errorは初回4/2回目2（既存解析へのCORS失敗とERR_FAILED）で、console error 0とは記さない。`?developer=1`による全送信抑止も確認できていない。本人のプロフィール・保存・IAB lockには触れていない。

## 検証環境で確認した事実と残る仮説

インストール済みPlaywrightの`coreBundle.js`は通常contextの主frameへ`Emulation.setFocusEmulationEnabled({enabled:true})`を送る。`noDefaults`がtrueかつ既存default contextの時だけ、その上書きを省略する。ファイル位置・hashは[環境証拠](evidence/menu-visibility-20261007/tooling-evidence.json)。[公式connectOverCDP仕様](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp)でも、`noDefaults:true`が既存default contextへのfocus/media上書きを抑止し、新しい`browser.newContext()`には作用しないと確認した。

この模擬設定の存在は事実。ただし「これだけがhidden未到達の原因」「追加CDP sessionの解除要求が元sessionへ効かなかった」は**仮説**で、今回の観測だけでは確定しない。ライブラリ内部や製品へパッチは当てていない。

## 前の限定調査で具体化した次の観測条件（2ee4dde時点）

次に実測する場合は、新規UI貸出の下で、普段のChrome/IABとは別の**新しい一時プロフィールの専用Chrome**を起動し、loopback限定CDPへ`connectOverCDP({noDefaults:true})`で接続、そのdefault contextで同じ1経路を確認する案。既存利用者のブラウザへ接続せず、設定・lock・hidden・イベントを変更しない。この構成は**提案のみで未実装・未実行**。先に製品リスナー後の計測順を保証し、対象外の解析リクエストを明示的に停止する準備も必要。解析を成功モックへ置き換えない。

同条件の再試行は行わず、専用ブラウザと5351の検証サーバーを終了し、UI052は返却済み。今回の限定調査は、2条件の未到達証拠と再観測条件の整理まで。製品の最小修正案は、再現根拠がないため提示しない。製品main `1c2f4ba`と既存Workerは変更なし、独立監査/PR/main反映/再公開はこの調査では実施しない。実機タッチ・長時間GPU・全敵モデル/全作戦通過・音声・協力戦闘の非表示は今回も未確認。
