# 4アプリ共通管理（2026-09-17）

## 対象・保存場所

`/admin/`を縦画面の4カード（LMF能力DB・スワフロ・カタモン・まよいの砦）へ拡張。既存の開発者ログイン、パスワード、セッション境界は維持。1/7/30日、アクセス・訪問ブラウザ・今日対昨日の前日比、日別展開、アプリへのリンク。

作業コピー: `C:/Users/futsa/Documents/Codex/2026-09-17/lmf-db/{swarm-front,lmfdb,katamon,mayoi}`。元のカタモンには未保存変更、スワフロには別タスクがあるため触らない。base: swarm `4519967845932fa7cc05df4dc71562c473549dc9`、LMF `58c3b58`（完全SHAは監査manifest）、katamon `1fdbd583cff70ba354270f8c3df4d8245e12e318`、mayoi `b4bd054d5a7ccd52d257b3f603ac27d751b1d977`（Sites v8一致）。

## 計測契約

- 集計日はJST。訪問ブラウザは各アプリ内・日別の重複排除。7/30日は日別ユニークの延べ数であり、期間ユニーク人数ではない。前日0の場合は比率を計算しない。
- `/api/developer/apps?days=1|7|30`は既存の開発者セッション必須、no-store。個別取得失敗はerror、記録なしはpendingで、0件と区別。
- スワフロは既存`analytics`オブジェクトと`analytics-days`をそのまま参照。既存の計測イベント・ストレージを変更/移行しない。出撃・クリアは詳細に残す。
- 新規3アプリは`/api/analytics/collect/{lmfdb,katamon,mayoi}`。公開ページの表示時に1回。JSON本文はランダムなアプリ別ブラウザID（32桁hex）またはnullのみ。Cookie、URL、Referer、ゲーム保存・アカウント情報は送信しない。
- 本番の正規origin/pathに限定。developer=1、analytics=off、DNT、GPC、iframe、非表示ページは除外（可視化時に送信）。通信失敗を握り、ゲームを止めない。localStorageが使えない場合はアクセスのみ記録。
- collectionのCORSはアプリのoriginにのみ許可し、認証/ゲームAPIのorigin許可を拡張しない。GitHub PagesのLMFとカタモンは同一originなので送信元を暗号学的に証明できない。公開ブラウザ計測は改ざん可能な参考値で、課金・報酬等に使わない。
- 新規アプリは既存GATEバインディング内の別オブジェクト`app-analytics/<id>`に保存。SQLiteで日別・訪問ID別に分離し、大きな単一KV値への追記を避ける。SQLはbind parameter使用。365暦日を保持し、無アクセス時もalarmで削除。既存Gateのalarmは従来どおり、専用テーブルがあるオブジェクトのみ新しい保持処理。
- 本文512 bytes上限、アプリ当たり20,000アクセス/日、IP当たり60回/分（オブジェクトの稼働中、最大1000枠）。IPは永続保存しない。上限超過は集計欠落になり得る。既存Freeアカウントの枠は他アプリと共有し、無料枠内を保証しない。新規サービス/契約なし。
- まよいの砦は既存Sites `appgprj_6aab43de9f348191b16094c69e2e657f`、閲覧範囲customを維持。アクセス権・公開範囲は変更しない。

## 検証

- 型チェック、集計/認証10テスト（実SQLiteで重複/日替わり/保持期限を含む）。標準ビルドとproduction Worker dry-run成功。
- `scripts/check-app-analytics.mjs`：実Chrome + ローカルWorker/SQLiteで認証、CORS、過大本文、別アプリ分離、匿名アクセス、既存スワフロ参照、320/390/768幅、1/7/30日、日別展開、通信失敗/再試行、ログアウト。新規3アプリの実スニペットをブラウザで実行し、本番宛通信は必ずlocalhostへ差し替え。結果・画面は`docs/evidence/app-analytics/`。テスト数字は本番実績ではない。
- LMF既存check.sh全項目成功。最初の同期失敗はWindows checkoutのCRLFによる文字列比較差分のみ。JSON内容は同一。検証時だけLFへ正規化、公開データ差分なし。
- カタモン: cache-version 2、app-shell 3、seat p1 20項目成功。保存版更新に伴う期待BUILD_IDを更新。
- まよい: `npm test` 30/30、オフライン回帰を含む。既存セーブ形式は不変。
- 環境: Windowsの既存setup:windowsによりプロジェクト内DLLのみ更新。production設定の静的assets付きdevは待受後応答せず。既存ローカル設定（8794）で実API/UIを検証し、production設定はdry-runで検証。実機スマホ・本番計測/配信は公開後確認まで未確認。

## 公開順序

独立監査対象に4リポジトリの差分・必要ソースとUI/検証証拠を含める。必須指摘を解消後、共通Worker→各アプリの計測追加の順で公開する。既存データの移行なし。停止/切り戻しは各アプリの計測スニペットを戻せば送信停止、共通画面を戻しても既存Swarm計測は継続。

現時点は実装・自己検証済み、独立監査・merge・公開前。
