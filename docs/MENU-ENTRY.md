# メニュー入口整理 — 2026-09-15

状態: ユーザーの「はい」で公開明示承認後、既存Workerへ公開済み。

- 通常・試遊のタイトルから開発者入口を撤去。設定右下に小さな32px高のボタンを配置。
- 更新履歴をタイトル左下に独立配置。
- 武器48丁サンプルは認証済み開発者モードから起動。終了時も開発者モードに復帰。認証なしの旧menuSample URLではサンプルを開かない。通常/テスト保存を変更しない。

検証: strict型チェック、通常/Pages build、production Worker dry-run成功。実ローカルWorkerとChromeで両入口×640×360/844×390/1280×582の6ケース、履歴開閉、設定入口、両入口から認証→48丁確認→サンプル終了→通常復帰、localStorage一致、旧URLのサンプル無効、pageerror 0。実機未確認。武器行の構造・性能列は変更していない。

branch codex/home-armory / base=head 4186f25f7c9695f95ea897ad182db5f85fac3091。既存の多数の未コミット・未追跡変更を保持。今回も未コミット。変更: src/main.ts、src/client/home-screen.ts、src/client/playtest-app.ts、src/menu-ui.css。検証: scripts/check-menu-entry.mjs。

証拠: dist-validation/menu-entry/changes.patch（今回だけの差分）、files.json（前後SHA256）、before/、built.json（6ケース）、built-*.png。公開結果は下記。

## 公開 — 2026-09-15

Version: 6394c0ec-3534-4718-9df3-d578279cf52e。https://swarm-front.melosalife-24.workers.dev/

承認後の自動レビューでは多数の既存未コミット変更の公開範囲を理由に一度拒否。4変更ファイルのみ変更前にした比較用ビルド13ファイルと現公開が全SHA一致、静的素材147ファイル一致、Worker本体もバイト一致を確認し、承認範囲がメニュー変更だけと証明して再実行が許可された。8ファイル更新、152ファイル既存。

公開検証: 配信14ファイルのSHA256一致、health ok。通常/試遊×3サイズの6ケースで左下履歴の開閉、設定右下入口と認証画面表示、通常ホームから開発者/48丁入口が除去されていることを確認。pageerror 0。公開ではパスワード送信・認証後のサンプル往復は未実行（同一配布版のローカルWorkerで成功済み）。

証拠: dist-validation/menu-entry/ の baseline-live.json、static-live.json、worker-live-comparison.json、release-files.json、published-assets.json、published.json、published-*.png。branch/base/headは上記と同一、既存差分保持、commit/mergeなし。
