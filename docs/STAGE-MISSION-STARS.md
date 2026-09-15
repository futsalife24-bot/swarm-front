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

## 公開完了

- 独立監査は対象HEAD `c5bb24de95621d1fb3ac80ab955c91a9ec71fe10` に合格・必須指摘なし。672条件と型チェックを独立確認。画像の独立目視・実スマホは未実施。
- ユーザー「公開までやって」により公開まで承認。[PR #8](https://github.com/futsalife24-bot/swarm-front/pull/8)を2026-09-15 23:32 JSTに通常merge。公開ソース `dad42c16777566b2d5d8250d610151bb21e5184e` と監査HEADはtree差分0。
- production Worker dry-run成功後、既存Workerへ6更新assetを公開。Version `3b3eec16-9936-4101-899e-48584ac1cf5f`。
- https://swarm-front.melosalife-24.workers.dev の更新6ファイルとsw.jsの計7ファイルで配信SHA256一致。api/healthは200・ok。
- 公開実Chrome隔離profileの667/844/1280×390で伏せ字・3難易度の達成星・未解放減光・非重複・ステージ変更・focus復帰成功、pageerror 0。667px公開画像を目視確認。達成状態は検証用ブラウザ内の保存fixtureを使用。
- 証拠: dist-validation/stage-stars-release/results.json、check.mjs、published-{667,844,1280}.png。実スマホ未確認。上記の監査・公開保留は解消済み。
