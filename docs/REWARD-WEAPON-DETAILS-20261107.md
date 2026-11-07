# 戦果の武器名長押し（2026-11-07）

## 依頼と対象

本人の「この報酬画面で武器名長押しで武器詳細画面を表示して。無いなら全武器で作って。」に対応。添付に一致する進撃の戦果画面 `result()` を対象とし、既存の全12武器共通 `detail()` を再利用する。3Dモデル、特殊効果、全性能、装備比較、ロックは既存機能。新しいページデザインやレイアウトは作らない。

基点 main `ac14198177bd3184ba7843c64da07155f346d1de`、worktree `task-reward-weapon-details`、branch `codex/reward-weapon-details-20261107`。rootと他worktreeの差分は変更しない。

## 実装

- 武器名ボタンの500ms長押しで既存詳細を一度開く。終了後の合成クリックを抑止して二重に開かない。
- 8px超の移動、スクロール、指が外れる、pointercancel、複数指、非表示、画面離脱、画面回転・サイズ変更で取消。Pointer captureやpointerdownのpreventDefaultは使わず、ネイティブスクロールを維持。
- 既存のタップ・マウスクリック・Enter・Space・補助技術のクリックを維持。武器名に `aria-haspopup=dialog` を付け、詳細を閉じたら元のボタンへフォーカスを戻す。
- 右端のロック、特殊効果、ソート、絞込みを変更しない。再描画と画面遷移でタイマー・監視を破棄。
- 保存、報酬付与、武器数値、戦闘、協力通信、装備設定は無変更。ロックや共有は既存の明示操作のまま。

## 検証

- `node ../node_modules/vitest/vitest.mjs run --config vitest.front.config.ts tests/front-reward-weapon-details.test.ts tests/front-gear-weapon-rows.test.ts`: 17件成功。
- クライアントとWorkerのstrict型チェック成功。
- `git diff --check` 成功。
- 実UI検証は未到達: `scripts/check-reward-weapon-details.mjs` を準備したが、下記の起動遅延と審査停止により画面確認は成功していない。localhost限定の結果・保存fixtureから通常の製品UIを使い、全12武器の長押し、3D表示、比較表、クリック/キーボード、スクロール取消、ロック、再描画を2サイズで確認する計画。攻略や報酬獲得そのものの証明ではない。

初回Vite起動は186秒。初回画面読込は依存最適化中に60秒で失敗し、UI未到達。起動完了前の接続拒否もテスト準備失敗として区別する。初回サーバーは停止した。他の統合担当と同じローカル検証限定の `optimizeDeps: { noDiscovery: true, include: ['three'] }` を準備したが、その再起動の結果取得がVisual Studio telemetryの不要な外部通信として審査で拒否された。公式opt-outを指定した読み取り専用ポート確認でも同じ拒否を受けたため、別経路で回避せず追加起動を停止した。localhost5198のfetch失敗だけ確認、起動途中プロセスの有無は未確定。製品Vite設定、公開設定、タイムアウトは変更していない。

## 未完了

統合後の公開用build、CI、main反映、既存Worker公開・配信確認は統合担当が行う。実Android/PWA・実端末での長押しの感触は未確認。本作業単体ではpush・公開を行わない。
