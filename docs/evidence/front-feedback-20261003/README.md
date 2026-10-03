# 監査資料と検証証拠の対応

- `audit-package.json`: 旧3倍版 `5b0ba4ec1470ddd1053d718459a7e2339d4e3db6` の履歴。未送信で、最終4倍版の監査正本ではない。
- `4x-audit-package.json`: 初回4倍版 `8fb888274663d9ebc8e34ca2accddb97c0320340` の資料正本。
- 再監査資料の正本はそのZIPのMANIFEST。初回4倍版を基準に通信P1修正と直接の検証だけを含み、対象SHAと全blob一致を固定する。
- `final-packet-before.txt`: 本番と同じ後付け経路で上限超過を再現した失敗。成功記録ではない。
- `final-packet-unit.txt`: 修正後23件成功。Worker実ソースの送信経路を実行するVM単体検証を含む。
- `final-packet-network.txt`: 修正後の実Worker/WebSocket2〜4人3件成功。
- `final-packet-legacy.txt`: 修正後の旧版通信4件成功。
- `f1-build.txt` / `f1-worker-build.txt`: 実装修正 `536f20b` 保存後の配信ビルドとWorker dry-run成功。

以前の3倍版・4倍版の証拠は履歴として保持。物理Androidジャイロ・97体FPS・人間難易度・実ネット越し4人は未確認。
