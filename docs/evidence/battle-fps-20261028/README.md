# 戦闘中のFPS表示（2026-10-28）

依頼: OPPO Find X8での重さ確認のため、画面端に小さなFPS数値を出す。
基点 main e1fd800d41b8f8fa5266345353ecffe0d940f34a、branch codex/battle-fps-20261028、作業場所は既存dist-h。rootの別差分を保持。

生存・進撃（ソロ/協力共通）の戦闘画面左下に11pxのFPSを表示。実際のRenderer描画回数の差分をrequestAnimationFrameの実時間差で割り、約1秒ごとに整数更新。既存Renderer.fpsはゲームdt上限による過大表示のおそれがあるため流用しない。30fps制限で省略された描画は数えず、長停止も分母に含む。一時停止・選択中は「— FPS」、メニューでは非表示。復帰時は計測を初期化。追加タイマー・描画ループ・通信・保存はなし。安全領域を考慮し、pointer-events:noneで入力を妨げない。

型検査client/worker、production build成功（既存500kB超chunk警告あり）。ブラウザ検証結果と公開状態は追記する。実OPPO/PWAは未確認。独立監査は局所表示変更のため未実施。主担当のみ、実モデルID/推論設定は未確認。

再現: repoから `node docs/evidence/battle-fps-20261028/check.mjs`。既存依存のVite5197/隔離Chromeを使用し、結果をdist-fpsへ保存する。実セーブ不使用。

実Chrome（空プロファイル）で844×390/60設定は60 FPS、640×360/30設定は30 FPS。左下の表示と操作ボタンの非重複を画像確認。メニュー非表示、一時停止「— FPS」、入力透過、画面内収まり、例外0を確認。時刻/描画回数を制御したブラウザ内試験で30 FPS、5秒停止相当1 FPS、停止リセット、復帰60 FPSを確認。初回Vite依存最適化で起動に時間を要したが完走。既存シェーダーの未初期化変数警告あり。production dry-run成功。

公開は未実施。commit/push/PR作成を含む申請が、自動承認レビューに会話冒頭の禁止と今回のFPS変更への明示承認不足を理由に拒否された。拒否された操作は実行せず、全差分は未stage・未commitで保存。本人による今回のFPS変更のcommit/push/通常main反映/既存Worker公開の承認後に再開する。

2026-10-28: 本人が今回のFPS変更と記録のcommit/push/通常main反映/既存Worker公開を『はい』で承認。公開手順を再開。
