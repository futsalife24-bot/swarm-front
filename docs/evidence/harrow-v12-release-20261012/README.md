# HARROW v12 公開記録（2026-10-12）

- [PR167](https://github.com/futsalife24-bot/swarm-front/pull/167) 通常merge。base `9bdb1d29b8692ad62e7f7b46aa819c19bad55365`、最終実装 `e9f9e373c3341f03b487d0fcee9b0bdb5228221d`、公開ソース `b917d4f2a35c5ad8231d2a9e55ebd1afce03f4d1`。
- [通常Chat独立監査](https://chatgpt.com/c/6acc45c7-1978-83ec-8776-15d96f976047) 最終合格。突進途中命中・遅延ミサイルのP2修正、旧SHAを指したビルド証跡を修正し、必須P0/P1/P2・証跡不備各0。記録head48cb6f2まで確認、その後の1fa043cは監査結果文書のみ。保護バイパスなし。
- Worker Version `68f940a7-984f-4500-87bf-6571dc23aa4d`。既存Worker・本番設定・既存OAuthで公開、既存Workers Free有効を確認。契約・権限・購入の変更なし。
- [公開版](https://swarm-front.melosalife-24.workers.dev/front)。HTML・JS・CSS・v12 GLBの25/25 SHA一致、health HTTP200/ok:true、authority durable-object。[配信証拠](delivery.json)。
- v12 GLB SHA256 `b0d0664b7ea65b65f0416b5d0c5aad2386f42d668d00ef7826d201a858d96ddd`。14,127,724 bytes、39骨/18動作。v11形状・材質・UV・ウェイトを保持。旧版・Blender原本・再現コードを保存。
- 関連133テスト・型、実Worker/2WebSocket22検査、形状・接地・発射元・遷移・Blender再open成功。監査修正後はHARROW36テスト（既存33+新規3）・型・通信22検査成功。最終対象とmerge後公開ソースそれぞれからbuild/dry-run成功。
- Windows Chromeの既存公開ゲームタブを再読込し、エネミーレポートで新しいHARROW説明・攻撃選択一覧、爆撃通過/低姿勢回転の選択、v12モデル表示と拡大操作を確認。爆撃の空中姿勢・予告表示を目視。観測範囲のconsole errorは0。既存シェーダー警告4件は再読込前の旧JS記録として残っており、解消とは扱わない。公開画面だけで全攻撃の命中・全端末性能を認定しない。
- 下書き496文字は本人の今回の承認後に保管し、HARROW資料だけを送信してから全文一致で復元。別件本文の送信なし。

## 継続する検証限界

実スマホ性能、長時間GPU負荷、人による難度評価は未確認。Idle→Takeoff/Land→Idleの尾先補間前差1.146m、支持足滑り最大0.1083mは継続評価。既存全体5テスト失敗・依存High5件は未解消。監査側は資料とソースの独立確認で、テスト/通信/全実画面の独立再実行ではない。[監査詳細](../../HARROW-V12-AUDIT.md)。

前公開Version `00096fb9-7d27-447a-b52f-d816fcddc025` を復帰参照として保持、rollback未実施。ローカル作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。mainは既存worktree `C:/Users/futsa/Documents/Codex/2026-10-09/swarm-soldier-motion` でも同期し、この作業場所のHEADと同じSHAへ合わせる。主担当の実モデル/推論設定未確認、補助2担当はgpt-6-sol / medium。記録のみの追加は再公開不要。
