# 初会敵イベントの連続ズーム — 2026-09-14

ゲーム画面停止180ms → 上下黒帯320ms → 現在カメラから相手へ1200msで補間 → 名前・記録テキストを表示。位置・回転・画角を補間し、同じ停止シーンを描画する。閉じる際にアニメーションを解除して元のカメラへ復元。非表示タブでは演出時間を進めない。

変更: src/client/playtest-app.ts（演出と開発時診断）、src/client/playtest.css（黒帯・文字の段階表示）、scripts/check-encounter-sequence.mjs / check-encounter-published.mjs（検証）。

branch: codex/home-armory。base/head: 4186f25f7c9695f95ea897ad182db5f85fac3091。未コミット、既存差分を保持。今回だけの実差分は dist-validation/encounter-sequence/app.patch と style.patch、着手前ファイルも同じ場所に保存。

検証: 型チェック、通常/Pages build、公開Worker dry-run成功。既存500KBチャンク警告あり。Chrome 844×390 / 1280×720の各133フレームで4段階順序、文字の遅延、停止中のカメラ維持、ズーム中の移動、ゲーム時間停止、閉じた後の戦闘再開、pageerror 0を確認。text-844.pngを目視確認。実スマホ受入は未実施。

公開: game/AGENTS.mdの既存Worker公開方針により反映。Version 4b9716c4-5cad-464d-b022-5ee0d332a0ff。
https://swarm-front.melosalife-24.workers.dev/?playtest=1
`n公開後: JS/CSS/index全10ファイルのSHA256一致、844×390で4段階順序・戦闘再開/停止、pageerror 0、health正常。証拠: dist-validation/encounter-sequence/published.json / published.png。
