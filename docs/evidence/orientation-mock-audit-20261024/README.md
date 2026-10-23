# 縦横モックの独立監査・修正の証拠

2026-10-24、Claude Code。監査対象 `e9a8ac4`（公開中のゲーム実装 `0a1437f`）、修正branch `claude/orientation-mock-audit-20261024`。Windows Chrome（携帯表示・タッチ有効）での確認で、Android実機の結果ではない。内容は [監査と修正](../../ORIENTATION-MOCK.md#claude-code独立監査と修正2026-10-24)。

- `before/layout.json`・`before/layout-915x412.png`: 公開版で、横915×412の「スコープ」「切替」が配置編集パネルに覆われ、中心と四辺のどこにも当たらない。未編集で回転して戻ると未保存確認が出る（`falseDirtyAfterRotate: 1`）。
- `after/layout.json`・`after/layout-915x412.png`・`after/layout-390x844.png`: 修正版で、320×568〜915×412の全配置ボタンに当たり、未保存確認なし。
- `trial-events.json`: 射撃場からの試し撃ちで、試し撃ち世界の射撃・命中が処理済み扱いで破棄されていた実測（診断値だけを足した `e9a8ac4`）と修正後。
- `before/defeat.json`・`after/defeat.json`: 無操作での小規模・大型・密集戦の敗北までの時間と、結果画面の見出し（修正前「作戦完了」、修正後「作戦失敗」）。
- `navigation-crawl-390.json`: 画面一覧を使わずタイトルから巡回した到達画面・遷移・無反応候補。無反応候補は押下状態の切替など見た目の長さが変わらない操作を含み、PV・大型戦・密集戦が通常導線にないことを確認した。
- `load-live-0a1437f.json`: 公開版の初回・各戦闘開始の取得件数・転送量・拡張子別内訳と所要時間（PC回線）。
- `isolation.json`: 修正版のE2E全9シナリオの禁止通信・WebSocket・SW・Cache・本編保存アクセスの集計（いずれも0）。

公開版は修正前のため、修正版の公開確認は未実施。
