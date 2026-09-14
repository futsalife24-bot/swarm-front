# エネミーレポートの会敵ムービー — 2026-09-14

全7体の録画済み会敵ムービーを、既存の3Dレポートに「会敵ムービー」ボタンで追加。ユーザーの採用指示により既存Workerへ公開。今回の映像はGoogle Driveへ送信していない。

撮影開始時から敵をこちらへ向け、停止 → 上下黒帯 → 直進ズーム → 左中央の名前カットイン・観察文の順で表示。世界時間は停止し、最後の表示中だけ対象の待機モーションを再生。兵士・戦闘HUD・スキップボタンは映像に含めない。既存のRajdhani Bold、黒帯と金色の名称枠を継承。

## 初登場マップ

`src/shared/stages.ts` の最初の該当出現Waveから撮影ステージを選ぶ。同じマップで初登場する敵は同じマップを使用。

| 敵 | 初登場ステージ | 撮影マップ |
|---|---|---|
| PLEAT | 1 前哨掃討 | 灰明の街区 |
| HOUND / VOLLEY | 1 前哨掃討 | 灰明の街区 |
| HOUND / LEAPER | 2 跳躍する影 | 風渡る草原 |
| PRISM | 3 エネルギー弾の交差点 | 灰明の街区 |
| FOUNDRY ZERO | 4 形成炉迎撃 | 風渡る草原 |
| RAY | 5 倉庫上空 | 薄暮の倉庫地区 |
| FOUNDRY ZERO 連結炉 | 6 装甲回廊 | 薄暮の倉庫地区 |

FOUNDRY ZEROは中央斜面で足が地形に埋まったため、草原内の平地 `(70,-60)` に移して撮り直した。中心の前後左右18mを1m刻みで調べ、支持面の最低/最高とも0m。修正版の足先を目視確認。地形自体や戦闘中の脚制御は変更していない。

## 実装と範囲

- `src/client/encounter-film.ts` / `.css`: 共通プレイヤー。ボタン操作時だけ動画を取得。再生・一時停止・シーク・再再生・全画面はブラウザ標準操作。読込エラー時は再読込。閉じると動画を停止・解放し元のレポートへ戻る。
- `src/client/playtest-app.ts`: ソロ遭遇済みの敵に再生ボタンを表示。未遭遇・協力のみの既存ロックは維持。
- `src/client/bestiary.ts`: 通常版レポートにも追加。通常炉/連結炉の選択に連動。
公開先がRange要求へ200を返しシーク範囲が0になったため、選択したMP4を完全取得しBlob URLで再生する方式に修正。閉じる際は取得を中止しBlob URLも解放。Worker/API/Service Workerの最終変更なし。
- `public/assets/encounters/report-v1/*.mp4`: 全7本、1280×720、30fps、H.264/yuv420p、faststart、無音。合計約14.2MB。ゲーム起動時の一括取得はしない。
- `scripts/report-film-director.js` / `record-report-films.mjs`: 撮影ブラウザだけの敵配置・直進カメラ。製品へ注入しない。
- `scripts/check-report-films.mjs`: 独立したテスト用保存データでレポートの再生を確認。ユーザーの保存データは操作しない。

バトル中の正面への回り込みは今回変更なし。`encounter-camera.ts` の前後SHA256はともに `EC9BE4AA3965AE932C66DD633C3202583F02FAA46CBC6F5975BF5949C298ADC2`。playtest-appの今回差分もimportとreport関数内のみ。

## 検証・証拠

- 全7撮影: freeze/bars/zoom/textの順、全サンプルでWorld不変、敵の水平正面dot > .999、直進dot > .999999、表示中の待機が画面に現れること、ページエラーなし。
- FFmpegによる全7MP4の全フレームデコード成功。コンタクトシートと全7体の最終画面を目視確認。
- ローカル: 1280×720 / 844×390で全7本の再生、終了、シーク、再再生、閉じた際の解放、未遭遇/協力のロック、通常版7フォーム、読込エラーから再読込成功。
- typecheck、通常/Pages build、Worker production dry-run成功。既存の500KB超bundle警告あり。
- カメラ4方向の単体テスト4件成功。
- 公開Version: `af518618-258f-4177-b6fd-105f72163147`。公開先の全7本×2寸法の実操作・18ファイルSHA256一致・health成功。結果JSONに記録。

証拠は `dist-validation/report-films/`。`videos/recordings.json` に各初登場ステージ・録画経路、`videos/*-checks.json` に全フレームサンプル、`videos/video-verification.json` に変換情報、`asset-hashes.json` に全MP4のSHA256、`local-checks.json` / `published-checks.json` に実操作検証。公開静的ファイルはビルド成果物とSHA256一致、5秒へのシーク位置・healthを確認する。

## 監査用状態

branch `codex/home-armory`、base/headとも `4186f25f7c9695f95ea897ad182db5f85fac3091`。今回分を含む未コミット・未追跡変更あり。既存差分を維持し、commit/mergeなし。今回の変更ファイルと目的は上記「実装と範囲」、撮影前コピーは証拠ディレクトリの `before/`。既存の全差分を今回作業として扱わない。
