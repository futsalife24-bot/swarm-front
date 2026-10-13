# 採用版ボイスv3の公開完了（2026-10-13）

- PR179: https://github.com/futsalife24-bot/swarm-front/pull/179 、通常merge済み。
- 公開ソース: e6e02df6d2b2a98b4e580b832eb2e9820b6633b5。
- Worker Version: 6c6a3558-dae2-4945-b6f1-ed9839f4121c。
- 公開先: https://swarm-front.melosalife-24.workers.dev/front
- 試聴: https://swarm-front.melosalife-24.workers.dev/anomaly-voices.html

本人がv3全20声を一式採用。PRISMを改訂し、通常FOUNDRYを保持して連結中・分離後を別音源化。将来の名称独立・別ボス化は未実施。図鑑の2状態試聴を上下2行に修正。最終製品b48238bの通常Chat監査は必須P0/P1/P2各0、67確認グループ成功。任意R1のPR採用状態も更新済み。監査後の追加は記録のみ。

merge後mainからvite build exit0、その後Worker dry-run exit0、既存Worker deploy exit0。配信67/67 SHA一致、manifest一致、health 200/ok・durable-object（delivery.json）。公開Chromeの33音声はreadyState4/errorなし。ボス3系統比較が9秒終端まで完走。横幅1263pxでscrollWidth一致。画面はツール画像目視、PNG保存とは区別。一時viewport解除成功。

主担当・監査側の実聴、実スマホ、戦闘SE/BGM混合は未確認。本人の採用と区別する。関連17テスト・型・23WAV検査などはverification.md、最終監査はaudit.md。モデルID・推論設定は取得不可のため未確認。この追加作業に新規サブエージェントは使用していない。

ローカル: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a
正本: https://github.com/futsalife24-bot/swarm-front.git
