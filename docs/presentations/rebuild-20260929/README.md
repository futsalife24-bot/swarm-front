# 大型アップデート プレゼンテーション

メロニキ向け、全28枚。変更・追加、3択と進化、期待・達成・爽快感、旧来の魅力、日替わり防衛、協力、UI、試作順を説明する。各ページに詳しい発表者ノートを収録した。

- [オフライン閲覧版](output/presentation.html) — ブラウザで開き、矢印キーで移動。「解説を表示」で詳細。
- [PowerPoint](output/swarm-front-major-update-v2.pptx) — 編集可能な文字・表と発表者ノート。
- [解説全文](SPEAKER-NOTES.md)
- [共同設計の正本](../../design/rebuild-20260929/DESIGN.md)

正本は GitHub https://github.com/futsalife24-bot/swarm-front 。制作場所は `C:\Users\futsa\OneDrive\ドキュメント\ChatGPT\スワフロ\balance-t7`。ゲーム実装、セーブ、本番配信は変更していない。画像は生成コンセプトと既存の制作・UI記録であり、実装済みアップデート映像ではない。

## 再現

`content.mjs` が28枚の本文と説明。`build.mjs` を `@oai/artifact-tool` の利用可能なNode ES module環境で実行する。環境変数は `SWARM_REPO`, `SWARM_WORKSPACE`, `PRESENTATION_SKILL`, `RUNTIME_PYTHON`, `RUNTIME_NODE_MODULES`, `SKIA_FONT_ROOTS`。選択フォントはWindowsのYu Gothic。別版は `SWARM_PPTX_NAME` で新ファイル名を指定する。出力を上書きするfinalizeは使わない。発表資料の作成開始マーカーは当作業で一度実行済み。

`export-viewer.py` は完成PPTXを読み、図形の座標・テキスト・表・画像・ノートからオフラインHTMLを作る閲覧用変換。PPTXの作成や修正には使用しない。HTMLに外部通信はない。

## 確認と限界

PPTXは構造・16:9サイズ・フォント・見出し・編集可能な表10枚・Artifact Tool再importをfinalizerで確認。28枚すべてのHTML表示を個別に確認。最初の表示確認後、15枚目のラベル短縮と25枚目の「進化3種類」の明確化を実施した。

環境のSkia画像出力が最小100×100描画でも無出力exit 1になるため、PPTXから読み出したHTMLをブラウザで表示して確認した。Office自身のレンダリング結果との一致は未確認。PowerPoint実アプリでの表示確認を成功扱いしない。ゲームの楽しさ・性能・バランスも未検証で、提案資料として明記。

Codex実行モデルID/effortは未確認。元の共同設計ではClaude UIでOpus 5.5・高を確認済みで、今回のスライド用に新しいOpus回答を生成したものではない。
