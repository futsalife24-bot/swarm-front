# ANOMALY出現SEの無効化を公開（2026-10-14）

[PR181](https://github.com/futsalife24-bot/swarm-front/pull/181)を通常merge。公開ソース7af5f6dbd156f6dfd7a6a8c0f716d67b4618d128、Worker d822510a-a68b-495a-8c55-044237aa60de。

通常個体の出現予告とボス出現のburstにsilentを指定し、SEだけ除外。現行front・互換front・rebuildの6箇所。演出・出現数・採用済みの声・0.24ゲイン・攻撃予告・通常爆発は保持。

src/worker型、既存32テスト、新規6ケース成功。担当側の実Sound/Audio/WAVでは出現イベント2件/音源開始0、通常burst1/声1。独立監査670c2eaは必須0・任意0、19確認グループ成功。新旧40step比較や実通信packet生成でもsilent以外を維持。

merge後build/dry-run/deploy成功、配信67/67 SHA一致・manifest一致・health200/ok・durable-object。公開iabでタイトルと2026-10-14の更新履歴を確認。実戦操作・実スマホ・実聴は未確認、実WebSocket接続の再検証は今回行っていない。画像はツール目視でPNG保存なし。検証用サーバー終了済み。モデルID/推論設定は未確認、新規サブエージェントなし。

公開先: https://swarm-front.melosalife-24.workers.dev/front
正本: https://github.com/futsalife24-bot/swarm-front.git
ローカル: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a
