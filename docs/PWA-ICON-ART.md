# ユーザー指定画像のアプリアイコン — 2026-09-14

添付Photo 1を採用。正方形画像の構図・色・文字を変更せず、PNGへサイズ変換した。元画像は `assets/art/app-icon-user-20260914.jpg`、SHA256 `2f0a70b496742ab1e4e04b048deb0c7324659c674bf029b9a691237b42145a71`。

- `scripts/build-pwa-icons.mjs`: 添付画像を元に192/512/180/64px、maskable512pxを生成。Androidマスク用だけ周囲6%ずつの暗色余白を付け、文字を安全領域に収める。AIでの描き直しなし。
- `public/icon-swarm-v2-*.png`: 新規5ファイル。旧ファイルと別URLにしてキャッシュ混同を避ける。
- `public/manifest.webmanifest` / `index.html`: PWA・apple-touch・faviconの全参照を新画像へ。旧SVGは参照から外す。名前/起動先/scope/display/orientation/保存領域は保持。
- `scripts/check-pwa-icons.mjs`: 新ファイル名に対応し、記録先を指定できるようにした。

通常/Pages build、Worker production dry-run成功。ローカル両入口で画像デコード/寸法/マスク用の不透明性/apple180px、Chromeインストール判定エラー0、7配信ファイル一致、health成功。192px/マスク用512pxの目視確認済み。実端末の既存アイコン更新は未確認。

既存Workerへ公開成功: Version `78f1fca9-662f-4edd-8151-be4bbbf019c6`、更新7ファイル。

公開版も通常/試遊の両入口で同じデコード・寸法・不透明性・インストール判定、7配信一致、health成功。`published.json` 保存。

branch `codex/home-armory` / base=head `4186f25f7c9695f95ea897ad182db5f85fac3091`。未コミット/未追跡変更あり、既存作業を保持。commit/mergeなし。今回差分・変更前ファイル・検証記録は `dist-validation/pwa-icon-art/`。
