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
- 公開前の本番ゲームソース30965b9から開始base fcd4662まで、src/server/public/vite/本番設定/packageに差分なし。今回も追加範囲は静的資料と生成スクリプト・記録のみ。
- Judge入口は使用中worktree未導入、実行済み扱いにしない。Codex実行モデルID/effortは未確認。

公開の実行結果・監査・ソースSHA・Worker Versionは後続でこの文書へ記録する。
