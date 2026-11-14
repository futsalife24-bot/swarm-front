# 管制AI再生・第4弾の検証

- 基点: 第3弾公開記録main `2bd3e7036d38092fd00e60dbefde92703f896c27`。
- `baseline.json`: 修正前の実Chrome。保存済み実MP3、通常/SEのmenu.wavだけ1,800ms遅延。旧sayの結果と所要時間、tut-intro→tut-baseの待機、Context同一性を観測。
- `fixed.json`: 同じ条件の修正後。elapsedは要求から最初のAudioBufferSource.startまで。旧版のelapsedはsayが結果を返すまでであり、期限切れの記録を含む。通常条件の差は単一PC・各1試行の参考値で、統計的な改善率ではない。
- 測定再現: `npm run dev -- --config scripts/vite.voice-probe.config.mjs --port 5204` と `node scripts/measure-voice-fix4.mjs`。検証用空HTML上で実Sound/ControlVoicePacks/AudioContextを使用。SE遅延注入は検証側だけ。現行スクリプトはfixed.jsonを更新する。baselineは編集前に取得した記録で、現行スクリプトを旧コードへ差し替えず実行しても再取得できない。
- UI再現: 完成ビルドをpreviewの5205番で配信し、`node scripts/check-voice-fix4.mjs http://127.0.0.1:5205/ docs/evidence/voice-fix4-20261115/local --training`。タイトル操作→設定→未DL/ボイスなし→ヒロミDL→通常試聴→1.3倍速試聴→横2サイズ→再読込→声選択→タイトル→ソロ/進撃/初回確認を音声終了前に連続操作→訓練を最速開始。初回名登録は検証用ローカル名で通常UIを使い、初期化を終えてから連続操作を計測。
- `local/result.json` のvoiceStarts/rate、rapid/stops/maxLive、trainingVoicesを参照。音声ノードのstart/stop/endedを観測し、同時発話上限1、最後の発話開始と入力時刻の差、速度の端末保存を確認。音源に1秒超のSEを使わないメニュー/訓練初回が対象。
- UI試験器の修正履歴: AudioParamのfloat32値1.299999952を許容誤差で比較するよう修正。初回名登録・重なった設定モーダル・タイトル演出の終了待ちが不足していた試行は失敗であり、成功結果には数えない。製品の入力保護・演出を無効化しない。
- 公開再現: 同じUIスクリプトのURLを既存公開先へ変更する。配信照合は `node scripts/check-voice-fix4-delivery.mjs`。公開先でのゲーム進行は独立した検証用BrowserContextの端末保存だけを使い、多人数通信や本番補給抽選は行わない。
- 全件テスト等はchecks/。人間による実聴、実スマホ/iOS、全台詞/分岐、多人数インターネット戦は未確認。
