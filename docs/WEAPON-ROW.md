# 出撃準備の武器一覧を1行表示へ（2026-09-12）

武器名・特殊効果・威力・装弾・装填・射程・連射・装備マークを同一行に配置。狭幅/横画面CSSで指定されていた2段配置を出撃準備だけ上書きし、見出しを各列に揃えた。行高44px、列間5px。内容を潰さない最小幅489pxを設定しており、それ未満の一覧領域は横スクロールになる。

変更: src/menu-ui.css、検証: scripts/check-weapon-row.mjs。
branch: codex/home-armory。base/head: 4186f25f7c9695f95ea897ad182db5f85fac3091（今回コミットなし）。開始前から多数の未コミット・未追跡変更あり、維持。今回だけの実差分は dist-validation/weapon-row/change.patch。

検証: typecheck、client build、production Worker dry-run、対象CSSのPrettier成功。Worker検証はサンドボックスのアクセス制限で初回失敗し、権限付き再実行で成功。改行統一のみの最終整形でCSS内容差分なし。
ローカル配布版/公開版それぞれ1280×582、915×412、844×390、1280×800のChromeで、全初期武器のセル中心が同じ高さ・セル重複なし・横はみ出し0・装備変更成功。画像で915×412を確認。公開JS/CSSのSHA256一致、health ok:true。
実スマートフォンと489px未満の一覧領域は未検証。

公開: https://swarm-front.melosalife-24.workers.dev
Version: d32c44cc-17a0-4360-b9ee-53de70197493
証拠: dist-validation/weapon-row/{local,published}.json と同フォルダの画面画像。
