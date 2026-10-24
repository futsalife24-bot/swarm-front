# SWARM FRONT PWAアイコン原本（2026-10-24）

本人がアイコン差し替え用に提供した [Google DriveのPNG](https://drive.google.com/file/d/1z3i3wONkSvQNtXipQraUuEswu9ShEw9d/view) を、Driveの正規コネクタから取得した。権限変更・新規認証はしていない。旧Library添付はWindowsの転送処理に失敗していたが、この別提供元で再開を許可された。

- 提供名: `file_00000000c0448206b1dbec4b38182d73.png`
- 原本: `app-icon-user-20261024.png`（取得バイトを変更せず保存）
- 寸法・形式: 1254×1254、RGB PNG、2,222,318 bytes
- SHA256: `7229dc0ab2eed9b0f518c2c32f3a123976b87a831ac573be1edf1aa0d3611b64`
- 実画像を確認: 青緑の背景、中央の2行の「SWARM FRONT」と緑の点。

再生成はrepoルートで `node scripts/build-pwa-icons.mjs`。既存のPlaywright/Chromeを使用し、原本SHA256・寸法を検証してからCanvasで決定的に縮小する。通常の64/180/192/512pxは原本全体を縮小し、切り抜かない。原本には書き込まない。

512px maskableは原本全体を440pxに縮小し、背景`#020d10`の中央へ配置（四辺36px）。主タイトルと緑の点を含む原本上の保守的な矩形`x=150..1100, y=380..810`の全頂点が、出力中心から半径204.8px以内に収まる。周辺の装飾や小文字は切り抜かれる場合がある。基準は [W3Cのmaskable安全領域](https://www.w3.org/TR/appmanifest/#icon-masks)（アイコン中央、半径40%の円）。

出力は `public/icon-swarm-v4-*.png`。新しいファイル名にして旧v3のcache-first応答を避ける。manifestのid省略・start_url・scope、SW、保存仕様は変更しない。旧素材は履歴と既存利用のため保持する。
