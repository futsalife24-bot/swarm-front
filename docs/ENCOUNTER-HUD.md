# 会敵イベント中のHUD非表示 — 2026-09-15

会敵ダイアログ `.pt-cutscene[open]` の存在にCSSを連動し、HUD・操作・ミニマップ・一時停止・ダメージ数字・スコープを非表示にした。HUD内のHP、wave、弾数、装填中、照準も対象。停止開始から黒帯、ズーム、敵名表示まで適用し、閉じると既存の表示設定に戻る。敵名・レポート記録案内・スキップは維持。

実装差分は src/client/playtest.css の5行。既存未コミット/未追跡変更を保持。branch codex/home-armory、base=head 4186f25f7c9695f95ea897ad182db5f85fac3091。commit/mergeなし。

検証: typecheck、通常/Pages build、production Worker dry-run成功。Chromeタッチ横画面844×390/1280×582で実際の初会敵を起こし、全4段階のHUD非表示、スキップ後の表示復帰・射撃・装填表示・一時停止、pageerror 0を確認。844のムービー画像を目視確認。実機未確認。

検証スクリプトの初回はPC条件でタッチボタンが非表示、次は短すぎる押下で射撃が発生せず失敗。タッチ条件と500msの押下へ修正後に両寸法成功。Worker dry-runはWindowsアクセス制限で失敗後、権限付き実行で成功。公開前照合はネットワーク権限と.assetsignoreの配信対象外を反映後に成功。

公開範囲: ソースを変更せずVite変換でCSSだけ変更前へ戻した比較ビルドは、現公開162配信ファイル全SHA256一致。Worker dry-runのSHAも既公開記録と一致。

既存Workerへ公開済み。Version: 4d3a3fbd-52bb-44ae-9665-6058185f8e51。

公開後も同じ2寸法で全4段階のHUD非表示・復帰後の射撃/装填/一時停止成功、pageerror 0。14配信ファイルSHA256一致、/api/health ok。証拠: published.json、published-*.png、published-assets.json。

証拠: dist-validation/encounter-hud/changes.patch（今回だけの実差分）、playtest.before.css、built.json、built-*.png、baseline-live.json。検証コード: scripts/check-encounter-hud.mjs、scripts/check-encounter-hud-baseline.mjs。
