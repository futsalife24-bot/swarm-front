# 操作受信確認・戦況差分・遅延計測の公開

[PR #243](https://github.com/futsalife24-bot/swarm-front/pull/243)を通常merge。基点 `98c4dc2656f543d809d41db6bb36058a6e4c76c8`、実装 `56d4de348ddc6bba9d1f42982019d136c07ac1d1`、公開ソースmain `8687693634235253d75e3d84843357e0655eb8c8`、既存Worker Version `214ad852-7f55-4cae-9775-ed55597d28d4`。公開先 https://swarm-front.melosalife-24.workers.dev/ 。

merge後production build・既存Worker dry-run成功。新サービス・契約・移行・設定変更なし。GitHub checks/statusesは0件（CI合格とは扱わない）、PR mergeable/clean、保護の変更・迂回なし。

検証済みコードと最終実画面試験の7ソースSHA一致。関連単体134件、実Worker統合20件、旧モード13項目（12件一括＋環境制限429の1件を別隔離Workerで再検証）、型・変更コード書式成功。旧モード初回の固定ポート未起動と再実行時429は[実装記録](README.md)に記載。

通信payloadはローカル実戦比較で約26〜27%減、操作適用p95は最終反復で118→159ms/片道300ms追加で880→920ms。seed・負荷が異なり因果未確定。快適化は未達、実機の745msの根因は未特定。実スマホ・実回線多人数・長時間は未確認。

公開後確認は[配信結果](delivery.json)。公開27ファイル（JS/CSS・入口2枚・sw・download manifest）のSHA一致、health 200/ok、空Chromeで公開ソロ起動・1.5秒キー操作、画面例外0。844×390のスクリーンショットを目視確認。協力通信・差分・混在・切断復帰は公開前の隔離Workerの検証であり、本番の複数端末試験ではない。本人セーブ・本番部屋は不使用。

モデルID/推論設定は主担当未確認、補助Sol/high指定1体（実行値未確認）。元rootの既存差分は保持。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/dist-h`、正本リポジトリ https://github.com/futsalife24-bot/swarm-front 。
