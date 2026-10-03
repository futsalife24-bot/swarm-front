# 通信上限の独立指摘と修正（2026-10-03）

[通常Chat監査](https://chatgpt.com/c/6ac0a06e-6360-83ee-a5d1-0a836af08b19)は対象 `8fb888274663d9ebc8e34ca2accddb97c0320340` を要修正と判定。P0=0/P1=1/P2=0。812ファイルのSHA256/Git blob一致、差分46ファイル一致。空中経験値は独立実行で地面・通行可能位置へ配置、重複回収0を確認。設定復帰/保存の提出証拠に矛盾なし。

必須P1: `prepareState` が64KiBへ調整した後、Workerが `frontView` / `serverNow` を付加するため最終送信は上限を超え、4009切断。監査側は最大密集4人で66,115/66,149 bytesを独立確認。主担当も本番と同じ付加経路で66,095 bytesの失敗を再現した。[修正前の失敗](evidence/front-feedback-20261003/final-packet-before.txt)。

修正は受信者別の情報を `packet` の引数で渡し、共通情報・自己印・戦況・時刻を含む最終文字列を計測して古い演出だけを減らす。Workerでの後付けとJSON再解析を廃止。敵・弾・経験値・印・権威状態と旧版の経路を維持。

単体23件成功。97敵/100弾/160経験値/12設置物/160演出/長ID4人に加え、Workerソースの実 `broadcast` / `sendEncoded` をVMで実行し、全員の完全/装備キャッシュ配信が64KiB以内、4009切断なし、自己印と最新演出維持を確認。VMの通信モック単体検証は実WebSocket検証と区別する。旧版通信4件・実Worker2〜4人3件・client/Worker型成功。証拠は `final-packet-unit.txt` / `final-packet-legacy.txt` / `final-packet-network.txt`。

任意のパッケージ指摘: `audit-package.json` は旧3倍版5b0ba4eの履歴で、4倍版正本は `4x-audit-package.json`。旧記録は保護して役割を追記する。修正資料は再監査ZIPの新MANIFESTで完全SHAを固定する。

修正対象 `e546fc733b606c1cd9f29764ed5523d208977eea`。基準 `8fb888274663d9ebc8e34ca2accddb97c0320340` からの14ファイル差分ZIPは全blob一致、136,685 bytes、SHA256 `919ABD5EDFD297929DD24552C18543BF12B1E1FA45F19173F20E8E57353466F4`。[資料記録](evidence/front-feedback-20261003/f1-audit-package.json)。同じ通常Chatへ添付完了・送信・回答開始を確認済み。この対象後は記録だけ。

同Chatの限定再監査は対象 `e546fc733b606c1cd9f29764ed5523d208977eea` を合格と判定、必須P0/P1/P2各0件。監査側もWorker実ソースのbroadcast/sendEncodedを独立実行し、4人・97敵相当の完全/キャッシュ全員が64KiB以内、4009切断なし、最新演出と受信者別情報の保持を確認。提出Vitest一式/実WebSocketはログ確認として区別。[回答証拠](evidence/front-feedback-20261003/f1-audit-pass.txt)・[画面](evidence/front-feedback-20261003/f1-audit-pass.png)。以後は記録だけ。

main反映・公開は未完了。実機Androidジャイロ、97体FPS、人間難易度、実ネット越し4人は未確認。主担当1体、実行モデル/effort未確認、切替なし。
