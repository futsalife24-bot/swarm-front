# メニュー外観・装備2の枠外表示修正 — 2026-09-10

## 結果

人類側の前線指揮端末を意識し、暗い金属パネル、角を落としたボタン、加工した縁、薄い内枠・隅のマークを導入。主操作はミントと淡いオリーブ、警告・分解は琥珀色に統一。ホーム、出撃準備、武器庫、協力入口・ロビー、結果、設定・履歴・ヘルプ・敵レポート、一時停止へ共通適用。操作位置や保存・通信仕様は維持。画像・外部フォント・依存の追加なし。

装備2は左欄の高さに対して92pxの固定最小高を持つ2枚のカードが押し出される状態を修正。左欄をサイズコンテナとし、残り高さを2枠へ分配。コンテナ高さ330/220/175pxで文字・余白・補助表示を縮める。低い画面での効果の省略は従来と同じで、右一覧の効果説明へアクセスできる。枠外を隠すだけの修正ではない。

## 検証・限界

- 型チェック成功、単体175件成功。
- メニューE2E 15件成功。640×280、844×390、915×412、1280×582、1100×610、1280×720、390×844。選択・保存・分解の取消/失敗・フォーカス・ヘルプ・設定・敵レポート・協力入口を確認。
- 安全領域を含む追加回帰テスト成功。1280×650、上100px/下40pxの安全領域、通知16pxで、旧テーマなしの基準表示は装備2が58.5pxはみ出し、修正版は0px。左欄とボタン内容のスクロール超過も0。写真の実機環境そのものの再現ではなく、同じ高さ不足を再現した条件。
- ローカル実Worker 3件成功。4人ロビーの装備/準備状態/ステージ同期、ホスト権限、結果・上限超過戦利品・再出撃。結果は隔離fixtureを使用。
- 通常/Pagesビルド、公開Worker dry-run成功。初回dry-runのサンドボックス読取拒否は権限付きdry-runで解消。Pagesの既存500KB超チャンク警告あり。
- 配布用ビルドを1280×582・844×390で確認。JS/CSS SHA-256一致、設定保存、比較拡大、ソロ開始/一時停止/撤退後の装備2枠内表示、開発用グローバルなし、ページ例外なし。
- ホーム、準備、武器庫、設定、敵レポート、一時停止、4人ロビー、結果の実画像を自己確認。
- 変更CSS・テストのPrettier成功。git diff --checkには既存docs/STATE.md末尾空行の警告あり（今回追加した差分には該当しない）。
- 実Android/iPhoneの表示・操作感は未確認。独立監査は実施していない。

## 変更と監査証拠

- branch: codex/home-armory
- base / HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc
- 未コミット変更あり。既存の変更・未追跡物を保持。commit/mergeなし。
- src/main.ts: menu-theme.css の読み込み1行のみ追加。
- src/menu-theme.css: 共通外観と装備欄の高さ連動。
- e2e/menu-ui.spec.ts: 2サイズ追加、装備2の枠内判定、安全領域と大きい通知文の回帰テスト。
- scripts/check-menu-design.mjs: 配布物一致と画面/操作確認。
- scripts/inspect-menu-design.mjs: 同条件の旧表示/新表示の回帰証拠作成。
- docs/MENU-DESIGN.md、docs/STATE.md: 今回の結果と公開状態。
- dist-validation/menu-design/: task.patch、checks.json、regression.json、regression-before/after.png、production-preview/checks.json、実画面、各検証ログ。

主要差分の内容: `import "./menu-theme.css"` を追加し、横画面の `.gear-brief` に `container: loadout / size`、装備領域と一覧に `flex: 1; min-height: 0`、2枠のボタンに `flex: 1 1 0; min-height: 0; max-height: 92px` を適用した。残り高さをカードが共有し、下部の出撃操作との重なりを防ぐ。

## 公開状態

**公開済み。** 2026-09-10、ユーザーの「はい、承認します」を受け既存Workerへ公開。

- URL: https://swarm-front.melosalife-24.workers.dev
- Version: `5e7b333c-bfe4-42d4-911a-85211554b2de`
- 公開後の1280×582・844×390で表示・操作・保存・ソロ開始/一時停止/撤退成功。撤退後の装備2の枠内表示を実画像でも確認。ページ例外なし。
- 公開JS/CSSは元の検証済み配布物とSHA-256完全一致。`/api/health`は`ok: true`。
- 初回の自動承認レビュー拒否は、今回の明示承認後の公開成功により解消。

承認待ちの間に別作業のマップ開発が進み、共有ソースとdist/Workerビルドが更新された。別作業を保護するため、`approved-source/`へソースをコピーし、メニュー着手時のmain.ts（テーマimportを追加）とmaps-blender/beforeの保存ソースから承認時の状態を復元。復元ビルドのHTML/JS/CSSが元の検証済みSHA-256と完全一致することを確認した。同じ隔離ソースでWorker dry-run成功後、その設定から公開。元のsrc・distは戻していない。

公開用証拠は `dist-validation/menu-design/approved-rebuild.log`、`approved-worker.log`、`deploy.log`、`published.log`、`published/checks.json`、`published/*.png`、`health.json`、`release-status.json`、`release-manifest.json`。初期の`release/`コピーは別作業の配布物が混ざったため未使用。公開実体は`approved-source/`。`task.patch`は承認前の実装差分で、公開状態は本書とrelease-status.jsonを正とする。
