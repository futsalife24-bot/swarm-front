# エネミーレポートの全動作表示と会敵映像の更新

## 依頼と範囲

2026-10-15 本人「HARROWは全モーションでサイズを他と合わせて」「エネミーレポートに限りね！」、続いて「会敵ムービーが古い。全ANOMALYで見直してきて」。

- HARROWの変更はエネミーレポートのカメラだけ。戦闘の縮尺・当たり判定・攻撃・GLBには変更しない。
- 全9種の会敵映像を現行ゲーム描画で収録。LEAPERは旧ロボ型から現行v3、HARROWは上映v8から現行v14へ更新する。ほかの種は造形不一致を確認していないが、現行素材・名前・説明で取り直して統一する。
- 通常の自己検証、PR、main、既存Worker公開までを継続承認内で実施。最新指示に従い独立Chat監査は追加しない。④基地・⑤チュートリアルの相談待ちは今回に混ぜない。

## 変更

従来のHARROW攻撃画角は飛行経路と全ミサイル着弾先を含む固定境界だったため、本体が小さくなった。さらに動作全体の最大姿勢で固定すると回転開始時だけ小さくなる。v14の全17クリップを実頂点から事前計算し、姿勢ごとの中心と距離を補間する。カメラが本体の高さ・突進・爆撃移動に追従し、ユーザーの回転方向とズーム倍率は連続再生中も維持する。遠くへ進む弾は画面外へ流れる。プレイ開始時の重いスキン解析は行わない。

映像は保存データを使わない専用ローカル画面で、現行`Renderer`・`encounterIdle`・`encounterCamera`から収録する。全種の実ロードGLBのURL/SHA256とゲーム状態の停止を記録する。WebCodecsで1/30秒刻みの各姿勢をVP9/IVFへ出力し、ブラウザの背景タブ制限に依存しない固定フレームの映像をH.264へ変換する。読み込むモデルのURLは同じ値を共通定義へ移し、素材と映像のSHA照合テストから参照する。旧映像は保持し、新しい配信URLへ切り替える。

## 再現

1. HARROW姿勢データ: `node scripts/generate-harrow-report-profile.mjs`。`--check`で現行GLBとの一致を検査。
2. 会敵収録: `node scripts/current-encounters-server.mjs` → `http://127.0.0.1:5202/scripts/current-encounters.html` のプレビューを確認し「全9種を収録」。必要なら個別に画角を調整して撮り直す。
3. 変換: `node scripts/encode-current-encounters.mjs <ffmpeg>`。H.264 / 1280×720 / 30fps / yuv420p / faststart。全フレームの時刻連続性・全デコード・静止していない待機動作・録画時と現行素材のSHAを照合。

## 検証と公開

型・HARROW実素材7件・モーション10件・全9映像の現行素材/動画SHA照合1件・映像ダイアログ3件が成功。全動画の330/600フレーム連続時刻、30fps、全デコード、カメラが止まった後の待機動作変化を確認。9種の比較画像で画角・名称・字幕・現行造形を確認し、実Chromeの844×390レポートから全9種を再生してreadyState 4・errorなしを確認した。映像ダイアログを閉じて正常にレポートへ戻れる。全画面切替の完了前に読み込み結果が破棄される問題も、表示後の取得開始と終了時のキャンセルで修正した。

証拠: `docs/evidence/harrow-report-motion-scale-20261015/`、`docs/evidence/encounter-films-current-20261015/`。raw IVFは再生成可能なローカル中間物として`dist-validation/current-encounters-20261015/`に保管し、配信用MP4・生成スクリプト・マニフェストをGit管理する。

実装`6097bb0e1c001afcfe517fede817072db9bb477b`を[PR191](https://github.com/futsalife24-bot/swarm-front/pull/191)で通常merge。公開ソース`b144b70a9884aa359efb540c1fe0b252c4884eba`、Worker Version `773499bc-37c0-40ce-a649-dcea29a8ecef`。mainからbuild 212 modules、Worker dry-run 422 assetsを確認して既存Workerへ公開。動画9/9とアプリ27/27のSHA一致、health 200/ok:true、公開LEAPER動画のChrome直接再生（11秒・readyState 4・errorなし）を確認した。GitHubのstatus checksは設定なし、mergeState CLEAN/MERGEABLEを確認し通常mergeした。

公開後のゲーム内再操作では、既存ユーザータブの再読み込みを自動承認レビューが保存状態消失の可能性で拒否したため実施しなかった。既存タブの操作・保存保護の回避は行わず、ローカル実UI、公開バイトの完全一致、公開動画の別タブ直接再生で確認した。実Android/Safari/Firefoxは未確認。公開後の変更はこの記録と配信証拠だけ。

開始base: `c167a87419da11cf49ca029e168c1155f707e5db`。branch: `codex/harrow-report-motion-scale-20261015`。

ローカル: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。GitHub: https://github.com/futsalife24-bot/swarm-front 。主担当・補助の実モデルID/推論設定は取得できず未確認。補助はHARROW姿勢データと収録fixtureを担当し、主担当が統合・実UI・公開を確認する。

## 確認範囲

- HARROW: 現行GLBの全17クリップを、生成サンプル間の時刻も含めて4種の縦横比へ投影。既定方向で画面内へ収まり、本体の表示占有率が50%以上となることを7件の素材試験で確認。既存のモーション試験10件も成功。
- 実Chrome: 11攻撃の個別切替と全攻撃再生、待機・移動、844×390／667×375／1280×720を確認。ドラッグ回転と動作中の追従を確認。任意の手動回転・拡大で全身が必ず収まる保証はなく、必要に応じて縮小・リセットできる既存操作を維持。実Androidのピンチ操作は未確認。
- WindowsのVitestで2ファイル同時実行時に一時SSRファイルのENOENTが出たため、各対象を単独で実行して合格を確認。製品の失敗として扱っていない。
- 収録ツールの準備処理は描画ペーサーを通さずマップを更新する。初回のMediaRecorder方式は背景タブの録画間隔不足で不採用とし、固定時刻のWebCodecsへ切り替えて全9種を再生成した。製品の描画ペーサーは変更していない。
