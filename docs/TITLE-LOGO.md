# タイトルロゴ — 2026-09-15

ユーザー指定Driveファイル 1ynLeXGfU-8PhvhakmOmx2fqS36oGVR9p（GridArt_20260915_063516662.png）を採用。4096×5150、完全透明19,087,185画素・半透明916,214画素。元PNGを無加工で public/assets/ui/title-logo-v1.png へコピー。imagegenで以前作った市松模様付き画像は不採用。

home-screen.tsの共通タイトルをh1/aria-labelを保持してPNG表示へ置換。SVG viewBoxは透明余白だけを表示上で省く枠として使用し、元画像のピクセル・アルファは変更しない。menu-ui.cssで幅と高さを横画面に追従。通常/試遊/開発者の共通タイトルに適用。

検証: 型チェック、通常/Pages build、production Worker dry-run成功。配布版の通常/試遊×640×360/844×390/1280×582で画像デコード・ロゴと説明文/メニューの非重複・画面内表示・履歴/設定動作・pageerror 0。実機未確認。

公開: 既存Worker、Version 8f6ec8a3-fd5c-4231-bb22-e18c4c26a6e7。変更直前の配布14ファイルと現公開のSHA一致を確認後に実行。公開後も通常/試遊×3サイズの6ケースで画像・配置・設定/履歴動作成功、pageerror 0。PNGを含む15配信SHA256一致、health ok。証拠: published.json、published-*.png、published-assets.json。

branch codex/home-armory / base=head 4186f25f7c9695f95ea897ad182db5f85fac3091。多数の既存未コミット・未追跡変更を保持、commit/mergeなし。今回の変更は src/client/home-screen.ts、src/menu-ui.css、新規PNG、検証スクリプト scripts/check-title-logo.mjs と記録。

証拠: dist-validation/title-logo/ の drive-logo.png、alpha.json、before/、changes.patch、files.json、built.json、built-*.png、previous-live.json、release-files.json。採用PNGのリンク: [title-logo-v1.png](../public/assets/ui/title-logo-v1.png)。
