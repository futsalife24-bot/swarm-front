# PLEAT軽量化・姿勢通信・狭所移行の公開

2026-11-01、本人の「公開して」によりPR [#245](https://github.com/futsalife24-bot/swarm-front/pull/245)、[#246](https://github.com/futsalife24-bot/swarm-front/pull/246)、[#247](https://github.com/futsalife24-bot/swarm-front/pull/247)を順に通常merge。後続PRは先行merge後にmainへ向け直した。管理者バイパス・保護変更なし。GitHub checksは全件0件で、CI合格とは扱わない。

- 公開前main: `3035376932bbf3e0734e181b7040827bf033b80d`
- 公開ソースmain: `7f19ed5b3cb6dc05f7371ca0443e6f5028585217`
- Worker Version: `72a99834-f46f-46d3-ba47-c806f4d2876e`
- 公開先: https://swarm-front.melosalife-24.workers.dev/
- 公開記録branch: `codex/pleat-release-20261101`、baseは公開ソースSHA。
- 作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/dist-h`

PLEATのサーバー接地処理を胴体中心へ変更し、新端末への姿勢を6数値へ圧縮。旧端末には互換feet付き形式を維持する。大型の低天井通過・板の外での姿勢変更と、姿勢待ち中の攻撃抑止も含む。通常速度設定・HP・攻撃力・敵数・他ANOMALYは変更なし。狭所の移行経路と所要時間は承認済みの変更。

## 検証

統合後mainとPR #247最終head `6d2d87d123fd479f81e5c35d1504a8e020f4788c` はツリー差分なし。main上で関連14ファイル174テスト、クライアント/Worker型チェック、production build、既存本番設定のWorker dry-runが成功。buildの500KB超chunk警告は残る。設定・サービス・契約・移行の追加なし。

実Worker混在・ACK・分割・復帰21件、60走行比較、姿勢描画等の既存証拠は[通信記録](../pleat-pose-wire-20261101/README.md)、[狭所修正記録](../pleat-wall-fix-20261101/README.md)を参照。統合後のコード一致を確認しており、今回はこれらを再実行していない。

公開後の[配信結果](delivery.json): JS/CSS・入口2枚・sw・download manifestの27ファイルすべてSHA一致、health 200/ok。空Chromeの844×390でソロ起動・1.5秒移動、画面例外0。[画面](published-844.png)でゲームとPLEATの表示を目視確認。本人セーブ・本番協力部屋は使用していない。PCのスマホ幅確認であり実スマホ確認ではない。

再現は `SWARM_RELEASE_EVIDENCE=docs/evidence/pleat-release-20261101` と上記Versionを `SWARM_WORKER_VERSION` に設定し、`node scripts/check-coop-response-release.mjs`。このスクリプトは従来記録を上書きしないよう保存先指定だけを追加した。公開後記録の変更はゲーム本体に作用しないため再公開しない。

## 残る確認

本人の公開前スマホ画像は生存1:01で60FPS/往復150ms/更新9/s、1:49で60FPS/198ms/10/s、2:06で60FPS/185ms/10/s。同じ端末・回線・モードで公開後の1分/2分を比較する。これだけでは往復増加の原因を特定できない。

実スマホ・実回線協力・長時間・GPU・旧端末との本番混在・大量同時壁移行は未確認。通信量の制御条件での削減を実回線の削減率やラグ解消とは扱わない。元rootと他担当worktreeの既存差分は保持。主担当の実モデルID/推論設定は未確認、子なし。
