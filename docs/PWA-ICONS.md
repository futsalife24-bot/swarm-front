# インストール用アイコン — 2026-09-14

ユーザー報告: インストール後もタスク切り替え画面のアイコンがChromeになる。端末/OSとインストール種別は未確認。カタモンでは独自アイコンになったとのこと。

既存manifestはSVG（sizes:any）のみ。既存マークを変更せず、明示サイズのPNGを追加してブラウザ/OS側のアイコン選択に対応した。SVGだけがユーザー端末の症状の原因だったとは断定しない。

- `public/icon-192.png` / `icon-512.png`: 通常のアプリ用。
- `public/icon-512-maskable.png`: 背景を完全不透明にし、マークを80%へ収めたAndroidのマスク用。
- `public/icon-180.png` / `index.html`: apple-touch-icon。
- `public/manifest.webmanifest`: PNGのpurposeをany/maskableに分け、元SVGはanyで保持。name/start_url/scope/display/orientationは保持。アプリIDや通常保存を変えない。
- `scripts/build-pwa-icons.mjs`: 元SVGをブラウザでラスタライズする再現スクリプト。AI画像生成や既存デザイン変更なし。

## 検証・公開

通常/Pages build、Worker production dry-run成功。通常URL/試遊URLの両方でmanifest設定、PNGのデコードと寸法、maskableの全画素不透明、apple180pxを確認。Chrome DevTools ProtocolのinstallabilityErrorsが空、7配信ファイル一致、health成功。最初のチェックは隔離ブラウザがincognito扱いでインストール判定に拒否されたため、検証専用の通常プロファイルへ変更して成功。インストール自体は実施していない。

既存Workerへの公開成功。Version `1a5f5e49-58a7-4caf-950a-b6dbe12e816d`、更新6ファイル。

公開版でも両入口のPNGデコード・寸法・不透明度・Chromeインストール判定（エラー0）、7ファイル一致、health成功。`published.json` 保存。

branch `codex/home-armory` / base=head `4186f25f7c9695f95ea897ad182db5f85fac3091`。既存の未コミット/未追跡変更を保持。commit/mergeなし。証拠は `dist-validation/pwa-icons/` の変更前2ファイル、`changes.patch`、`local.json`。検証スクリプトは `scripts/check-pwa-icons.mjs`。

ユーザー端末のタスク切り替え表示は未確認。既存インストールのアイコン変更はOS/ブラウザ側の更新が必要な場合がある。Chromeへのショートカットと独立したWebアプリは区別する。セーブ保護のため、サイトデータ削除や無条件のアンインストールは案内しない。

公式資料: [manifestのアイコン](https://web.dev/articles/add-manifest)、[インストール形態](https://web.dev/learn/pwa/installation)、[インストール後の更新](https://web.dev/learn/pwa/update)。
