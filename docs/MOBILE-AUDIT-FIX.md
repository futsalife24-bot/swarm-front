# mobile UI 独立監査指摘の修正

基点: feat/mobile-ui / 1f9cc6bb09b782d209c3726311512bd1fb263eff。開始時statusは空、remoteなし。ユーザー添付は変更せずGit除外を維持。

## 最小変更

- 操作レイヤー: DOMではmoveの後にlookがあり、z-index:auto同士のためlookがhit-testを奪っていた。mobile-ui.cssでlook=0、moveと全アクションボタン=1を明示。portrait=100は維持。負のz-indexやDOM並べ替えは使わない。
- 4人HUD: 狭幅で味方3人のnowrap表示が親幅を超過していた。700px以下だけ幅を制約した3列grid、9px文字・文字間隔0、右4pxの余白を使う。子spanはmin-width:0とoverflow:hidden/text-overflow:ellipsisでフォント幅差を封じ込める。844pxでは従来の11pxとflex表示を維持。HUD72px・操作開始88pxは変更しない。
- 記録経路: 以後の全ログ・E2E画像・結合/オフライン証拠はdist-validationへ統一。scripts/record-check.mjsが唯一の記録用スクリプト。出力先引数や環境変数は受け付けず、任意パスへ書き込めない。旧dist-mobile-uiの独自コピーは使用・同梱しない。

戦闘・報酬・Worker・武器定義・保存・入力処理・通信処理・描画処理は変更しない。

## 再現と対象回帰

E2E名:
- P1 custom move over look receives hit-tested simultaneous touch input after save reload and rotation
- P2 four-player HUD contains HP DOWN and disconnected spans at short landscape widths

P1は844×320/touch mobileで配置編集を実touchドラッグし、moveの正規化座標を約(0.55,0.55)、size=0.7へ設定。保存有効→保存→再読込を確認し、実elementFromPointとCDPによる移動/視点/射撃の同時touchを確認。回転前後、touchEnd/touchCancel、portraitと離脱ボタンのhit-testも含む。座標の小差は実touch座標の丸め（x=0.5500196等）であり、テストは0.001未満を許容する。

修正前: move中心のhit target=look、mx=mz=0。
修正後の対象検証: hit target=move、mz=0.5、視点yawが変化、fire=true、終了時mx=mz=0/fire=false。

P2は本番hudMarkupでselfと味方3人（160HP / DOWN / 切断）を描画する表示専用fixture。通信や通常ミッション性能の合格証明には使わない。親欄・strip・全span・文字Range・scrollWidth/clientWidthを記録。

| 横幅 | strip client/scroll 修正前→後 | 最右span right 修正前→後 | mission left | 修正後余白 |
|---|---|---|---|---|
| 640 | 164/200 → 164/164 | 218.875 → 178.828 | 203.844 | 25.016 |
| 844 | 227/227 → 227/227 | 218.875 → 218.875 | 266.609 | 47.734 |
| 568 stress | 158/200 → 158/158 | 213.875 → 168 | 182 | 14 |

幅不足時は明示的なellipsisを使い、可視文字が隣枠へ侵入しないことを検査。844pxの全文可読性は維持する。

## 失敗・再実行

1. 製品修正前の対象2件は失敗。P1は初回、touch丸めに対し厳しすぎる精度で止まった。精度を調整してP1だけ再実行し、lookがhit-testを奪い移動0の本来の不具合を確認。P2は640/568の実overflowを確認。
2. 初回CSS修正後も対象2件は失敗。P1ではviewport更新直後のresizeハンドラ前に測定していたため、配置が戻る条件を待つようテストを修正。製品の回転処理は変更していない。P2では568pxの右余白が10pxで要求した12pxに不足し、右4pxを追加。
3. 上記修正後、対象2件が合格。ログmobile-audit-before.log、mobile-audit-before-hit.log、mobile-audit-after.log、mobile-audit-after2.logを保持する。途中の証拠コピーで未生成P1 JSONを参照してENOENTとなったが、再現後に生成した証拠を保存し直した。

4. 証拠画像の目視で、既存vitals spanのletter-spacing:1pxにより640pxでも不要な省略が発生していたため、狭幅だけ文字間隔を0へ修正。640/844では実文字も全て収まることをE2Eに追加し、その後の最終commitを検証対象にした。

## 凍結後の検証契約

最終コードをcommitしてstatusが空の状態で、リポジトリ直下から以下を順次実行する。

node scripts/record-check.mjs format:check
node scripts/record-check.mjs typecheck
node scripts/record-check.mjs test
node scripts/record-check.mjs build
node scripts/record-check.mjs build:pages
node scripts/record-check.mjs test:e2e
node scripts/record-check.mjs server:build
node scripts/record-check.mjs test:integration
node scripts/record-check.mjs test:offline

git diff --checkも実行。実行済みの最終結果はdist-validation/checks.jsonでHEADを照合し、ZIPのaudit/FINAL-REPORT.mdを参照する。この文書の対象テスト合格だけで全検証済みとはしない。

integrationはローカル通常Workerとserver:testを別プロセスで起動。offlineはWorkers停止を確認した上でViteだけ起動し実行。終了時に全テスト用プロセスを停止。branch/HEAD/clean/開始終了/exitCode/secretLeakの記録は既存形式を維持する。

## 制約

Windows/Node24.14.1/npm11.11.0/Chrome Playwright。Android実機・実機2台・インターネット経由は未検証。40敵は隔離fixtureによるPCソフトウェア描画測定であり通常ミッション性能と別。通常ソロ完走E2Eは初期装備・通常入力で実施する。
公開・deploy・push・merge・課金・新規外部サービスは実施しない。完了はローカル修正/自己検証の意味で、Chatの独立再監査承認を意味しない。
