# 公開mainの検証証拠

公開ソース: `7bc6ac48289e8e5d153074cf4e4b266742985240`。
Worker Version: `a35b1e09-bbd1-4f1d-b00a-0d2bf6e7db80`。

- `source.txt`, `build.txt`, `dry-run.txt`, `deploy.txt`: 統合mainからの公開。ログは末尾空白・空行だけ正規化。
- `delivery.json`: 26/26配信ハッシュ一致、health200/ok:true。
- `delivery-initial.*`, `delivery-response.json`: 公開直後の12件不一致と、その後の正常なJS応答。原因未特定で保持。
- `upgrade-delivery.json`: 初回UI検査で未読込だった6画像のHTTP200/image/png・SHA一致。
- `public-initial/`, `public-ui-initial.txt`: 画像のcompleteを待たずに判定した初回失敗。
- `public/`, `public-ui.txt`: 検査側の画像完了待ち補正後。公開SW有効・Windows Chrome 844/640/1220×通常/reducedの6条件成功。画像待ちの初期未完了数と時間も記録。保存・融合・協力幅・未保存名・全画像自然幅、page/console error0。
- `prep/`, `public-prep.txt`: 最終padding適用後の公開/front準備。844/640×通常/reducedの4条件成功。header44×36以上・画面内・page/console error0。
- `iab-ui.json`: IAB追加目視は別タブの保存保護で未確認。保護を維持し確認用タブのみ終了。

詳細・未確認範囲は `../../BASE-DECKS-RELEASE.md`。本人の保存データ・Cookie・認証値は収録しない。
