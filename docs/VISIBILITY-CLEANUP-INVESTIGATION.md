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

現時点で製品の非表示不具合を再現した事実はない。観測不足の原因は、既存試験で実際のhidden状態に到達していないこと。どのブラウザ条件がその原因かは未実測であり、headlessや別contextだけへ断定しない。

## 最小観測方法

`scripts/check-menu-visibility.mjs`。インストール済みWindows Chromeのheaded起動と、隔離context内の2タブを使う。片方だけがゲーム、他方はabout:blank。新しい一時プロフィールの架空保存で実行し、IAB/普段のChrome/既存保存ロックへアクセスしない。localhost以外のoriginは起動前に拒否する。

1. 装備変更後の保存完了と、実在して走行中のAnimationを捕捉する。
2. 事前に作った空白タブへ切り替える。`document.hidden`/`visibilityState`を上書きせず、イベントも合成しない。
3. ブラウザ由来の`event.isTrusted`とhiddenを必須とし、capture時点で演出が残っていたことを検査。製品リスナー後のmicrotaskで装飾0・捕捉したAnimation全件idleを照合し、自然終了との混同を避ける。演出の時間や速度を変更しない。
4. 非表示前後の保存文字列一致とwriter lock保持を確認。記録へは架空保存のSHA256だけを出す。
5. 元タブへ戻っても取消済み演出が再出現しないこと、新しい装備変更は保存・演出・自然終了できることを確認する。finish/cancelイベント、状態、画面画像を保存し、専用ブラウザを終了する。

非表示に到達しない、演出が先に自然終了する等の場合は合格にしない。rAFやGPU負荷、戦闘・音声・実機タッチの観測には一般化しない。

準備確認: `node --check scripts/check-menu-visibility.mjs`成功。公開originを渡す負の確認も、ブラウザ起動前の拒否で成功。実画面は共有UIの新規貸出待ち。製品ソースは変更していない。

実行例（ローカルdev 5351起動後・共有UI貸出中のみ）:

```powershell
$env:VISIBILITY_ORIGIN='http://127.0.0.1:5351'
$env:VISIBILITY_OUTPUT='dist-validation/menu-visibility'
node scripts/check-menu-visibility.mjs
```

## 結果

未実行。実非表示の停止・復帰・性能値は未確認。観測後にこの節を更新し、不具合なら原因と最小修正案までを記す。調査での製品修正/main反映/公開は行わない。
