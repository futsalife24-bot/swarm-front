# メニュー12場面の演出を公開（2026-10-07）

本人の「メニュー・場面の候補は全部入れて、バトル中はその後で」に対応し、装備・作戦・協力部隊・武器詳細・アクセサリ・育成・敵レポート・週間報酬・ガイド・設定・履歴・試聴へ短い演出を公開。既存の配置と操作を継承し、新規依存/課金なし。戦闘中の演出と兵士音声PR137は保留。[変更と検証](MENU-EFFECTS.md)。

- 公開: https://swarm-front.melosalife-24.workers.dev/front （従来版 `/`）
- 通常統合PR140: https://github.com/futsalife24-bot/swarm-front/pull/140
- base: `800410d501fd5ac3610e19b6087976088cbca1d8`
- 最終監査対象: `3816388f4c4966ade85bf0271550ef2879de1ef8`
- 公開ソースmain: `7702d758c8fd86a26e2892d32156ff95b3d3026e`
- Worker Version: `ff0ec103-ec71-4fcd-8501-e0fe2dde6915`

[通常Chat監査](https://chatgpt.com/c/6ac5a307-3158-83ee-9ac7-7770eefca7fb)は2回。初回必須P2は改装版の一時装備へ保存成功演出が出る点。保存仕様を変えず180msの選択反応へ分離し、再読込で戻る一時選択へ成功の線/枠/発光を出さない。再検証で見つけた高速敵切替時の旧解析格子はselect時に除去。任意の演出回数・途中reduced切替も実確認を追加し、[確定再監査](evidence/menu-effects-20261007/audit-final.md)は残存必須0・任意0の合格。以後は回答/状態記録だけで、製品ソース不変を確認して通常統合、保護の迂回なし。

型・関連31単体、横画面武器一覧8表示、育成アクセサリ3サイズ、通常/reduced実UI、途中reduced切替、実ローカルWorkerへの2人ready/再準備・週間受取と演出回数が成功。統合mainから本番build・dry-run・既存Worker公開成功。既存の500KB超chunk警告は継続、失敗ではない。

公開health200、HTML・全実行JS/CSS・タイトル画像26件のSHA256一致。[配信結果](evidence/menu-effects-20261007/delivery.json)。公開IABで最新front bundle、作戦の地形背景、一時装備変更と成功cue0、一覧の実overflow0、新着表示、ガイド/戻る、従来版への往復、サウンドの実playing/光の表示とpause/消灯/close、チュートリアルtab切替/closeを確認。console error0。[実画面結果](evidence/menu-effects-20261007/published-ui.json)、[公開準備画面](evidence/menu-effects-20261007/published-prep.jpg)。最初の新規ゲームtabは既存tabによる保存保護により停止したため、新規tabを閉じて既存title tabを再読込して確認。保存保護は維持した。再生中の撮影1回は失敗したが、その後の停止/消灯を補完して確認し、他の公開画面は保存済み。

実visibilitychangeの非表示cleanupはheadlessがvisibleのままで再現できず未実測。実機タッチ、GPU長時間、全敵モデルの見え方も未確認。本番での協力参加/週間claimは未操作、実ローカルWorkerでの結果と区別する。監査側は依存を再実行せず、実ログ/JSON/画面とソースを直接照合した。これらを合格の範囲として保持。

使用モデルID・推論設定は未確認。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。GitHub https://github.com/futsalife24-bot/swarm-front 。公開後の記録は `codex/menu-effects-release-record` から通常PR統合し、ローカルmain/origin/mainの一致・cleanを確認する。
