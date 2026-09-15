# 武器ロック画像（2026-09-14）

生成した金色の閉じた錠前／白銀色の開いた錠前を public/assets/ui/weapon-{locked,unlocked}.png に保存。gear-weapon-list.ts の共通マークと playtest-app.ts の武器詳細へ導入。gear-weapon-list.css は既存30px行・44pxボタンを維持し画像22×24px、固定/未ラベルを併記。画像クリック後のinnerHTML差替えでイベント対象が外れ、武器詳細へ伝播する問題をstopPropagationで修正。

検証: typecheck・build成功（既存チャンク容量警告）。check-gear-ui-baseline.mjs はローカル/配布版で4寸法×通常/整理合格。最終CSS修正後も配布版8条件成功。画像ロード・画像クリック切替・解除確認・誤った詳細表示がないこと・詳細アイコンをcheck-lock-icons.mjsで確認。844×390一覧と詳細PNG目視済み。公開12ファイル（画像2種含む）のSHA256一致。実スマホ未確認。

既存試遊URL: https://congressional-structured-thirty-keeping.trycloudflare.com
固定Workerは未変更。既存プレビュー配信のdist更新を照合。
branch: codex/home-armory
base/head: 4186f25f7c9695f95ea897ad182db5f85fac3091
未コミット。既存の変更・未追跡ファイルを保持。
証拠: dist-validation/lock-icons/ の before、changes.patch、icons.json、delivery.json、locked-844.png、unlocked-844.png、detail.png。レイアウト結果: dist-validation/gear-pinned/built.json。
