# 第一弾 独立監査後の修正記録

2026-09-10。4必須＋3改善だけをローカル修正。第一弾の確定、公開、push、merge、commit、git addは行っていない。HOUNDの骨格再調整は第二弾以降として対象外。

## 変更と検証対応

|監査項目|修正|確認|
|---|---|---|
|酸の見た目|CombatEffectsの緑の飛沫・水たまり・重力落下を撤去。青白い短時間の発光と火花、青白い軌跡へ|生成要素・色・0.2秒後消滅の単体検証、実WebGL画像|
|RAY真下射撃|目標胴体までの3Dベクトルを長さで正規化、合成速度19。真下はdx=dz=0、dy=-19|真下の実被弾、ほぼ真下の有限速度19を検証|
|FOUNDRY CLUSTER|実ダメージと同じ炉→隊員のvisible判定で候補隊員を絞って最大人数の円を探索|壁越し3人より射線の通る1人を選び、実際のHP減少が1人だけになる回帰テスト|
|現行更新履歴|ANOMALY版だけを表示。旧全文はdocs/CHANGELOG-LEGACY.ts.txtへ保存しアプリからimportしない|旧語句の単体検査＋実際の更新履歴ダイアログを確認|
|PRISM/RAY予兆|床の範囲円を十字照準に変更。発射元から胴体照準まで細い3D射線を表示。RAYは追尾時黄・固定時青白|実描画インスタンス6、範囲円は炉1個だけ、画像確認|
|RAY高さ判定|射撃開始の射線判定を発射高度から胴体までのwallDistanceへ変更|低い建物を越す射線は通り、高い建物で交差する射線は遮断|
|連結炉の空中心射撃|密集中心に最も近い生存接続隊員の座標を0.8秒前に固定。単発弾・節HP・分裂・ダメージ10を維持|空中心でも実隊員を選択、配列逆順で一致。既存各節射撃・被弾テストも成功|

## 最終検証

- npm test -- --reporter=dot: 11ファイル、161/161成功（既存154＋回帰7）。全20面の自動攻略を含む。unit.log。
- npm run typecheck: 成功。typecheck.log。
- npx playwright test --config playwright.structure.config.ts: 2/2成功。実ローカルWorker/DO＋独立4ブラウザ接続、2画面描画、ソロ起動、844×390の図鑑と更新履歴、予兆・着弾の実WebGL。e2e-final.log、network.json、visual.json、各PNG。
- npm run build / npm run build:pages: 成功。build.log / pages.log。
- npm run server:build: dry-run成功、デプロイなし。worker-verified.log。
- 今回8コードファイルのprettier --check: 成功。format.log。
- 実画像telegraphs-phase3.png、energy-impact.png、changelog.pngを目視確認。
- ENEMIES定義、wave構成、Worker実装の変更なし。変更はsharedの通常stepに入り、クライアントが攻撃を判定しない。

## 境界・残課題

- 通信と既存状態との互換性のため、内部Event識別子acidと節タイマーacidAtは保持。液体描画は残していない。旧資料の語句と内部名の全面改名は範囲外。
- FOUNDRYの人数最大化は照準開始時の生存・接続・可視隊員に対するもの。予兆中に移動すれば実被弾人数は変わる。遮蔽物ルール自体（炉から隊員）を変更していない。
- RAYの速度19は従来の水平成分固定から3D合成速度固定になるため、高低差のある射撃の到達時間が変わる。HP・基礎攻撃力は維持。
- 連結炉は0.8秒前の隊員座標への単発弾。予兆中の回避や壁への着弾は引き続き可能。
- WebGL画像は固定fixture、実通信は隔離配置から通常stepを実行。自然進行の4人全ミッション、人間の難易度評価、Android実機は未検証。
- 既存の500KB超チャンク警告あり。全体整形の既存4件は前回記録どおりで、今回無関係の全体整形は再実行していない。
- 初回E2E/Workerはsandboxの親ディレクトリ参照で起動失敗。残存Viteがポートを占有した再試行も失敗。確認済みの当該親プロセスと子だけを終了後、制限外のローカル実行で成功。失敗ログも残した。

## 再監査の入口

- repository: game/。branch: codex/home-armory。
- base/headとも 2be699f160c83d641fb68bb1304e4da8059920dc。未コミット変更あり。着手前から変更28件・未追跡76件があり、それらを保護した。
- 証拠: dist-validation/structure-audit-fix/。change.patchは今回着手状態との差分。before/は変更直前、manifest.jsonは前後SHA-256。HEADからの既存大量差分と混同しない。
- swarm-front-anomaly-audit-fix.zipは今回の修正用差分パック。前回の233件監査ZIPと併用する。files/内は修正後全文、evidence/は今回差分・変更前本文・検証証拠。ZIP内manifestは全同梱ファイル（manifest自身を除く）のSHA-256。
