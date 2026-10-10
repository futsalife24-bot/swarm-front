# 若い兵士11台詞の公開記録（2026-10-10）

- PR137: https://github.com/futsalife24-bot/swarm-front/pull/137
- 最終監査: https://chatgpt.com/c/6ac9ebe2-4838-83ec-a180-46c05b5d3d3a
- 監査対象9d56b157534eac606a676a9e219d055dbf27249e、合格/必須0。本人一式採用を全11ID/SHAへ記録。監査側の聴感未評価と本人の採用は区別。
- 公開ソース/merge SHA8e0596b32845b4bf8ed01bf0dcf181698b114d6d。Player-Note保持。
- Worker Version c1f69e2e-468e-4a2f-9b15-701332728a1d、既存wrangler.production.jsoncで公開。
- Windows merge後main build/本番dry-run成功。既に同じ製品差分でnpm ci/型/関連30単体/全11実WebAudioイベント発声・中断・復帰を確認済み。
- delivery.json: 公開HTML/JS/CSS等と全11WAVの37/37 SHA一致、health200/ok:true。
- public-browser.json: Windows Chrome/d3d11、844×390、全11試聴完走/配信SHA一致。改装版の通常ソロ操作で新reload0.92秒のWebAudio再生開始を、デコード元ファイルSHA/AudioBuffer対応で観測。抽選・入力・ゲーム状態を固定するfixtureではない。console/page error0。
- 実戦確認の初回2回は検証操作の指定誤りでタイムアウト。canvas上には視点操作領域が重なり、Windowsでは射撃ボタンが非表示になる既存仕様。input.tsを確認して既存の視点領域のマウス射撃とR装填へ修正し成功。製品コード修正なし。
- 計装は検証用ブラウザ内でdecodeAudioData/createBufferSourceの取得SHAと再生開始を観測するだけ。全台詞の通常戦闘場面・長時間/GPU負荷・実スマホ性能・実請求額は未確認。

再現コマンド（repository root、Windows Chrome、npm ci済み）:

```
node docs/evidence/young-soldier-release-20261010/delivery.mjs
node docs/evidence/young-soldier-release-20261010/release-browser.mjs
```

結果の出力先はGit除外のdist-validation/soldier-voice-audit-20261010/。配信照合は同じ公開ソースSHAからnpm run buildしたdistと比較する。後続公開では値が変わるため過去結果と混同しない。監査画面、公開試聴画面、通常戦闘画面と公開ログを保存。秘密情報・.dev.vars・依存キャッシュは添付していない。Codex実モデルID/推論設定未確認。
