# CATENAエネミーレポートの連動修正（2026-11-11）

基点main 8c03cd7e4f7e0389b0751352d02072e5f69a19a1。作業場所 task-resume-catena-20261110 / codex/catena-report-20261111。root既存12差分は保持。

説明を14胴・最大8砲口・自然跳躍・着地予告外への退避へ更新。専用プレビューはWORM_UNIT_COUNTと共通omegaPose/OMEGA、OmegaWarningを使用する。展示では固定の平地・上昇幅6を入力し、16秒の再生ループ中8秒から跳躍を示す。実戦の地形・天井に応じた計画やダメージ/タイミングは変更しない。旧7胴専用のカメラを14胴・跳躍・予告円を含む固定boundsへ変更。

## ローカル試験

- npm run typecheck: client/Worker成功。カメラ修正後にも成功。
- enemy-report-motion + catena-omega: 初回はsandbox一時変換キャッシュENOENTでomega未実行、レポートは11成功/1失敗。正式権限の同一試験では26件25成功/1失敗。
- その1失敗はHARROWの既知の配列長不一致。前回mainの docs/evidence/catena-resume-20261110/integrated-full-comparison.json に同名が記録済み。今回HARROWのコード/期待値を変更していない。
- 追加の予告消去試験を含むCATENA限定再走は3成功/他10skip。14胴・8砲口、頭→尾の浮上、着地、繰り返し、待機時/着地後の予告消去を確認。
- front-enemy-report-order / encounter-camera / encounter-film: 3ファイル11件成功。
- npm run format:check: 既存と同じ14ファイル警告。変更対象ファイルは整形済み。既存警告の修正や全体合格扱いはしない。
- git diff --check: 成功。

実画面・会敵ムービー・ビルド結果は下記。公開は未実施。既存全体22失敗を今回の変更で解消したとは扱わず、無関係な全件試験は反復しない。

## 実画面・動画・公開準備

通常front.htmlのタイトルから、隔離した遭遇保存fixtureで1280×720/844×390のレポートを確認。全身14胴・15予告円・浮上・着地後消灯、pageerror0。1280で会敵ムービーをボタンから開き、新SHA先頭c712e47513cc・11秒・再生位置0.5秒超を確認。詳細はUI-VALIDATION.md。主担当も画像と動画接触シートを目視した。

動画は1280×720/30fps/330フレーム/11秒、SHA c712e47513cc41aa5a7b0a207a28b389fbf933ff35d0b221ad2ae84323839721。戦闘の共通stepOmegaで14胴の自然跳躍を本番Rendererへ投影した。再現手順はCATENA-FILM-CAPTURE.mdと専用script。旧動画と他9種は保持。encounter-film-assetsの旧CATENA台帳参照は新manifestに更新し、既存assertを維持して1件成功。

npm run build 成功、npm run server:build:production成功（467 assets、526.00 KiB/gzip135.20）。この初回buildは最終砲口Idle追加の動画再収録前であり、公開用ビルドはmain反映後に再生成する。新動画本体は全デコード/素材試験/レポート内再生で別途確認済み。

現環境のWranglerは未認証で、前回の認証設定は標準保存場所に存在しない。既存公開先を変更せずログイン復旧を確認する。運用詳細はGit除外のdist-validation/catena-report-release-20261111に保持し、公開資料へ秘密・アカウント情報を含めない。

主担当モデル/推論設定は未確認、既存子2体の設定はgpt-6-sol/high（実ランタイム未確認）。独立Chat監査は追加せず自己検証。依存インストール・課金・新規公開先・戦闘仕様変更なし。
