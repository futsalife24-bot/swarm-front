# 画面演出スイッチの表示修正（2026-11-13）

本人画像で、生存の出撃準備「設定・操作」の画面演出スイッチに長い文字が折り返されていた。項目名を「画面演出を抑える」、スイッチ内をジャイロと同じ「オン／オフ」に変更した。ARIAの切替状態・設定保存と動作は維持。[PR #332](https://github.com/futsalife24-bot/swarm-front/pull/332)を通常merge、公開ソースは `d41bcda9f818064d8a45ad9fdff51eee75fb743b`。

型確認・関連7テスト・build・本番Worker dry-runが成功。ローカルの開発サーバーは起動後のHTTP応答待ちで期限となったため、buildを一時ローカルHTTPで配信して実Chromeを確認。844×390・640×390ともスイッチ高さ40px、文字のはみ出しなし、オフ→オン、ページ例外0。公開後も同じ2幅・操作・例外0を確認した。[公開画面](public-844.png)。使い捨てChromeでService Worker無効・動きを減らす設定を使用。実スマホ上の表示・既存PWAキャッシュ更新は未確認。

本人が実機確認を終了したとの回答後、既存Workerへ公開。初回はCloudflareの起動CPU制限 `10021` で検証失敗し、旧版のhealth正常・旧revisionを確認。起動profileの標本では `registerTerrain` が約155msを占めたが原因は確定していない。サーバーコードに今回変更がないことを確認して通常公開を一度再試行し、成功（起動661ms）。Worker Version `3c655e87-69f6-47f2-a505-7f8647dc6f83`。[配信38ファイルSHA・health照合](published.json)。

本人は同日、Workers Free継続と回答済み。使用量の読取は最初アカウント一覧403、既存Wranglerの通常認証確認後に再取得し、当日UTC 00:00〜11:51は全Workers 197 requests・0 errors・209 subrequests。契約API403は本人回答と区別。[取得結果](account.json)。新規費用・契約や権限の変更なし。実機確認の内容・診断JSONはまだ受け取っておらず、マルチgoalは閉じない。
