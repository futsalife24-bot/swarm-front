# PLEAT v4 本体実装記録

2026-09-11。ユーザー「分かった、これで実装して」によりv4造形と本体組込を承認。branch codex/home-armory / HEAD 2be699f160c83d641fb68bb1304e4da8059920dc。既存の未コミット差分を維持。公開・commit・push・mergeなし。

## 変更

- public/assets/enemies/pleat_motion_v4.glb を新規保存。元HOUNDと候補v3/v4を保持。
- src/client/hound-motion.ts、structure-motion.ts: crawlerだけをPLEATへ接続。ant/spiderはHOUNDを維持。距離同期を維持。
- src/client/render.ts、src/shared/game.ts: 外部監査済み統合第3案の差分を現行に照合して適用。攻撃予兆残差の丸め、回復中の方向保持、run/null時の履歴消去。
- src/client/bestiary.ts: PLEAT名称・姿・胸部の襞へ更新。全エントリを数値と直接の回避方法を含まない観察文へ整理。
- docs/STRUCTURE-ANOMALY-v2.md、docs/art/ANOMALY_TASK_TEMPLATE.md: 全ANOMALYのレポート共通方針、v4見た目承認と制作見本を記録。
- tests/structure-motion.test.ts: アセット名変更後も距離同期を維持する回帰検査を追加。

## 検証

型検査（client/worker）、関連33既存テストと追加1テスト、Viteビルド、Worker dry-run成功。ビルドのチャンクサイズ警告は残る。

check-runtime.mjs: 本体ソース・public GLBを使用。ロード正常/遅延/失敗 × wind観測有無 × 標的静止/左右移動の18条件成功。コードやモデルの応答置換なし（通信タイミング・失敗のみ制御）。
check-reset.mjs: run変更2条件・null・個体除去・時刻巻戻し・inactiveの方向解除6条件成功。時刻巻戻しとinactiveのクリップはLungeを保持する場合があり、全条件即Idleを保証しない。
check-report.mjs: PCと横持ち、6種の文章、公開用GLBのHTTP200、JSエラーなし。report-844.pngを目視してモデルと文章の表示を確認。

既存scripts/check-bestiary.mjsはレポート部分の検査を通過後、仮のPWAインストールボタン追加時にタイトルの収まりで失敗（61行）。今回タイトル/CSS/PWAは変更なし。これはレポート専用検査と区別し、全UI検査成功とは記録しない。

途中参加・再接続で初回観測が攻撃後になる場合の完全な攻撃再現、実スマホ性能は未確認。v4造形の外部監査は未取得。元の統合監査と今回の自己検証を区別する。

GLB SHA-256: 6ee7747c1273b6dc076c962c91fab1fc4ab83039830b765da64f59b26733edc4。
開始前ファイルはbefore/、実Renderer証拠はresults.json・reset-results.json、レポートはreport-results.json。
