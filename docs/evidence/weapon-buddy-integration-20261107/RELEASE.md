# 武器UI＋バディ4体の公開記録

- PR294: https://github.com/futsalife24-bot/swarm-front/pull/294
- 実装: a268ea3c01eef8f2570513f592beedaddb7ef8d6
- 公開source main: 9d625396c465fbb0f80253a4c5f0a7f59eb6e194
- Worker: https://swarm-front.melosalife-24.workers.dev
- Version: 42fb8817-67cc-4d0f-b478-73a12aeedc00
- 公開日時: 2026-11-08 00:38 UTC、100%配信を正式CLIで読戻し。
- 正規GitHub接続アプリで対象head/mergeable、status/workflowなしを確認しexpected_head_sha付き通常merge。管理者バイパスなし。
- 通常CLIの旧HTTP401から新認証せず正規接続アプリを利用。merge引数を正規スキーマへ訂正。対象未指定呼出しは審査拒否で変更なし。
- 公開用build/dry-runをmerge後SHAから実施。既存production設定・既存バインディングのまま公開。新規認証/課金/権限変更なし。
- 配信64ファイルSHA一致、health200/ok。published-delivery.json参照。
- 公開UIの最初の検証は武器庫カテゴリ選択漏れで停止。製品不具合ではなく、検証スクリプトだけ修正して再確認中。
- 実Android・実回線・実cloud入場は未検証。ローカルfixture成功をその代わりにしない。

## 公開UI最終確認

844x390の隔離Chrome新規保存で、通常武器庫の武器名タップ→詳細→lock→一覧のpressed→再度詳細のlocked→閉じるを確認。初期の2回の試験期待誤り（カテゴリ未選択、lock後dialog継続を想定）は製品を変更せず検証側だけ訂正。最終的に4体の通常スターター選択→戦闘→停止→再開、各GLB HTTP200、例外0。詳細と4体それぞれの実戦闘画像を実視した。初回撮影の導入演出を4体描画証拠にせず、再撮影済み。試験ブラウザはfinallyで終了。

公開版では共通詳細を通常武器庫から確認。全モード報酬入口の公開実プレイ通しは未実施で、ローカルの報酬fixture/統合検証と区別する。公開版の4体は選択・描画・停止再開確認であり、発動効果の検証はローカルWorld.step/単体で実施した範囲。
