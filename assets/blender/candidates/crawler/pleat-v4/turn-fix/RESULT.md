# PLEAT 攻撃後の半回転修正

2026-09-11。branch codex/home-armory / HEAD 2be699f160c83d641fb68bb1304e4da8059920dc。未コミット変更あり。変更はsrc/client/render.tsの攻撃中の向き保持のみ。開始前ファイルはrender.before.ts.txt。他の差分を維持。

原因: 攻撃後の回復中も、移動する敵の現在位置から古いtx/tz地点へ向き直していた。元の照準地点を通過すると背後を向く。実shared step＋実Renderer＋公開用GLBの再現で最大3.078rad（約176度）、回復中3サンプルに反転。

修正: 攻撃時のyawを保持し、回復中は位置移動によって再計算しない。終了・inactive・run/null等の既存解除を維持。モデル、戦闘性能、攻撃判定、shared、サーバー変更なし。

検証: check-turn.mjs before/afterで反転3→0サンプル、最大角度3.078→0.049rad。同じ条件で古い地点通過を確認。型検査、関連12テスト、既存攻撃18条件、リセット6条件、Viteビルド成功。実Rendererスクリーンショット保存。動画全編・実スマホ検証は未実施。ビルドの既存チャンクサイズ警告あり。

公開: 自動承認レビューで拒否されたため未実施。理由は今回の修正版公開への明示承認がないとの判断。本番は前版2e5595d6-8841-4aa6-bf73-884cb845bc9aのまま。公開承認を受けたらデプロイと配信一致検証を行う。

## 公開完了
2026-09-11、ユーザーの追加承認『公開して』に基づき公開済み。Version a42ea2da-792a-42d0-8271-f4c423c30a93。公開URL https://swarm-front.melosalife-24.workers.dev 。更新はindex.htmlとindex-C-vukkbV.js。配信JS/CSS/GLBのSHA-256が検証済みdistと一致（published/hashes.json）。上記の公開保留は解消。
