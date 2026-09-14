# タイトルロゴ再差し替え — 2026-09-15

指定Drive: 11NkWHK7Ohz1a9nqPsyOcX3yECUepEBAp / IMG_20260915_064603.png。3258×4096、1,032,285 bytes、全画素不透明（alpha.json）。元PNGを無加工で public/assets/ui/title-logo-v2.png へコピー。黒背景はCSS screen合成でゲーム背景へなじませる。透過PNGを生成したものではない。輪郭・質感の追加加工はなし。

共通home-screenの参照をv2へ、画像サイズとviewBoxを新画像へ合わせた。menu-ui.cssにロゴ限定のmix-blend-mode:screenを追加。タイトルの幅・高さは以前と同じ。旧ファイルは保持。

型チェック、通常/Pages build、production Worker dry-run成功。配布版の通常/試遊×640×360/844×390/1280×582でデコード、重複/画面外/横溢れなし、設定と履歴動作、pageerror 0。1280画像を目視し黒い四角が残らないことを確認。端末実機での鮮明さは未確認、改善を定量保証しない。

既存Workerへ公開: 8b32d7b0-b306-4bb4-8e18-5489eebf7a8a。公開版でも両入口×3サイズの6ケース成功、pageerror 0。新PNGを含む15配信SHA256一致、health ok。証拠: published.json、published-*.png、published-assets.json。

branch codex/home-armory、base=head 4186f25f7c9695f95ea897ad182db5f85fac3091。既存未コミット/未追跡差分を保持、commit/mergeなし。今回対象: src/client/home-screen.ts、src/menu-ui.css、public/assets/ui/title-logo-v2.png と記録。

証拠: dist-validation/title-logo-v2/ のdrive-logo.png、alpha.json、変更前2ファイル、changes.patch、files.json、built.json、built-*.png、release-files.json。
