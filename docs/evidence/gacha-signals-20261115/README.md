# ガチャ新規合図の受入証拠（2026-11-15）

正本: ../../gacha-signals-brief-20261115.md、判断/進行/公開: ../../impl-status-20261114.md。

- `node public/supply-reveal/verify.mjs --foundation`: 新案を追加する前の既存6候補の複数局面実再生・15固定結果。
- `node public/supply-reveal/verify.mjs --effect <ID>`: 採用各案の単発/10連×通常/動き減。`--narrow` は640×360、既定844×390。既存4はSR箱を含む結果でSSR箱だけを金で指す。
- `node public/supply-reveal/verify.mjs`: 採用全17案、局面組合せ、最後枠、実時間タップ進行、スキップの獲得確認、終了後の残留。
- `scripts/check-gacha-signals-game.mjs`: 実確認UIをViteで取り込み、代表7案×単発/10連。保存不変/API書込なしを監視。通信モックや報酬受領は使わない。
- `scripts/check-gacha-signals-audio.mjs`: 新SE14個の有限波形と実Chrome音声信号/消音/停止/破棄。実デバイスの時計が動く前に観測した初回2試行は失敗、時計進行を待つ検査へ修正した。人間の聴感評価とは区別する。
- `checks/`: 型/全1907テスト/補給88テスト/書式/build/production dry-run/公開ログ。実装順はimpl-statusに記録。

固定結果は旧PRESETS10に含まれるSR未満の最終枠をSR/SSRへ置換し、本番の10連保証に整合させた。sonic初回カットは輪出現前だったため、代表時刻をtLand+0.04へ修正（JSONのfirstSampleTime参照）。heartbeatは札と降下尾を分けて取得。reverseSealは通常の完成形と裏面正対を取得。初期色/対象/局面はplanで凍結し、結果と合わない組合せは拒否する。

実機の見た目・実聴の最終確認は本人が行う。自動検査はその完了を意味しない。Android/iOS自然中断、全端末/長時間動作、人間の音量評価は未確認。
