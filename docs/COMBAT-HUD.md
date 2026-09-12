# 戦闘HUDのコンパクト化（2026-09-09）

上部3枚の全幅・高さ72px固定カードを廃止。HPは左の細い丸形バー、ステージは中央の下端が丸いラベル、武器は右端の縦線＋残弾数字へ変更。余白は背景が見えるようにした。HP40以下は「危険」、0はDOWN、弾切れは文字と色で表示。装填中は秒数を表示し、装弾数との混在を解消。味方・戦利品・接続状態・ボスHPは維持。

変更: src/client/hud.ts（マークアップと状態表示）、src/mobile-ui.css（レイアウト）、src/client/changelog.ts（利用者向け履歴）。

検証:
- typecheck / build / 対象3ファイルのPrettier / git diff --check 成功。
- Chrome実画面: 1280×591、844×390、640×280。通常ソロ開始、武器切替、上部の重なり・はみ出しなし、pageerrorなし。
- 複製worldを使った表示専用fixture: 低HP、3人の味方（DOWN・切断含む）、ボスHP、装填、弾切れの表示確認。実協力通信の検証ではない。
- 通常HUDの各高さはPCで48 / 55 / 66px、小画面で45 / 51 / 62px。画像を目視確認。
- 初回の再検証はビルドと同時実行したためPC通常表示の寸法が0になった。寸法>0の条件を追加して、ビルド終了後に単独で全3サイズを再検証。
- 既存の500kB超チャンク警告あり。実スマホ・全E2E・公開環境は未検証。公開操作なし。

証拠: dist-validation/hud/{normal,states}-{1280,844,640}.png、checks.json、check-hud.mjs。今回開始時点からの差分はchange.patch。
branch: codex/home-armory
base / HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc
既存の未コミット作業を維持。今回も未コミット。

## 公開完了（2026-09-09）
ユーザーの「いいね、公開までやって」で既存Workerへ反映。
- Version: 84395a90-a2a0-4434-a9cb-b06a7cd1014c
- 直前Version: 6f975988-be05-47e0-abab-4fb717e53b89
- URL: https://swarm-front.melosalife-24.workers.dev
- 本番dry-run成功。既に合格した型チェック・ビルド・画面検証の成果物を公開。
- 初回は自動承認レビューがHUD以外の未コミット変更を理由に拒否。HUD変更前3ファイルを隔離コピーで復元してビルドし、公開全静的ファイルとバイト・SHA256一致を確認。サーバービルドも公開Workerとバイト一致。既存変更は公開済み、新規公開差分はHUDと更新履歴のみと証明して再レビューを通過。
- 照合証拠: dist-validation/hud/baseline-live-comparison.json、worker-live-comparison.json。認証情報は出力・保存なし。
- 公開Chrome 1280×591 / 640×280でST10ソロ出撃、HP・ステージ・武器の表示、重なり・はみ出しなし、武器切替、ページ200、最新JS index-af_0QZvu.js、/api/health 200 / ok:true、JSエラーなしを確認。公開画像目視確認済み。
- 公開証拠: dist-validation/hud/live.json、live-1280.png、live-640.png、check-live.mjs。
- commit / push / mergeなし。branch / HEADは上記のまま。Android実機・協力実プレイは今回未確認。
