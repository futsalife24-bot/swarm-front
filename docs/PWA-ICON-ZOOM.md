# アイコンの拡大・上下中央揃え — 2026-09-14

ユーザー指定の元画像を1.16倍で切り出し、文字ブロックの中心（元画像の640,604）をアイコン中央へ配置。文字・背景の描き直しなし。maskable用の追加6%余白も取り除き、全サイズで同じ構図に統一した。

- `scripts/build-pwa-icons.mjs`: 上記の切り出しを生成処理に反映。
- `public/icon-swarm-v3-*.png`: 192/512/180/64pxとmaskable512pxの5画像。
- `public/manifest.webmanifest`、`index.html`: 参照をv3へ更新。
- `scripts/check-pwa-icons.mjs`: 配信一致確認をv3へ更新。

通常/Pages build、Worker production dry-run成功。生成192pxを目視確認。ローカル・公開それぞれ通常/試遊の両入口で画像デコード・寸法・不透明性・Apple用画像・Chromeインストール判定エラー0・7配信ファイル一致・health成功。端末上の既存インストールアイコン更新は未確認。

公開Version: `c72d0fb5-abfa-48f3-80bd-18c40450dd8b`。

branch `codex/home-armory`、base=head `4186f25f7c9695f95ea897ad182db5f85fac3091`。未コミット/未追跡変更あり、既存作業は保持、commit/mergeなし。今回の変更前ファイル・差分・検証JSONは `dist-validation/pwa-icon-zoom/`。
