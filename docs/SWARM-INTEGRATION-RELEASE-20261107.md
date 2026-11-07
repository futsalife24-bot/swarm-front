# スワフロ4件の公開（2026-11-07）

## mainと公開

[PR292](https://github.com/futsalife24-bot/swarm-front/pull/292) を通常merge。PR head `cc6a7e67c21bdf84d024a779e63d7c04ebf63931`、公開ソースmain `bf5c68a056498d49949972460fc4ad8492cd0b87`。branch protected=false、rulesets=[]、対象status/Actions/reviews=[]を確認。CIが存在しないこととCI成功を区別し、保護無効化・管理者バイパスなし。

merge後mainと検証済みheadの製品ソース一致、local/origin main一致とcleanを確認。mainからclient/Worker型チェック、製品build、production Worker dry-runが成功。既存の大容量chunk警告は残る。

既存Worker `swarm-front` の Version `26ad4f7e-d581-4070-bada-a95663c8afbb` を2026-11-07T04:25:21Zに公開。正規deployments一覧で100%配信を確認。URL: https://swarm-front.melosalife-24.workers.dev 。配信60ファイルのSHA256がローカル成果物と一致、health200/ok、設計・検証用ページが配布物に含まれないことを確認。

[配信照合](evidence/swarm-integrated-release-20261107/delivery.json)。新規費用・サービス・権限・公開先は変更しない。検証詳細は [4件統合QA](SWARM-INTEGRATION-20261107.md)。

## 契約・使用量

現在も無料プランという2026-11-05の本人回答を継承し、同じ質問を取り直していない。今回のsubscriptions APIは403のため、APIで契約を再確認できたとは扱わない。公開時に既存Wranglerの通常認証が更新された後、本日UTC00:00〜04:26:03の全Workers集計を正規GraphQLで取得：112 requests、0 errors、118 subrequests。前の認証によるaccounts読取り403も成功扱いにしていない。契約/権限の変更なし。[取得結果](evidence/swarm-integrated-release-20261107/cloudflare-check.json)。

## 停止と再開

最初のmainビルドは診断情報送信の確認待ちで停止し、旧配布物を公開しなかった。本人から環境/ビルドメタデータがMicrosoft診断先へ送信される可能性と詳細不明を示した質問への承認を取得。停止プロセス0、旧distのままであることを確認後に再実行し、上記の公開に成功した。

## 公開画面確認

公開版の844×390/640×360で、3桁部屋IDの入室案内と、実UIで選択したタタラのMAXチャージ→解放→クールダウン、停止画面の実同行情報を確認。pageerrorは0。隔離新規保存で、配信JS・HP・時間・敵は変更していない。協力の公開入口では部屋作成をせず、実ホスト/ゲスト接続と戦果12武器の確認はローカル統合QAの範囲。

[公開画面の結果と条件](evidence/swarm-integrated-release-20261107/results.json)、同フォルダーの2サイズの入口/チャージ/停止画像。公開記録と検査器の後続変更は製品コードを変えず、再公開しない。実スマートフォン/PWA、公開実回線4人、長時間の強さ調整は今回の検証外。
