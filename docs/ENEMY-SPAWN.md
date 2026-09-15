# モンスターのスポーン演出 — 2026-09-14

依頼: RAYのテレポート、PLEATの掘り出しを、モンスター自身のモーションを変更せず演出で表現する。

- `src/client/enemy-spawn-effects.ts`: RAY/PRISMは青白い上下の光輪・収束粒子・閃光（0.8秒）。PLEAT/VOLLEY/LEAPER/FOUNDRY ZEROは地表から膨らむ土煙・飛散する破片（1.05秒）。雪マップは白い煙。個体半径と支持面の高さに追従する。連結炉は頭部の出現地点に適用。
- `src/client/render.ts`: 描画末尾で共通の出現エフェクトを更新。実体の座標、骨、GLB、待機/移動/攻撃クリップ、判定、共通計算、サーバーは変更しない。埋没や上昇の実体移動は行わず、土煙から姿が見えることで掘り出しを表現。
- `src/client/playtest-app.ts`: 対象の出現演出終了後に初会敵カットインへ進む。
- 生存中のIDは一度だけ再生。一時停止中は進めず、消滅/戦闘終了/新run/時刻巻き戻りで解放。同時24体まで、超過分は後から再生しない。粒子は各12個のインスタンス描画、共通geometry/textureを再利用し、個別materialとinstance資源を終了時に解放。

branch `codex/home-armory` / base=head `4186f25f7c9695f95ea897ad182db5f85fac3091`。既存の未コミット/未追跡変更を保持。commit/mergeなし。

## 検証

- 型チェック、関連40テスト（structure-motion / encounter-camera / enemy-size）、通常build、Pages build成功。既存の500KB bundle警告あり。
- Worker production dry-run成功。初回はsandboxのファイルアクセス制限で失敗し、承認された通常権限の同じdry-runで成功。
- 全7形態×844×390/1280×720: 初期/途中の28画像、完了時の解放、Worldと骨パレットの不変、再発火なし、ブラウザ例外なし。
- 40体同時出現: 24体上限、一時停止のage保持、寿命後scene解放、再出撃、null Worldでの解放、World不変を確認。
- 2026-09-14のCloudflare画面でFree / $0 / Current planを確認。Workers一覧の9/1〜9/14集計195 requests、CPU160ms、アプリ1件。契約変更なし。
- ローカル配布版も844×390/1280×720で出撃→初会敵カットイン→スキップ→一時停止成功。配信11ファイルのSHA256がdistと一致。`local-release.json` とカットイン2画像を保存。初回チェックは操作説明を閉じずタイムアウトしたため、チェック側で説明を閉じる操作を追加して成功。本体不具合ではない。

## 公開状態

2026-09-14、ユーザーの「はい」による今回の公開承認後、`npx wrangler deploy --config wrangler.production.jsonc` 成功。Version `d4d98899-8a6e-4d78-a499-e5b051e8d1c6`。更新6ファイル。公開先 https://swarm-front.melosalife-24.workers.dev/?playtest=1 。初回の自動承認拒否後にユーザーの明示承認を取得して実行しており、承認回避なし。

公開版も844×390/1280×720の出撃→初会敵カットイン→スキップ→一時停止、11配信ファイルのSHA256一致、`/api/health` ok成功。ブラウザ例外なし。`published-release.json` とカットイン2画像を保存。初回公開チェックのネットワーク制限は、承認された通常アクセスで同じチェックを実行して解消。

証拠: `dist-validation/enemy-spawn/` の `changes.patch`（今回のソース差分）、`checks.json`、変更前2ファイル、各画像。再現スクリプトは `scripts/check-enemy-spawn.mjs` / `scripts/check-enemy-spawn-release.mjs`。

実スマホの性能・聴感は未確認。スポーン専用SEは今回追加していない。
