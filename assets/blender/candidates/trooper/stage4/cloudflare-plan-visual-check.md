# 既存公開先の確認

2026-09-11、ログイン済みCloudflare DashboardのWorkers Plansを通常UIで確認。Free（無料・0ドル）の欄に「現在の計画」無効ボタン、有料側は「アップグレード」と表示。契約変更・購入はしていない。

Wrangler接続先は既存swarm-frontのアカウントと一致。API account-settingsは読み取れたが、subscriptionsは403で閲覧不可だったため、ダッシュボードの現在プラン表示を根拠にした。

Workers & Pagesの現在表示は9月1日〜11日でアカウント全体125リクエスト、CPU時間110ms、アプリ1件（swarm-front）。表示された集計範囲の値であり、日次の厳密な残量や実機性能の保証とはしない。
