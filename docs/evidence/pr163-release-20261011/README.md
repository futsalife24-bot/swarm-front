# PR163 公開記録（2026-10-11）

- [PR163](https://github.com/futsalife24-bot/swarm-front/pull/163) 通常merge。
- 実装SHA `3bd6ed51ea1ef8bcc41cc416d330bfe4b461bfa9`。
- [独立監査](https://chatgpt.com/c/6acb22bc-2420-83e8-9e86-4b81e687245a) 対象 `956017d87972a3b3e3b15df9e515664d3a9647fd`。新規必須P0/P1/P2各0、既存失敗とHigh警告を追跡する条件付き合格。条件の追加確認で通常merge/既存Worker公開可。追加製品修正なし。
- PR最終HEAD `620475850dd0db0a8d30239ff8c32417446df321` は監査記録・公開検査のみ追加、監査対象からsrc/server/package/lock差分0。
- merge/公開ソース `9e4cb3120d4b9d107bee2eef5205c3b04b6042a6`。merge後も監査対象と製品一致を検査してからbuild・本番設定dry-run成功。
- Worker Version **`17a5c735-88a8-44b5-9945-54440cdf6ecd`**。既存 `wrangler.production.jsonc` と既存OAuth、既存Workerで公開。認証登録/設定変更なし。
- [公開版](https://swarm-front.melosalife-24.workers.dev/front)。配信37/37 SHA一致、health200/ok:true（delivery.json）。
- Windows Chrome公開版844×390/640×360、実ソロ出撃・スコープ操作・人工HUD高さ+65px・縮小後の照準/スコープ/canvas中心一致、pauseでスコープ解除。console/page error各0（published/result.json、画像6枚）。本人の保存とは別の独立context、公開協力ルームなし。
- 既存の正常公開Version `2510182e-eafa-4636-a763-6e84860005c7` と元ソース `73f1310809b7a429e3b5c7bdaa2e39b7ebde6a9e` を復帰参照として保持。今回異常なし、rollback未実施。

## 検証の限界と継続課題

Windows型/build/dry-run、HUD/訓練E2E3件、実Renderer/実射撃36条件、本番previewと公開UI2サイズ成功。全単体は903成功/4失敗＋1suite読込失敗のまま。既存失敗5ファイルと依存high5件は未解消で、無害/全件成功とは判断していない。[分類と根拠](../../PR163-AUDIT-RELEASE.md)。DOM suite回復・汎用spawn契約・ST25 botと人の難度・依存更新を追跡する。

実Androidの全画面/バー開閉/ピンチ/実タッチ、長時間GPU、全武器/敵/遮蔽、人による難度は未確認。人工HUD差とデスクトップ実Chromeの成功から実スマホ原因/解消を断定しない。独立監査側はソース/差分/保存証拠の照合で、Windowsコマンドの独立再実行なし。

作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。既存main worktreeは維持してfast-forward。重複担当停止を確認。他者変更の上書きなし。検証用サーバー/Chromeは終了。主担当実モデルID/推論設定は未確認、子不使用。
