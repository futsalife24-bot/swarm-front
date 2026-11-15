# 第6弾の検証証拠

- checklist.json: 本人確定の58/63件、未定義0、未掲載61行の既存値。
- checks/: 型・全テスト・書式・公開ビルド・dry-run・デプロイ・公開版情報。
- local/result.json と published/result.json: 実Chromeの6速度試聴/preservesPitch指定/保存再読込、パック保存済みのTAP START前後の無音、home音源バイト一致、横2サイズ、字幕なしとヨウコロック。
- published-files.json: 公開JS/CSS/HTML/音声パックのSHA照合とhealth、ソース版照合。

人間の実聴・実スマホ/iOS・全台詞/分岐・多人数インターネット戦は未確認。ピッチ保持の音響測定は第5弾の結果を引き継ぎ、今回は全6速度の実ブラウザ指定と保存/再生経路を確認する。

公開ソース: f0321f91aec9a7fb16df5594629f574aa2566973。Worker Version: 482dd4a3-9c53-4c8d-a48a-6c769decfe5c、100%。公開33ファイル一致・health正常。全182ファイル1864件成功。built-finalとpublishedが最終成功結果。local/result.jsonは開発サーバー要求タイムアウトの失敗記録、built/failure.pngは検証スクリプトの再生開始待ち不足を直す前の記録。
