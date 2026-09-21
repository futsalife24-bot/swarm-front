# CALYX 会敵ムービー

CALYXだけ会敵ムービーボタンから除外され、動画も登録されていなかった。`encounter-film.ts`に登録し、`bestiary.ts`のCALYX除外を解除した。未遭遇/協力のみの閲覧制限と他種の動画URLは維持。

- 素材: `public/assets/encounters/report-v2/calyx-v5.mp4`。約9.9667秒、1280×720、30fps、無音、H.264/yuv420p/faststart、1,626,539 bytes。
- モデル: GLB SHA256 `64719fde1175e4270dae7b142ef2880145a3d76d690806de3a2f8a491d1b21ce`。既存モデルは変更していない。
- 収録: `node scripts/serve-calyx-film.mjs` → localhost:5198/scripts/calyx-encounter.html →収録ボタン。実Rendererと作戦7マップ、実encounterCamera/encounterIdleを使い、登場時の土煙・飛び石が終わってから独立ワールドを固定する。セーブ・本番通信は使わない。録画先はdist-validation/calyx-film/calyx.webm。
- エンコード: ffmpegで30fps、libx264、crf19、yuv420p、movflags +faststart。既存の他種動画と同様に、会敵を観察する映像であり戦闘/周回の実演ではない。
- 検証: client型、production build、全299フレームのffmpegデコード成功。10抽出コマで蕾/根/字幕/黒帯/接近構図を確認。実IABのレポート→CALYX→会敵ムービーでended=true、currentTime=duration=9.966667、readyState4、error=null。
- 限界: 公開ゲームの保存保護は解除できておらず、レポート操作は保存を使わないローカル入口で実本体を検証。スマホ実機の動画再生は未検証。
- 独立監査: 対象44f4923aec6ffe199719696351236f1a8923381c、PR62。[通常Chat](https://chatgpt.com/c/6aafd926-90a0-83ee-a297-65a7f91d005d)へ実動画/差分/ソースを提出済み。判定待ち。
独立監査44f4923は合格・必須0・新規任意0。実動画全299フレーム/15抽出コマ、32URL条件、未遭遇/協力のみ非表示とソロ表示、実コードによるネイティブ再生/シーク/再試行/Blob解放を独立確認。監査ブラウザは通信/3D/BGM等を代替し、公開実環境の確認とは区別。全文docs/evidence/calyx-film/audit-44f4923.txt。
