# 実タブ非表示・復帰のcleanup調査（2026-10-07）

対象製品SHA: `1c2f4ba44348ab95558ca0362f4f50a561e900d0`（main/remote一致・cleanから開始）。調査branch `codex/visibility-cleanup-investigation-20261007`。正本 https://github.com/futsalife24-bot/swarm-front 、ローカル `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。

調整担当からの既存仕様内の原因切り分け1件。製品コード・保存仕様・main・公開は変更しない。独立監査やPR137、全画面・長時間GPU試験へ広げない。モデルID/推論設定は未確認。

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

## 最小観測方法

`scripts/check-menu-visibility.mjs`。インストール済みWindows Chromeのheaded起動と、隔離context内の2タブを使う。片方だけがゲーム、他方はabout:blank。新しい一時プロフィールの架空保存で実行し、IAB/普段のChrome/既存保存ロックへアクセスしない。localhost以外のoriginは起動前に拒否する。

1. 装備変更後の保存完了と、実在して走行中のAnimationを捕捉する。
2. 事前に作った空白タブへ切り替える。`document.hidden`/`visibilityState`を上書きせず、イベントも合成しない。
3. ブラウザ由来の`event.isTrusted`とhiddenを必須とし、capture時点で演出が残っていたことを検査する準備。microtaskで装飾0・捕捉したAnimation全件idleを照合する予定だったが、今回はこの経路へ未到達。microtaskが製品リスナー処理後になる保証も未検証のため、再開時に観測順を補正する。演出の時間や速度を変更しない。
4. 非表示前後の保存文字列一致とwriter lock保持を確認。記録へは架空保存のSHA256だけを出す。
5. 元タブへ戻っても取消済み演出が再出現しないこと、新しい装備変更は保存・演出・自然終了できることを確認する。finish/cancelイベント、状態、画面画像を保存し、専用ブラウザを終了する。

非表示に到達しない、演出が先に自然終了する等の場合は合格にしない。rAFやGPU負荷、戦闘・音声・実機タッチの観測には一般化しない。

準備確認: `node --check scripts/check-menu-visibility.mjs`成功。公開originを渡す負の確認も、ブラウザ起動前の拒否で成功。下記2試行後にコメント・出力説明を訂正したが、検証動作は変更していない。製品ソースは変更していない。

実行例（ローカルdev 5351起動後・共有UI貸出中のみ）:

```powershell
$env:VISIBILITY_ORIGIN='http://127.0.0.1:5351'
$env:VISIBILITY_OUTPUT='dist-validation/menu-visibility'
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

## 次の観測条件と今回の区切り

次に実測する場合は、新規UI貸出の下で、普段のChrome/IABとは別の**新しい一時プロフィールの専用Chrome**を起動し、loopback限定CDPへ`connectOverCDP({noDefaults:true})`で接続、そのdefault contextで同じ1経路を確認する案。既存利用者のブラウザへ接続せず、設定・lock・hidden・イベントを変更しない。この構成は**提案のみで未実装・未実行**。先に製品リスナー後の計測順を保証し、対象外の解析リクエストを明示的に停止する準備も必要。解析を成功モックへ置き換えない。

同条件の再試行は行わず、専用ブラウザと5351の検証サーバーを終了し、UI052は返却済み。今回の限定調査は、2条件の未到達証拠と再観測条件の整理まで。製品の最小修正案は、再現根拠がないため提示しない。製品main `1c2f4ba`と既存Workerは変更なし、独立監査/PR/main反映/再公開はこの調査では実施しない。実機タッチ・長時間GPU・全敵モデル/全作戦通過・音声・協力戦闘の非表示は今回も未確認。
