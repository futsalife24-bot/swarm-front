# ステージ選択の難易度別ミッション表示（2026-09-15）

## 変更

- 通常ソロのステージ選択を既存ゲーム内ダイアログのまま1列化。
- 未解放ステージの名前は「？？？」。ST番号は維持。通常ステージは前ステージNORMALクリア、分岐ステージは既存branch、管理者は既存全解放に従う。
- 各行右端へNORMAL / HARD / EXPERTを並べ、各3ミッションの位置に対応する「★★★」を表示。達成星は金、未達成星は灰色。未解放難易度はラベル・星とも減光。
- 保存上のnormal= NORMAL、medium= HARD。EXPERTは現在のゲーム・保存に存在しないため常時未解放表示。難易度の追加実装・バランス・保存形式の変更はない。
- 出撃準備の難易度選択も同じ表示名に統一し、EXPERTは選択不可。未解放ステージ自体の選択と既存出撃可否判定は維持。
- 汎用ピッカーには任意の行描画関数だけ追加。武器フィルター・協力ロビー等の既存選択UIは継承。

## 自己検証

- `npm run typecheck` 成功。
- `npm run build` / `npm run build:pages` 成功。既存の大チャンク警告あり。
- `npx playwright test --config playwright.playability.config.ts e2e/game-select.spec.ts` 実Chrome 4件成功。
- 新規ケース: 初期未解放名、NORMALクリアで次ステージ/HARD解放、NORMALの1・3番目とHARDの1・2番目の達成星、EXPERTロック、667/844/1280×390の1列・非重複・非横溢れ、ステージ変更とfocus復帰。
- 既存3ケース: 実メニュー再描画後の武器フィルターfocus、汎用再描画、横画面選択/無効項目/キーボード操作。
- `test-results/game-select-stage-picker-m-7c833--mission-at-landscape-sizes/stage-stars-{667,844,1280}.png`。667px画像を目視し星色・非重複・一覧密度を確認。生成スクリーンショットはGitへ追加しない。
- `git diff --check` 成功。実スマホは未確認。

## 監査・公開

開始base/main: `ca78e955d5a732b163f802f5ed38f451025cb9b1`。
作業branch: `codex/stage-mission-stars`。
README第9行の独立監査後承認条件を維持。今回のmain反映・Worker公開は未実施。
独立監査ではPRのbaseからHEADまでの実差分を参照。保存/戦闘処理の変更はなく、`stage-picker.ts`の解放表示と既存保存の対応、ピッカー描画、横画面CSSが中心。
