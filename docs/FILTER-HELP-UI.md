# 武器ヘルプと出撃準備の表示調整（2026-09-09）

- 武器種の「?」を28×28pxに統一。武器庫詳細の見出し列を28px＋残り幅に変更。
- 出撃準備の武器種・ソート枠を内容幅へ縮小し、右側に選択武器種の要約を常時表示。全系統では3種の概要を表示。従来の詳細ダイアログも維持。
- 変更コード: src/main.ts、src/mobile-ui.css、src/client/weapon-help.ts。
- branch: codex/home-armory。base/head: 2be699f160c83d641fb68bb1304e4da8059920dc（コミットなし）。作業開始時から未コミット変更多数あり、保持。
- 型チェック・本番ビルド成功。ビルドには既存の500kB超チャンク警告あり。
- 既存armory-ui 2ケースのアサーション成功。今回の表示確認も640×280、844×390、1280×582で全武器種切替、ソート、28pxアイコン、ヘルプ開閉のアサーション成功。スクリーンショットを目視確認。
- 証拠と今回だけの差分: dist-validation/filter-help/（change.patch、*.png、検証用layout.spec.ts）。
- 公開操作は未実施。
- ブラウザテストは全ケースok出力後、サーバー終了処理が戻らず検証コマンドを中断。ランナー全体の正常終了は未確認（検証項目の成功とは区別）。

## 追加調整（ユーザー指定）
- 説明を選択枠の下に移動し、武器一覧の全幅を使用。
- 出撃準備では武器種の「?」自体を生成しない。結果・武器庫のヘルプは維持。
- 名前欄のヘルプ用28px列を除去し、狭い場合は折り返して全文を表示。
- 今回の変更: src/main.ts、src/mobile-ui.css。branch/base/headは上記と同じ。未コミット。
- 型チェック・ビルド成功（既存チャンク警告）。ブラウザ確認は正常終了。640×280、844×390、1280×582で全4フィルター、ソート、説明の位置・全幅、名前の非クリップ、武器庫28pxアイコン維持を確認。640pxのブレイカー表示を目視確認。
- 今回だけの差分・スクリーンショット・検証スクリプト: dist-validation/filter-help-below/。
- 公開未実施。

## 公開完了（2026-09-09 JST）
- ユーザーの「良いね、、これで公開して」に基づき既存Workerへ公開。
- Version: 5fba86f1-6dc6-4431-bf53-76f533e67032。直前Version: fc839b77-f275-4790-a615-03251903c49b。
- URL: https://swarm-front.melosalife-24.workers.dev
- 配信JS: index-BqDV5sot.js / CSS: index-IPAhzuqm.css。
- 本番dry-run成功。初回の公開操作は自動承認レビューが多数の未コミット差分を理由に拒否。変更前3ファイルの隔離ビルドで公開全6ファイルとSHA256・バイト一致、現在Workerも公開版と一致を証明し、再レビュー通過後に公開。
- 公開Chromeの640×280、844×390、1280×582で全4フィルター・ソート、説明が選択枠の下で全幅、出撃準備の?なし、名前の欠けなし、武器庫28pxヘルプ維持を確認。配信JS一致、ページ200、API health 200/ok:true、pageerrorなし。画像目視確認済み。
- 証拠: dist-validation/filter-help-below/{baseline-live-comparison.json,worker-live-comparison.json,check-live.mjs,live-gear-*.png}。
- branch/headは上記から変更なし。commit/push/mergeなし。Android実機・公開協力プレイは今回未検証。
