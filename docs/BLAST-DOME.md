# 爆発ドーム表現（2026-09-09）

炎36個を爆心の球面上（地上に出る部分）へ0.16秒で広げ、0.8秒で消す。頂点まで炎が回り込み、補助球面は不透明度7.5%から薄くなる。地面の輪は爆心高度を含む球と地面の交差半径に変更。ダメージ・遮蔽判定は変更なし。球面は最大到達距離の目安で、壁による遮蔽形状は表さない。既存180個の上限・破棄処理を維持。

変更: src/client/combat-effects.ts。既存未コミット差分を保持。
branch: codex/home-armory / base・HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。未コミット変更あり。commit / push / mergeなし。
今回だけの差分: dist-validation/blast-dome/task.diff。

検証: 型チェック、描画テスト5件、画面build、本番Worker dry-run成功。Chrome 1280×720・844×390の実モジュールfixtureでドーム表示を確認。通常ソロ・射撃のpageerrorなし。既存500KB超警告あり。dry-runの初回はsandboxのログ書込み・親ディレクトリ読取制限で失敗、許可された再実行で成功。

既存AGENTS.mdの公開承認に従い公開済み。
URL: https://swarm-front.melosalife-24.workers.dev
Version: dc2281de-d3f0-45a9-a9a0-508339c93b7d
JS: index-jeC5FMF2.js
配信とローカルのSHA256一致: c261d9b73b73f0511cf69fc635e1392a5428680d507cae85c46922ff32bc6247
公開Chromeの両サイズでソロ開始・ライフル/ロケット射撃・health 200・pageerrorなし。初回はsandboxのnetwork access denied、許可された再実行で成功。
証拠: dist-validation/blast-dome/*、dist-validation/combat-effects/live/result.json。
未確認: Android実機の見た目・負荷、公開協力実プレイ。
