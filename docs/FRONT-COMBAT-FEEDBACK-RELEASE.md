# 空中経験値・戦闘中設定・敵4倍版の公開（2026-10-03）

[改装版で遊ぶ](https://swarm-front.melosalife-24.workers.dev/front)・[旧版で遊ぶ](https://swarm-front.melosalife-24.workers.dev/)。

空中で倒した敵の経験値を歩ける地面へ配置。旧ソロ/旧協力/改装版で戦闘中に配置・音量・ジャイロ・感度等を設定できる。旧協力の配置編集が受信で消える経路も修正。改装版通常敵は出現4倍・同時上限96・HP半分、描画97体。旧版の敵数/HPとボスHP7200は維持。最大密集時は戦況・時刻を含む最終文字列で通信64KiBを守り、古い演出だけを間引く。

## 対象と独立監査

branch `codex/front-combat-feedback-20261003`、base `3e808ead8a93ce5d5242cf571de5cb0f19033f42`。[PR117](https://github.com/futsalife24-bot/swarm-front/pull/117)の通常mergeによる公開ソースは `d07902f5371a92ff67b2beca34c0f50148ac384a`。監査合格対象 `e546fc733b606c1cd9f29764ed5523d208977eea` からの差分は記録だけで、src/serverのコード一致を確認。更新履歴は日本語のPlayer-Noteで反映。

[通常Chat](https://chatgpt.com/c/6ac0a06e-6360-83ee-a5d1-0a836af08b19)の初回4倍版監査はP1通信指摘1件。最終送信後付けで容量を超える不具合を再現・修正し、同Chatの限定再監査で合格、必須P0/P1/P2各0件。監査側も4人/97敵相当の実Workerソースを独立実行し、完全/装備キャッシュ全員が64KiB以内、4009切断なし、最新演出と自己状態保持を確認。[指摘・修正・合格証拠](FRONT-COMBAT-FEEDBACK-F1.md)。

## 公開と確認

公開ソースから配信ビルドと既存Worker dry-run成功。既存 `wrangler.production.jsonc` のまま公開し、Worker Versionは `85ad7729-e40b-4e77-9d3a-8bb88dbfee56`。新規サービス/移行/権限を追加していない。

health HTTP200/ok=true。HTML2種・SW・全配信JS/CSS・強化アイコン12枚・隊員GLBの37ファイルがビルド出力SHA256と全一致、不一致0。[配信照合](evidence/front-feedback-20261003/public-delivery.json)・[ビルド](evidence/front-feedback-20261003/release-build.txt)・[dry-run](evidence/front-feedback-20261003/release-worker-build.txt)・[公開ログ](evidence/front-feedback-20261003/release-deploy.txt)。

公開ブラウザで改装版入口→出撃準備→3択→強化選択→戦闘→一時停止→設定を確認。描画上限30へ変更し、配置キャンセル後も設定値と同じ戦闘0:05を保持。上限60へ復元し再開0:06、操作なしで0:17敗北後に出撃メニューへ戻った。これは難易度評価ではない。改装版から旧版入口へ移動し、今回の日本語更新履歴も確認。最後は改装版メニューへ戻し、ブラウザ実行エラー0件。[公開設定画面](evidence/front-feedback-20261003/public-settings.png)・[旧版入口](evidence/front-feedback-20261003/public-legacy.png)。

自己検証は改装版単体23件・旧通信4件・実Worker2〜4人3件・型/ビルド/dry-run成功。設定/保存/旧ソロ・旧協力は前段の実UI証拠を保持。[全変更](FRONT-COMBAT-FEEDBACK.md)・[4倍追加検証](FRONT-COMBAT-FEEDBACK-4X.md)。物理Androidジャイロ・97体最大密集FPS・人間難易度・実ネット越し4人・既存端末のSW更新は未確認。

旧保護ブランチ `preserved/pre-rebuild-20261002` と旧入口・保存互換は維持。公開記録は文書/証拠だけを別の通常PRでmainへ保存し、コード差分がないので再公開不要。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`、GitHub `https://github.com/futsalife24-bot/swarm-front`。主担当1体、実行モデル/effort未確認、切替なし。
