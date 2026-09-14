# 2026-09-14 装備切替SE・性能下線

同じ一時試遊URLに反映済み。固定Workerは未変更。

- 装備変更が保存に成功した後、戦闘と同じswitch.wavを再生。最初の操作でも実音源のデコードを待つ。同じ武器・入替先選択では鳴らさず、消音設定を維持。詳細からの変更も共通処理。
- 性能値の文字は白固定、従来の5色を2px下線へ移行。名前・レア度色は維持。◎を廃止、最大補正20の☆を★へ変更。数値・抽選条件は不変。
- 共通一覧・先頭固定行・詳細・サンプル凡例・共有画像へ適用。共有画像を実生成して確認し、外部共有はしていない。

検証: 型/build成功（既存500KB超チャンク警告）。必須check-gear-ui-baseline.mjsで4寸法×通常/整理8条件、30px行・文字収まり・固定・ロック・解体・フィルター成功。check-weapon-feedback.mjsは実AudioBufferのSHA256からswitch.wavを特定し、初回装備・2回目・詳細からの装備で3回再生、同一品/スロット選択/消音は無音。一覧/詳細の白文字・5色下線・★、旧記号不在、描画例外0。check-weapon-feedback-image.mjsで詳細と共有PNGを目視確認。公開10ファイルと最終distのSHA256一致、公開検査はread-only。実スマホの聴感は未確認。

branch: codex/home-armory、base/head: 4186f25f7c9695f95ea897ad182db5f85fac3091、未コミット。既存差分を保持。変更: src/client/playtest-app.ts（確定後SEと凡例）、playtest.css（白字と下線）、weapon-sharing.ts（共有描画）、src/shared/progression.ts（表示記号のみ）、検証2本。

証拠はdist-validation/weapon-feedback/のbefore、changes.patch、hashes.json、feedback.json、layout.json、delivery.json、各PNG。今回のソースと差分をdist-validation/weapon-feedback-audit.zipに同梱。
