# CALYX 開発者レポート表示修正

- 依頼：開発者モードでもCALYXが「未遭遇」で表示されない。
- base `6f29821452f684e7b1528af76451509f7f5c5a4d`、branch `codex/calyx-developer-report-20261012`。
- 原因：`developerProgress()` の手書きの遭遇解放一覧にCALYXがない。通常のロック処理・モデル読み込みの問題ではない。
- 修正：共有 `ENEMIES` の全キーから開発者用の遭遇状態を生成し、別形態wormも維持。通常保存・認証・3D素材・戦闘処理は変更なし。
- 修正前は新規回帰2件がCALYX未定義で失敗、修正後は開発者データ/認証/CALYX関連24件とclient/worker型検査成功。最初の並列テストではsandbox一時キャッシュENOENTで1suite読込失敗したが、通常環境で3suite/24件成功。
- iabで実 `developerProgress()` と実 `openBestiary()` を使う局所ページを確認。CALYX名/解説/3D canvas、asset=ready、move/attack再生を確認。通常freshProgressでは未遭遇表示、asset=locked、canvasなし。実表示1280×720、dialogはx50/y10/w1180/h700。viewport変更指示は反映されなかったため844×390を検証済みとは扱わない。既存127.0.0.1側の旧モジュールキャッシュを避けlocalhostで確認。
- `scripts/developer-report-preview.html` はローカル検証ページ。本番ビルド入口へは追加しない。実ログはdist-validation/calyx-developer/。公開後は本番配信SHAと通常UIを確認し、認証済みの開発者画面が利用できる場合はCALYX表示も確認する。
- 主担当実モデルID/推論設定は未確認。今回は単独対応。

以下は局所修正の監査・公開結果。

## 独立監査・公開結果

- [独立監査Chat](https://chatgpt.com/c/6acc5753-8cf0-83e8-9300-7053482a862f)：対象 `d9c67fdde758d45ff910fe18e26240f8680471f8`、局所修正として合格、必須P0/P1/P2各0。独立実行テストと認証済み公開開発者UIは監査側未確認。
- 資料ZIP SHA256 `5aff63014ca266e7a29140c40427bfec9a79e47a545db527938c9bc282459f02`、23項目、68067 bytes。
- [PR169](https://github.com/futsalife24-bot/swarm-front/pull/169)通常merge、公開ソース `666d1d56487439a7a7ecbbeb581ba811f85b4bb4`。merge後frontend build / Worker dry-run成功。
- Worker Version `64251496-d53c-4c17-9958-bbd6050084b2`。既存Workerへ公開、[配信記録](delivery.json)25/25 SHA一致、health200/ok:true。
- Chrome公開ページを再読込し、エネミーレポートのCALYX選択、名前・解説・3Dモデル表示を実画面で確認。この既存端末データでの表示を、公開環境の開発者認証フローの再検証とは扱わない。開発者用データと通常未遭遇ロックは前述の局所実UI・回帰テストで検証。
- 続けて本人のHARROW v12不採用指示へ対応する。上体と翼を寝かせ、低姿勢回転の胴体・翼姿勢から脚を伸ばした基本姿勢へ改修。山なり弾は大筋維持し翼を横へ広げる。技術監査の合格を見た目の本人承認と扱わない。
