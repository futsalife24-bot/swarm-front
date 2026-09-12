# ルーム作成前画面の整理（2026-09-09）

作成・招待参加・復帰の入口を専用1列画面へ変更。武器一覧・装備枠・ステージ選択を入口から撤去し、入室後ロビーの既存操作に集約。人間確認と作成ボタンの幅を確保。

変更: src/main.ts、src/mobile-ui.css、src/client/changelog.ts、e2e/lobby.spec.ts、scripts/check-room-entry-live.mjs、本書、docs/STATE.md。
branch: codex/home-armory。base/HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。既存を含む未コミット・未追跡差分あり。commit/mergeなし。
今回開始時との差分: dist-validation/coop-entry/main.diff、mobile.diff。対応するbeforeファイルも同フォルダに保存。

検証: 型チェック・本番ビルド成功（既存500KB警告）。専用ポート5321/8921で実Worker＋Chromeの既存ロビーテスト2件成功。作成前の武器・ステージ不在、3サイズの横はみ出しなし、4人参加・装備変更・準備共有・ホストステージ同期・出撃とサーバー保護を確認。最初の試行はポート競合／sandbox起動制約、途中1回はソース更新の開発再読込により失敗し、ソース固定後に成功。検証用一時ファイルは削除。

公開Version: 342de1b1-1ff4-453c-afb4-fb0144616984
公開URL: https://swarm-front.melosalife-24.workers.dev
公開Chrome 1280×720 / 740×360 / 844×390で入口表示、武器一覧なし、横はみ出しなし、API health 200、pageerrorなし。JS/CSSのSHA256はdistと一致。証拠: dist-validation/coop-entry/live/result.json、同PNG。740pxの公開画像を目視確認。
Android実機、人間確認完了から本番ルーム作成の操作、本番4人通信は今回未検証。

## 横画面の縦スクロール修正（2026-09-09）
600pxの縦1列が余白と縦スクロールを作っていたため、高さ500px以下の横画面は左に案内・人間確認、右に入室操作の2列へ変更。外側余白を高さ計算に含め、高さ300pxは見出し周りも縮小。変更はsrc/mobile-ui.cssと検証script、本書、STATEのみ。既存差分は維持。
本番ビルドとWorker dry-run成功（既存の500KB警告）。公開Chrome 1280×720、740×360、844×390、667×300でスクロールせず見出し・作成ボタンが表示され、panelのscrollHeight=clientHeight、横はみ出しなしを確認。配信JS/CSSハッシュ一致、API health 200、pageerrorなし。画像を目視確認。縦画面は既存の横持ち案内があるため対象外。人間確認の実完了・実機・本番ルーム作成は未検証。通信コード変更なし。
公開Version: b0a0099d-c491-443e-ad01-d34af5d1835e。
証拠: dist-validation/entry-fit/mobile.diff、live/result.json、live/*.png。
branch/base/HEAD: codex/home-armory / 2be699f160c83d641fb68bb1304e4da8059920dc。未コミット・未追跡差分あり。commit/mergeなし。
