# 入力中断・戦果再試行の公開記録

2026-10-11（JST）。本人依頼のClaude共同調査で2件の不具合を修正。数値バランスは根拠不足のため据え置いた。

- 実装PR: https://github.com/futsalife24-bot/swarm-front/pull/161 （通常merge）
- 公開ソース/merge SHA: `73f1310809b7a429e3b5c7bdaa2e39b7ebde6a9e`
- 独立監査合格対象: `864d7846845e1e893df8e34461100c22d80e9d32`。以後は判定文書保存のみ。
- 監査Chat: https://chatgpt.com/c/6aca5839-839c-83ee-9a97-c4171faac963 。初回P2の履歴境界表示を修正し、再監査で必須P0/P1/P2各0。
- Claude共同調査: https://claude.ai/chat/8d71c544-a8e3-49b2-bec5-f7567c119072 。UI Opus 5.5 高、主担当の実モデルID/推論設定は未確認。
- 公開先: https://swarm-front.melosalife-24.workers.dev/front （従来版 `/` を維持）
- Worker Version: `2510182e-eafa-4636-a763-6e84860005c7`
- merge本文に日本語の `Player-Note:` 2行を保持。

## 検証

Windows型/front109/save147/build/本番dry-run成功。実Chrome/実Workerで保留入力の修正前・修正後・中断なし対照を比較。結果画面844×390/640×360で片側保存失敗と再試行、640×360で履歴境界の対象外理由を確認。既存協力通信は9件成功後の1件が部屋作成429、制限を変えず自然解除後の単独再試行成功。詳細は ../../FRONT-INPUT-REWARD-FIX.md。

merge後HEADでbuild/本番設定dry-run成功。build-release.txt、dry-run-release.txt。既存の大きいchunk警告は残るがbuildエラーなし。wrangler.production.jsoncを変更せず既存Workerへ公開しdeploy-release.txtへ記録。

配信照合は既存delivery.mjsを再利用し、HTML・SW・全JS/CSS・タイトル画像・音声11本の37/37でローカルと公開SHA256一致。health200/ok:true。delivery-release.json。

公開版Windows Chromeで844×390/640×360それぞれ功績・コイン側の保存失敗→再試行を実行し、功績20の一度だけの保存と表示維持を確認。640×360で履歴境界の対象外理由・功績0・再試行なしも確認。計5条件すべてconsole/page error0。public-844、public-640、public-historyへJSONと画面を保存。本人と分離したプロフィールを使い、実ソロ自然敗北で確認した。通信/ワールド/HP/時間のモックなし。ローカル検証用Vite5186/Worker8789は終了・待受なし。

## 限界

実スマホ、実タブ非表示、自然高遅延、長時間負荷、人による難度評価は未確認。実結果UIの攻略コインは生存1分未満の正当な0、非ゼロ30コインの再試行は単体で確認。自己検証・Claude確認・独立Chat監査を区別し、監査側は添付ソース/差分/ログ/画像を照合、Windows試験自体は再実行していない。
