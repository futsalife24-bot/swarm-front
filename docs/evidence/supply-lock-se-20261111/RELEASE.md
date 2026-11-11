# 鍵が外れる補給SE（2026-11-11、公開済み）

前回の開蓋音は本人が見送り。CC0の実録 [Lock #0191](https://bigsoundbank.com/lock-s0191.html) を使い、鍵の回転とボルトの二段の打撃を短く加工した。出典・原音SHA・加工条件は [README](../../../assets/audio/supply/README.md)。

既存の同期PCM再生へ差替え、pop/pop_rのみ更新。速度1と既存の時刻を維持。実Chrome844×390の表示fixtureでタップ10箱完走、新波形の長さ/RMSと実AudioBufferSourceの一致・全rate1・例外0を確認。audio-check.json。前回の試聴リンクは現行音へ更新し、キャッシュを区別するクエリ付きで案内する。

音の実聴・実スマホは未確認。公開後ここへsource/Version/配信照合結果を記録する。主担当gpt-6.1-sol（推論未確認）、今回は委任なし。

## 公開結果

- [PR310](https://github.com/futsalife24-bot/swarm-front/pull/310) 通常merge。公開source `fd9e4dd63f4a4a28b05879a268e8f968087d8ee7`、既存Worker Version `4c7843fb-ce67-47a3-900d-d0f974dc184d` 100%配信。status/workflow0件・mergeableを確認し、保護の迂回なし。
- merge済みmainから本体build/dry-run/deploy成功（既存大chunk警告は維持）。本体36＋演出23ファイルSHA一致、health200/ok。release/build-manifest.json、delivery.json、supply-delivery.json。
- 公開MP3を実Chromeで読込み・クリック再生し、duration5.2秒/再生進行/例外0を確認。release/public-audio.json。試聴URL https://swarm-front.melosalife-24.workers.dev/supply-reveal/assets/crate-open-preview.mp3?v=lock-20261111 。公開側のゲーム本体10連操作/実スマホ/耳での試聴は未実施。
- 検証は既存check-supply-crate-public-audio.mjsの出力先と試聴クエリだけを差替えたコピーを使用。公開後branch codex/supply-lock-se-record-20261111は記録のみで製品再公開不要。元root/別worktreeの差分を保持、専用HEADをorigin/mainと一致・cleanへ同期する。
