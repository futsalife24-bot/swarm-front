# 敵図鑑（2026-09-09）

タイトルの「敵図鑑」から、未遭遇を含む全6種の基本HP・攻撃力・通常速度と攻撃・移動の特徴を閲覧可能。クラウンと巨大ミミズは同じ基本性能の別形態としてまとめた。数値はENEMIESを直接参照し、ステージ／人数補正前であること、蜘蛛の跳躍速度が通常速度と異なることを明記。

差分: main.tsにimport・入口ボタン・click処理を追加。client/bestiary.tsとbestiary.cssが図鑑本体。changelog.tsに当日の更新1件。戦闘・通信・保存処理は変更なし。

検証: typecheck、最終build、本番Worker dry-run成功。既存500KBチャンク警告あり。Chromeでローカル・公開とも1280×720 / 740×360 / 844×390 / 667×300の全6種、数値、横はみ出しなし、下部へのスクロール、戻る、フォーカス復帰、Escape、出撃準備への移動、pageerrorなしを確認。公開JS/CSSのSHA256は最終distと一致。ローカル740px画像を目視確認。Android実機・今回の協力通し検証は未実施。初回dry-runと公開確認はsandboxのアクセス制限で失敗、権限付きで成功。

公開URL: https://swarm-front.melosalife-24.workers.dev

最終Version: a900a642-ce42-4849-8531-4bd5315ccf9d

証拠: dist-validation/bestiary/{local,live}/result.json、同PNG、main.diff、changelog.diff、変更前ファイル。再検証: scripts/check-bestiary.mjs（BESTIARY_URLで公開先指定）。変更対象のgit diff --check成功。全体では既存docs/STATE.mdの末尾空行警告あり。

branch: codex/home-armory。base / HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。既存を含む未コミット・未追跡差分あり。commit / mergeなし。

## エネミーレポートへの刷新（2026-09-09）

一覧の行をタップすると選択した敵の解説・基本数値・戦闘と共通の3Dモデルを表示。ドラッグ／タッチ回転、ホイール／ピンチ拡大、左右回転ボタン、視点リセット。クラウンは巨大ミミズ（頭＋7節）へ切替可能。閉じる際にGPUリソース・操作・ResizeObserverを解放。WebGL初期化失敗時も解説と戻る操作を利用できる。

タイトルは主要操作を2列に配置。高さ550px以下の横画面ではロゴと操作を左右に分け、補助ミッション欄を省略。縦持ちの既存横持ち案内は維持。

今回の変更: src/client/bestiary.ts、bestiary.css、新規enemy-viewer.ts、src/main.ts（入口名）、src/mobile-ui.css（タイトル）、src/client/changelog.ts、scripts/check-bestiary.mjs。

検証: typecheck、build、本番Worker dry-run成功。既存500KBチャンク警告あり。Chromeローカル4サイズ（1280×720 / 740×360 / 844×390 / 667×300）で全6種選択、基本値、形態切替、ドラッグによる描画変化、タッチ回転、フォーカス復帰、Escape、再オープン、ソロ準備への移動、エラーなしを確認。タイトルはインストールボタンを追加した状態も縦横スクロールなし。PC・740px・667pxの画像目視確認。縦持ち試験は既存portrait案内によって遮られたため対象を正式対応の横持ちに限定。Android実機・協力通し試験は今回未実施。

Version: 5fad3fa5-9e94-4629-a2ff-9fb53f441c3d
証拠: dist-validation/enemy-report/{local,live}/result.json・PNG、before/（変更前）。ブランチ codex/home-armory、base / HEAD 2be699f160c83d641fb68bb1304e4da8059920dc。既存を含む未コミット・未追跡差分あり。commit / mergeなし。

公開後も同4サイズの操作試験成功。公開JS/CSSのSHA256が最終distに一致し、pageerrorなし。初回の本番dry-run・公開確認はsandboxのアクセス制限で失敗し、権限付き実行で成功。今回の追跡コード差分のgit diff --check成功。

## 行動中心の解説へ整理（2026-09-09）

ユーザー指示により基本HP・攻撃力・速度、射程・秒数・登場ステージ・補正注記を撤去。「攻撃方法」「移動方法」を全6種に分けて記載。クラウンの切替名を「通常型」「巨大ミミズ型」に変更し、通常型は頭部単体、巨大型は胴体が連なることを説明。現行実装のボスは同じミミズ系モデルで、ステージ5・10のみ胴体あり、それ以外は頭部単体。別種ボスの追加や戦闘変更は今回なし。

変更: src/client/bestiary.ts、src/client/changelog.ts、scripts/check-bestiary.mjs、本記録とSTATE.md。
検証: typecheck、build、production dry-run成功。ローカル・公開Chromeの4横画面サイズで全6種の攻撃／移動説明、数値・ステージ表記の撤去、形態切替、回転、戻る操作、エラーなし、配信JS/CSS一致を確認。667px画像を目視確認。既存500KBビルド警告あり。Android実機・協力通し試験は未実施。dry-runはsandboxアクセス制限で初回失敗、権限付きで成功。
公開Version: a476b473-a9d8-4b86-bbd4-7420786a48c6
証拠: dist-validation/report-behavior/（変更前・今回差分）、dist-validation/enemy-report/{local,live}/result.json・PNG。
branch: codex/home-armory、base / HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。既存を含む未コミット・未追跡差分あり。commit / mergeなし。
