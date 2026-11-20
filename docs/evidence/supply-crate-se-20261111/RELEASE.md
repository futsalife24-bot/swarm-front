# 補給箱開封SEの公開（2026-11-11 JST）

- 実装 [PR308](https://github.com/futsalife24-bot/swarm-front/pull/308)、head `34d924ca853b4f4a63e879fe439d85cd3c18e369`。status/workflow0件・mergeableを確認して通常merge、保護の迂回なし。
- 公開source `00d013cd450aacda73636bfac31a28a936d2e18f`。既存Worker Version `99e4ee4d-7810-4e05-b538-767ef48de7cf`、2026-11-11 09:18 UTC、100%配信。
- [試聴サンプル・新しい箱の音10回](https://swarm-front.melosalife-24.workers.dev/supply-reveal/assets/crate-open-preview.mp3)。ゲームはページ再読込み後、通常/管理者確認の既定再生で新しいpop/pop_rを使う。原音/CC0/再生成は [原音README](../../../assets/audio/supply/README.md)。

## 結果

1. 専用worktreeをmerge済みorigin/mainへdetached同期し、当該HEADからVite build→既存 `wrangler.production.jsonc` のdry-run→deployがすべてexit0。既存大chunk警告は維持。既存Worker/サービス/認証/券/抽選に変更なし。
2. `wrangler deployments status` で上記Version 100%を確認。本体36ファイルSHA一致、health HTTP200/ok。[build-manifest.json](release/build-manifest.json)、[delivery.json](release/delivery.json)。build revision `82c1794f20138bfa44d5894c20ebfd1fbde00508c4a2daef491e785729aa487d`。
3. `supply-reveal` 全23ファイル（新PCM module/試聴MP3を含む）のbytes/SHA/HTTP200一致。[supply-delivery.json](release/supply-delivery.json)。
4. 公開MP3を実ChromeのHTMLMediaElementで読み込み、実クリックで再生。duration5.2秒、再生中currentTime0.22秒以上、media errorなし、pageerror0。[public-audio.json](release/public-audio.json)。これは公開サンプルの実再生であり、公開ゲーム全操作や実聴と同一視しない。
5. 実ゲームと同じruntime/AudioContextのローカル表示fixtureでは、10箱をタップ完走し、新PCMと一致する10回のAudioBufferSourceNode.start・全rate1・pageerror0を確認済み。両型/JS構文/差分確認と合わせ [VALIDATION.md](VALIDATION.md) を参照。

```powershell
$env:SWARM_RELEASE_OUTPUT='docs/evidence/supply-crate-se-20261111/release'
node docs/evidence/coop-comfort-20261030/verify-release-delivery.mjs --public 99e4ee4d-7810-4e05-b538-767ef48de7cf
$env:SUPPLY_OUTPUT='docs/evidence/supply-crate-se-20261111/release'
node scripts/check-supply-delivery.mjs
node scripts/check-supply-crate-public-audio.mjs
```

公開後の記録branch `codex/supply-crate-se-release-record-20261111` は文書・証拠・再現用検証器のみ。製品再公開は不要。専用HEADをorigin/mainと一致・cleanへ同期し、別作業中のmainとrootの既存差分を保持する。

音の実聴・実スマホは今回未実施。今回の全ゲーム全件/公開ゲーム本体の10連操作は実行せず、音だけの変更に対応する実音声経路と配信を確認した。主担当gpt-6.1-sol（推論未確認）、素材調査の補助指定gpt-6-sol/medium（実設定未確認）。独立Chat監査ではない。
