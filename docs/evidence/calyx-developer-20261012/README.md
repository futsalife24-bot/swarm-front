# CALYX 開発者レポート表示修正

- 依頼：開発者モードでもCALYXが「未遭遇」で表示されない。
- base `6f29821452f684e7b1528af76451509f7f5c5a4d`、branch `codex/calyx-developer-report-20261012`。
- 原因：`developerProgress()` の手書きの遭遇解放一覧にCALYXがない。通常のロック処理・モデル読み込みの問題ではない。
- 修正：共有 `ENEMIES` の全キーから開発者用の遭遇状態を生成し、別形態wormも維持。通常保存・認証・3D素材・戦闘処理は変更なし。
- 修正前は新規回帰2件がCALYX未定義で失敗、修正後は開発者データ/認証/CALYX関連24件とclient/worker型検査成功。最初の並列テストではsandbox一時キャッシュENOENTで1suite読込失敗したが、通常環境で3suite/24件成功。
- iabで実 `developerProgress()` と実 `openBestiary()` を使う局所ページを確認。CALYX名/解説/3D canvas、asset=ready、move/attack再生を確認。通常freshProgressでは未遭遇表示、asset=locked、canvasなし。実表示1280×720、dialogはx50/y10/w1180/h700。viewport変更指示は反映されなかったため844×390を検証済みとは扱わない。既存127.0.0.1側の旧モジュールキャッシュを避けlocalhostで確認。
- `scripts/developer-report-preview.html` はローカル検証ページ。本番ビルド入口へは追加しない。実ログはdist-validation/calyx-developer/。公開後は本番配信SHAと通常UIを確認し、認証済みの開発者画面が利用できる場合はCALYX表示も確認する。
- 主担当実モデルID/推論設定は未確認。今回は単独対応。

監査・main反映・公開はこれから実施する。
