# 会敵ムービーを最新待機モーションで再撮影 — 2026-09-14

3D待機の変更後も録画済み `report-v1` のMP4を更新していなかったため、ユーザーが会敵ムービーで旧待機を見ていた。全7体を現在のゲーム描画から再撮影し、`report-v2` の別URLへ切り替える。既存端末のcache-firstなMP4キャッシュともキーを分ける。

## 制作範囲

- PLEAT、HOUND / VOLLEY、HOUND / LEAPER、PRISM、RAY、FOUNDRY ZERO、FOUNDRY ZERO 連結炉。
- 前回と同じ初登場マップ・敵の正面・直進ズーム・黒帯・名称/観察文。通常炉は草原の平地を継承。
- 現行の6秒Idleを読み込んだことを撮影時に検査。待機部分を約6.5秒収録。
- World・他個体の時間を進めず、対象の待機だけを再生。撮影ブラウザだけの演出コードを使用。
- PRISMの板周回、地上3種の屈伸と可動部、RAYのひれ/尾、炉のアーム/発射器が新モーションの対象。
- 3Dモデル・モーション生成・戦闘ルール・通常レポートのUIを今回変更しない。

## 再生成と配信

`record-report-films.mjs` は新しい証拠ディレクトリへ撮影し、`report-film-director.js` で現行Idleの長さを返す。`encode-report-films.mjs` でH.264/yuv420p・1280×720・30fps・無音・faststartへ変換し、全デコード検査とコンタクトシートを作る。
`src/client/encounter-film.ts` の読込先を `assets/encounters/report-v2/<kind>.mp4` へ変更。旧ファイルは保持するが新画面からは参照しない。動画は選択時だけ取得し、Blob再生・シーク・再再生・閉じた際の解放を継承。

## 証拠・監査

`dist-validation/report-films-v2/` に開始時コピー、旧動画ハッシュ、撮影元のモーション/描画ソースハッシュを保存。`videos/recordings.json` は撮影地・Idle周期・録画ファイル・尺、`*-checks.json` は全画面サンプルでのWorld停止/正面/直進/段階の記録。
branch `codex/home-armory`、base/head `4186f25f7c9695f95ea897ad182db5f85fac3091`。既存の未コミット/未追跡差分を保持。commit/mergeなし。

## ローカル検証

全7本の1280×720・30fps・H.264/yuv420p・無音・faststart変換と全デコードが成功。合計15,788,738 bytes。全7本のSHA256が旧版と異なることを確認。7体の連続画像を目視し、PRISMの板周回を含む新版の動きを確認。
型チェック、通常/Pages build、Worker production dry-run成功。既存の500KB bundle警告あり。
844×390・1280×720で全7本の再生・6秒/7.4秒へのシーク・再再生・閉じた際の解放に成功。動画を開く前の一括取得なし、取得URLは全件report-v2。`local-checks.json`。

## 公開

既存 Worker へ公開成功。Version `2a32b9a8-5b63-4896-a128-9d9f5c5c0e54`。
https://swarm-front.melosalife-24.workers.dev/?developer=1
公開版でも全7本×2寸法の再生・シーク・再再生・解放が成功。18配信ファイルのSHA256がdistと一致、/api/health成功、ブラウザ例外なし。証拠: `dist-validation/report-films-v2/published-checks.json`。
