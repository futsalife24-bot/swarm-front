# CATENA エネミーレポート実画面確認

- 2026-11-11、ローカルVite `http://127.0.0.1:5208` に対し、`node scripts/check-catena-report.mjs` を正規権限のChrome/D3D11で実行。`front.html` の通常タイトルからレポートを開いた。1280×720と844×390の両条件でCATENAの本文、3Dモデル読込、攻撃再生、画面例外0を確認。結果は `ui-checks.json`。
- 各ブラウザは隔離contextを新規作成し、現行 `freshProgress("normal")` 相当の保存形に `encounters.worm = "solo"` だけを加えてlocalStorageへ設定。本人の保存領域を操作していない。タイトル演出が入力を受け終えるまで待ち、CATENA選択の `aria-pressed=true` を確認した。
- `ui-idle-*.png` で頭部と胴14節の全身がviewport内に収まる。`ui-attack-*-9.png` で15個の赤い着地予告、10・11秒画像で頭側から身体が円より上へ変位する連続姿勢、12秒画像で接地位置へ戻り赤円が消えることを目視した。2サイズともモデルの切れは見えない。
- 画像名の秒数は**攻撃ボタンを押してからの壁時計**。描画ループの `dt` 上限によりゲーム内時刻と完全一致する証拠ではない。頭→尾の厳密な位相は製品の共通 `omegaPose` と関連テストの対象であり、この画像列だけで数値的に証明したとは扱わない。
- 1280×720でレポートの「会敵ムービー」を押し、`worm-20261111.mp4?v=c712e47513cc` の読込、再生位置0.5秒超、長さ11秒、実フレーム表示を確認した（`ui-film-1280.png`）。
- 公開後もPowerShellで `$env:REPORT_SITE = 'https://swarm-front.melosalife-24.workers.dev'` を設定し、`node scripts/check-catena-report.mjs` を実行すれば通常タイトルから確認できる。**本記録はローカルのみで、公開URLでは未実施。**
