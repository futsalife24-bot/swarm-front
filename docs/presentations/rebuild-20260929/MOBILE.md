# 出先のスマホ向けオンライン閲覧

2026-09-29。ユーザーの「出先スマホで見れるように」に対応し、既存のSwarm Front Workerへ静的なプレゼン閲覧ページを追加する。

公開URL: https://swarm-front.melosalife-24.workers.dev/briefing/

## 内容

- スマホ縦持ちでは28ページの要点・比較・解説を18px以上の本文で読む。比較表を縦に並べ、横スクロールを不要にする。
- 下部の前へ/次へは高さ48px、上部の目次で任意のページへ移動。末尾の `#9` などでページを直接開ける。
- 「元のスライドを見る」から既存の全28枚のスライド表示も開ける。
- 本文・ノートは監査済みの `content.mjs` が正本。PPTXと既存オフラインHTMLは変更しない。
- ログイン、外部API、課金、Cookie、アクセス解析、ゲームのセーブへのアクセスは追加しない。検索除外用noindex/nofollowを付けるが、URLは認証なしで閲覧可能な公開資料である。

生成: `node scripts/build-mobile-presentation.mjs`。出力は `public/briefing/index.html` と `slides.html`。Viteのpublicコピーで既存Workerのassetsに含める。

画像は既存5素材を幅1200px以下・拡大なし・WebP quality85に変換し、合計285,260 bytes。元の内容は変えず通信量を削減した。対応は `update-concept.webp` ← 同フォルダassets/update-concept.png、`trooper.webp` ← docs/evidence/trooper-design-v9/rifle-oblique.jpg、`calyx.webp` ← docs/evidence/calyx-v5/hero.png、`battle.webp` ← docs/evidence/clean-capture/844-clean.png、`title.webp` ← docs/evidence/weekly-title/title-1280.png。再変換用コードは親workspace artifacts/update-presentation/.build/mobile-assets.mjs。元スライドHTMLは約5.35MBで、リンクを開いた時だけ読み込む。

## 確認

- 390×844のブラウザで全28ページを巡回。解説28件あり、表示ページは常に1、横はみ出し0。
- 320×740で最終ページ・前後移動・無効化・48pxボタンを確認。844×390でも表示確認。ブラウザJS error 0。
- 実際の物理スマホは未確認。ブラウザのモバイル寸法確認と区別する。
- 公開前の本番ゲームソース30965b9から開始base fcd4662まで、src/server/public/vite/本番設定/packageに差分なし。今回の追加範囲は静的資料と生成スクリプト・記録。既存Service Workerのゲームキャッシュからbriefing経路を除外する最小修正を追加した。
- Judge入口は使用中worktree未導入、実行済み扱いにしない。Codex実行モデルID/effortは未確認。

公開の実行結果・監査・ソースSHA・Worker Versionは後続でこの文書へ記録する。

## オフラインキャッシュの保護

既存Service Workerは全ナビゲーションをゲームの入口キーへ保存するため、資料のHTMLがオフラインゲームの入口を上書きし得た。public/sw.jsでbriefingと配下を除外し、資料は通常のネットワーク取得へ渡す。元のゲーム・管理画面・APIの動作を維持。新旧配下scope2種類で除外とゲーム入口の保存を試す回帰2件、既存管理認証7件、計9件が成功。vitestの既存includeへ新テストを追加。

## 独立監査

通常Chat https://chatgpt.com/c/6abb409f-2e28-83e9-89a2-1459af653272 に対象ZIPを添付。UI対象7e91107a7d114ff38b46e3f95f0f66027e343bb2で合格、SW保護を含む最終対象666fd85c078bea965ed14e5f489ca6f31ed95a4dでも合格。必須P0/P1/P2各0件、通常merge・既存Worker公開可。最終応答はMOBILE-AUDIT.txt。

修正版SWが有効な場合の保護を検証。既存インストール済みSWの更新タイミング・物理スマホは未確認。監査後の変更は結果記録のみ。

## 公開完了（2026-09-29）

- PR112を通常merge。公開ソースmain: feaa7cd84178bae872922a2f7669c5a7d4d6eab1。
- merge後production build / Worker dry-run成功。既存Worker Version: fe9f40d9-6f21-4e7b-a3f3-5222c9b3e60d。
- 資料HTML2本・WebP5枚・SW・ゲーム入口/JS/CSSの計11ファイルがHTTP200、公開用distとSHA256一致。health HTTP200/ok。MOBILE-RELEASE.jsonに証拠。
- 公開URLを実ブラウザで確認。390×844で横はみ出しなし、画像/解説表示、目次と前後移動、JS error 0。元スライドの9枚目も実URLで表示成功。assets/mobile-public-390.pngに公開画面。
- 物理スマホ・既存SW更新タイミングは未確認のまま。公開完了後の追加差分はこの記録と証拠のみで、配信コードは変更なし。
