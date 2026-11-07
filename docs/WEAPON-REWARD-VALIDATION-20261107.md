# 武器報酬・詳細 UI 実検証（2026-11-07）

Codex の実行結果。Claude のデザイン自己申告とは別の記録。
既存 worktree 内だけで検証。commit / push / merge / 公開は未実施。

## 最終 CSS

- `src/client/weapon-detail.css`: `82E2D71EC83F61C28B3412E8ED59FFEC69A208D12DA9F8DA6803E9FA726A82AA`
- `src/client/front-result-ui.css`: `AD0A36252B186CCA06E50AE3483191B72A492A7DD5C8AE1646E31B3938627D78`
- `src/style.css`: `0A11E9754041F25B4AAAD8865D98C331C6A7F6F24CE5DDB3F474F7C2FCE7AC98`

## 成功した確認

- `check-reward-weapon-details.mjs`: 844×390 / 640×360 / 568×320、12武器ずつ計36詳細を最終 CSS で確認。左画像枠・右性能表、通常の縦横 overflow 0、44px 操作段、ボタン整列、比較選択なし、共有文言、長押し/タップ/キー、キャンセル/スクロール、ロック/解除、再描画、離脱を確認。閲覧のみでは保存不変。
- `check-survival-result.mjs`: 前版 `4E02F395…` で3サイズの return / defeat / short（9条件）と844/640の save-failure（2条件）合格。568未保存時の19px overflowを検出して修正依頼。
- 最終 CSS で save-failure を3サイズとも再検証し合格。未保存注記は初期可視・ボタンと非重複、縦横 overflow 0、ロック無効。再保存後の詳細ロック有効化、ロックの永続化/解除まで確認。
- 関連単体54件、クライアント/worker型検査はロジック実装時に成功。
- 最終 CSS でクライアント/worker型検査と production build を再実行し成功。build 10.93秒、既存の大きいチャンク警告あり。`git diff --check` も成功。

## 証跡

- `dist-validation/reward-weapon-details/results.json` と各幅の `*-detail.png` / `*-result.png`
- `dist-validation/survival-result-rewards/results.json`: 前版で成功した11条件。失敗画像/JSONも履歴として保持。
- `dist-validation/survival-result-final-target/results.json`: 最終版568未保存の単独確認。
- `dist-validation/survival-result-final-save/results.json`: 最終版3サイズの保存失敗→復旧。
- 568の通常詳細・未保存詳細を画像として実視。初期版7px、小画面17px、未保存19pxのはみ出しを段階的に検出し、修正後に再確認した。

## 限界・未検証

- 36件の3D確認は canvas 生成までで、全画像のピクセル判定ではない。既存 JSON の `previewModels` はこの意味。今後のスクリプト表示を `previewCanvases` に修正済み。
- KB-6 / RL-2 のプレビュー描画はスクリーンショットを実視。最終568未保存SG-4の画像では枠内が空に写った。撮影時機か固有モデルか未分離で、全武器3D描画の実視保証はしていない。
- 日次防衛・旧協力の結果入口は実 UI 未検証。日次既存テストは別 Worker とクラウド保存作成/削除を伴うため、この限定作業では実行していない。共通詳細の合格を全入口の保証に広げない。
- 生存の同時実行中に GPU 準備 1/15 のタイムアウトを1回確認。進撃終了後の単独実行は進行したが、原因は断定していない。
- フィクスチャは実 UI と保存経路を検証するもので、通常の戦闘を最後まで遊んだ証跡ではない。

## 後片付け

テストブラウザーは各 finally で終了。自分の専用 Vite `127.0.0.1:5199`（session 73676）は Ctrl+C で終了済み。他のプロセス・設定・権限は変更していない。

## 残件再確認（2026-11-07 UTC、同一 HEAD）

- Windows 再接続後、既存差分を保持して検証再開。製品 TS/CSS の追加変更なし。
- 568×320で12武器すべての描画前景ピクセルを検出し、個別スクリーンショットを実視した。空の canvas を合格にしない検査を追加。証跡 `dist-validation/reward-weapon-details/all12-pixel-results.json` と `568-<kind>-detail.png`。
- SG-4 は5レア度すべて前景3280px/51000px、画像でも描画あり。`568-shotgun-r0.png` 〜 `r4.png`。前回の空枠は今回再現せず、特定レア度のモデル欠落という説明は支持されない。過去の一過性事象の原因は未確定であり、根治と断定しない。
- 日次・旧協力の実結果描画関数へ、隔離ブラウザー内の合成終了状態を渡した。両方で武器名タップ→共通詳細→ロック保存→結果行更新→ホーム復帰を確認。`dist-validation/extra-reward-entries/results.json` と各 mode の detail/result PNG。これは日次クラウド入場・旧協力WS実参加の検証ではない。
- 旧協力fixtureの初期試行は保存初期化不足と新形式武器を旧形式報酬へ渡したため失敗。実際の旧協力報酬形式にfixtureのみ補正し成功。製品の保存検証は緩和していない。
- 最新 CSS SHA は上記82E2D71E…で維持。検証サーバーsession25334と全テストブラウザーは終了済み。commit/push/merge/公開は行っていない。
