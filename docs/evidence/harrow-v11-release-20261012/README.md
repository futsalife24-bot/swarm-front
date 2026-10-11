# HARROW v11 公開記録（2026-10-12）

- [PR165](https://github.com/futsalife24-bot/swarm-front/pull/165) 通常merge。base `85ed091cb5642036790bf0aedc8fc369386d7430`、実装 `bb7f11ba31a83d4105eb94a6c54a9b8eeeaca71d`、公開ソース `d7600e74eb85d27c061006be6350997409a24941`。
- [通常Chat独立監査](https://chatgpt.com/c/6acc1a0c-f5d8-83ec-97fb-99eb8e165b60) は合格（資料範囲）、必須P0/P1/P2各0。対象261ecacd、最終PR head af92546fまで追加製品差分0。CIチェック表示なし、管理者バイパスなし。
- Worker Version `00096fb9-7d27-447a-b52f-d816fcddc025`。既存Worker・本番設定・既存OAuthで公開。Workers Freeアクティブを既存アカウント画面で確認。契約/認証変更・追加購入なし。
- [公開版](https://swarm-front.melosalife-24.workers.dev/front)。配信HTML・JS・CSS・v11 GLBの25/25 SHA一致、health HTTP200/ok:true、authority durable-object（delivery.json）。
- GLB 13,845,072 bytes、SHA256 `7000b43d96bd77e1e8d09caaed9ad7b657a30db745998fcaedadb4df92326f5b`。39骨/12動作、100537三角形、22スキンメッシュを3材質で描画。旧v10と生成原本保持。
- 関連98テスト・client/worker型・実GLB検査・144姿勢/16接続・実ゲームGPU確認済み。merge後に本番build/dry-runも成功。
- Windows Chrome公開版でエネミーレポート→HARROWを選び、黒い球状頭・白装甲・黄胴・非対称翼の新材質/形状、拡大と待機/攻撃切替を確認。console errorは観測なし。既存 `f_houndMatrix` 警告は公開でも4ログ観測、未解消。
- Charakuru累計360クレジット消費、残2740。ダウンロードはCodex側で取得・形式/読込/ハッシュ確認まで完了。[再発防止規則](../../skills/HARROW-DOWNLOAD-RECOVERY.md)。
- 別件未送信下書き496文字は本人承認後に一時保管し、全文一致で復元。別件本文は送信していない。

## 残る検証限界

実スマホの速度/メモリー/長時間安定性は未確認。4K画像2枚の展開メモリー負荷を含め追跡する。既存5テスト失敗・依存High5件・シェーダー警告は未解消。監査側は資料/GLBの独立検査であり、98テストや実ブラウザを独立再実行していない。[詳細](../../HARROW-V11-AUDIT.md)。公開UIの確認を全戦闘/全端末の成功へ拡張しない。

前公開Version `17a5c735-88a8-44b5-9945-54440cdf6ecd` を復帰参照として保持。rollback未実施。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。主担当実モデルID/推論設定未確認、動作/契約補助 gpt-6-sol / medium。記録のみの追加では再ビルド/再公開不要。
