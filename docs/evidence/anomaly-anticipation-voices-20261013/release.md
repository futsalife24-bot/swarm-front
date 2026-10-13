# PR177 公開確認（2026-10-13）

- PR: https://github.com/futsalife24-bot/swarm-front/pull/177 、通常merge済み。
- mainへのmerge/公開ソース: `9b302d68c5cd5c4f68c754ba5214c34d33dc42c5`（2026-10-13 17:04 JST merge）。
- 最終監査対象実装: `8a8345eec0110b72eb03cf5f227e6add4737d6f0`。監査後9157b03は記録文書のみ、mergeまでsrc/server/public差分なし。
- Worker Version: `0326b248-470c-45e5-8399-1a2785511371`。
- 公開先: https://swarm-front.melosalife-24.workers.dev/front
- 試聴一覧: https://swarm-front.melosalife-24.workers.dev/anomaly-voices.html

最終独立監査は必須P0/P1/P2各0。merge後の確定HEADからVite build/既存本番Worker dry-run成功、既存swarm-front Workerへdeploy成功。Free契約確認済み、新規契約/公開先/移行/費用なし。

## 配信・実画面

- `delivery.json`: 51/51ファイルのHTTP成功・ローカルSHA一致。8モデル・16WAV・manifest/CREDITS・ゲームと試聴HTML・JS/CSSを含む。音声manifest全一致。
- `/api/health`: HTTP200、ok=true、transport=websocket、authority=durable-object。
- 公開試聴一覧: 8種16コントロール、全16の有限durationとerrorなし。HARROW/CALYXの再生時刻進行を確認（人の聴感採用ではない）。ローカル版では16/16の実再生・単独切替確認済み。
- 公開ゲーム: タイトル起動、エネミーレポート、全8種表示。CALYXの名前/実3Dモデル/声を聴くボタンを確認。
- 844×390横画面: CALYXの3D・操作・声ボタンの重なりなし。HARROWの攻撃連続再生・選択肢と実モデル/赤範囲を確認。終了時viewport設定を戻した。
- 公開ゲームの捕捉console errorは0件。

## 保存と限界

- 正規作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。
- mainチェックアウトは既存 `C:/Users/futsa/Documents/Codex/2026-10-09/swarm-soldier-motion` にあり、clean確認後ff-onlyで同期。作業場所のHEADも同じmergeへff-only同期した。
- 最終の公開記録だけを後続commitでmainへ保存。公開ソースSHAと記録追加後main SHAを区別し、記録追加による再deployは不要。
- 実スマホ/長時間戦闘/本人の美術・聴感採用は未確認。画面画像はツール出力で目視したがダウンロード接続障害によりPNG未保存。既存render通常弾テスト1失敗は別問題として未解消、独立監査も今回回帰には数えず。
- 実モデルID/推論設定は取得不可のため未確認。
