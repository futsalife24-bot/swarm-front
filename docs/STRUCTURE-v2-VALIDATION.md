# STRUCTURE × ANOMALY v2 実装・検証記録

2026-09-10、ローカルのみ。設計正本は [STRUCTURE-ANOMALY-v2.md](STRUCTURE-ANOMALY-v2.md)。既存の未コミット作業を保持。公開・push・merge・本番反映・commitは実施していない。

## 1. 変更ファイル

|ファイル|今回の変更|
|---|---|
|src/shared/structure-ai.ts（新規）|NEAREST / 遠距離可視優先 / ISOLATED / CLUSTER、固定IDの同点解決、炉のHP段階|
|src/shared/game.ts|標的ID、RAY追尾固定、HOUND投げ出しと前方衝撃波、PRISM後退・直進弾、炉のwave内生成と段階、電撃杭識別|
|src/shared/enemy-motion.ts|RAYの壁付着廃止、洞窟経路キャッシュを保存対象へ|
|src/shared/worm.ts|連結炉のCLUSTER照準・0.8秒前の位置保存。節HP・分裂・弾ダメージは維持|
|src/shared/stages.ts|説明と名称のみ新世界観へ。waveデータは不変|
|src/client/enemy-model.ts|旧昆虫生成処理を撤去。五脚・分離脊椎、非対称プリズム、穴と三尾の遊泳体、開放炉とレール|
|src/client/render.ts|権威標的に向く描画、HOUNDリング収縮と扇形、RAY緩やかなプレート変形・電撃杭、炉の展開と生成発光、連結炉予告|
|src/client/bestiary.ts / src/main.ts|新名称・攻略説明・勢力表示|
|server/testing.ts|通常Workerから分離された4敵の初期状態fixture|
|tests/structure-v2.test.ts（新規）|16件のAI・攻撃・生成・保存復元・形状と照準の検証|
|tests/enemies.test.ts|旧壁付着/低空期待をRAY仕様へ、連結炉の保存照準に合わせた準備位置|
|vitest.config.ts|新しい単体テストを通常実行へ追加|
|playwright.structure.config.ts（新規）|ローカルVite・実Worker・Chrome用の独立構成|
|e2e/structure-v2.spec.ts / e2e/structure-fixture.html（新規）|4接続の状態一致、2画面描画、図鑑、ソロ起動、実WebGL予兆確認。空HTMLはテストのみに使用|
|docs/STRUCTURE-ANOMALY-v2.md（新規）|全20種・3ボス、世界観、設計規則、第一弾契約、将来候補|
|docs/STATE.md / 本書（新規）|現在地と検証・残課題|

src/shared/defs.ts は未変更。権威サーバーの通常worker.tsと通信network.tsも今回変更なし。敵の追加状態は既存のworld配信・保存で運ぶ。

## 2〜5. 第一弾4敵・標的AI・予兆・ビジュアル

|敵|標的|攻撃と予兆|シルエット・移動|
|---|---|---|---|
|HOUND|最も近い生存接続隊員|0.45秒リング収縮、前方120度・2.5mの衝撃波。床の扇形が実際の方向を示す|長い前脚2本＋短い後脚3本、頭なし、浮遊背骨と縦リング。低姿勢から短い投げ出し加速|
|PRISM|射線の通る16m以上の最遠隊員、なければNEAREST|開始位置を0.8秒表示、速度13の直進エネルギー弾|非対称多面体と分離板。17mで接近を止め、16m未満で後退|
|RAY|他の生存接続隊員との平均距離が最大の隊員|0.8秒中、発射0.4秒前まで追尾。以後固定し斜め下へ速度19の電撃杭。追尾/固定で色を変更|二枚の平面、中央縦穴、三本の推進尾。羽ばたかず高低差を付けて遊泳し、近距離では旋回|
|FOUNDRY ZERO|半径7mへ最大人数を含むCLUSTER地点|1.8秒の範囲円。HP2/3以下で既存PRISM枠を炉周辺から生成、1/3以下で攻撃時に支柱・上部構造を展開|壁・レール・空洞・複数リングを持つ移動炉|

生存・接続中だけを対象にし、同点は固定ID順。ソロは本人。ThreatやLEADは追加していない。HPと基本攻撃力はHOUND 75/10、PRISM 100/14、RAY 60/12、FOUNDRY ZERO 4200/40。人数・ステージ倍率も維持。

既存ant/spider枠はHOUNDの散射/跳躍派生へ外見と説明を変更し、既存性能を維持。worm枠は連結炉の工業モジュールへ変更し、節破壊と分裂を維持。第一弾以外の独立した新敵は実装していない。

## 6. 検証結果

|検証|結果・証拠|
|---|---|
|npm run typecheck|成功。クライアント・shared・Worker|
|npm test -- --reporter=dot|154/154成功、11ファイル。全20ステージの既存自動攻略を含む。unit-final.log|
|4人保存復元・ソロ保存復元|都市と洞窟の4敵でJSON復元後に100tick進めた状態が一致。単体テストに含む|
|npx playwright test --config playwright.structure.config.ts|最終2/2成功。e2e-verified.log|
|実通信|独立した4ブラウザコンテキスト＋実WebSocket＋ローカルworkerd/DO。通常のhello/equip後にfixtureから開始。同じ時刻の敵状態と弾状態が4者一致。RAY/PRISMの標的、炉の密集予告を確認。2画面で実際に描画。network.json|
|実WebGL・UI|1280×800の4モデル、844×390の図鑑、通常ソロ起動と射撃、固定した予兆fixtureでHOUND扇形・3円・炉のPhase 3シェーダーを確認。pageerrorとWebGL/shader errorなし。visual.jsonとPNG|
|npm run build / npm run build:pages|成功。最終通常JS約688.11KB、gzip約190.33KB。既存の500KB超チャンク警告あり|
|npm run server:build|最終dry-run成功。実デプロイは行わない。worker.log|
|変更対象のprettier --check|全対象成功。format-changed.log|
|全体npm run format:check|不合格。今回のテストHTMLは修正済み。残る4件は未変更の src/client/weapon-help.ts、e2e/lobby.spec.ts、playwright.enemies.config.ts、wrangler.production.jsonc。依頼外の既存整形差分は修正していない|
|バランス定義差分|ENEMIES定義は着手時と完全一致。stages.tsもname/brief以外は一致。balance.json|

証拠の共通フォルダ：`dist-validation/structure-v2/`。画像：`crawler.png`, `spitter.png`, `hornet.png`, `boss.png`, `report-mobile.png`, `telegraphs-phase3.png`, `coop-0.png`, `coop-1.png`。実画像を確認済み。

テストの区別：Co-opの敵配置は隔離fixtureで準備を短縮したもの。その後の照準・攻撃・配信は実Workerの通常step。ブラウザ描画試験の予兆は表示確認用に固定した状態。全ミッションを4人で自然攻略した証明ではない。Service Workerは当該テスト構成のみブロックし、製品の登録・保護機能は変更しない。

初回失敗も保存：旧RAYの付着・低空期待2件と連結炉の旧即時照準テストを新仕様へ更新。Wranglerのsandbox起動・親ディレクトリ参照失敗は許可されたローカル再実行で解消。E2Eの個人報酬比較、空画面へのService Worker干渉、fixture前の武器未選択を修正後、最終2件成功。これらを製品回帰として隠していない。

## 7. branch / HEAD / 証拠範囲

- 実装repository：親フォルダ直下の `game/`。親の未初期化masterと旧コピーは対象外。
- 作業branch：`codex/home-armory`。
- 着手時baseと終了時HEAD：`2be699f160c83d641fb68bb1304e4da8059920dc`（commitなし）。
- ローカルmainなし。`origin/main`：`a2e16139a86268815f558d50ca537e05d2f13618`。
- `git ls-remote origin refs/heads/main` でも同一SHAを確認。fetch・pushなし。
- 未コミット変更・未追跡ファイル多数が着手時から存在。今回変更も未コミット。
- `before/` は今回編集直前のファイル。`change.patch` はこの着手状態からの今回差分であり、HEADからの過去作業を混ぜない。`manifest.json` に対象別の前後SHA-256。Git除外のローカル証拠。

レビュー用の差分要点：nearest reduce → selectStructureTarget、RAYはwind>0.4の間だけtx/tz更新、crawlerは方向内積で前方だけ被弾、bossはclusterPointで座標固定、生成時のspawnedを通常通り1だけ加算、経路WeakMap → Enemy.navigation。描画は新しい標的を勝手に選び直さずtargetIdまたは固定tx/tzへ向ける。

## 8. 将来実装候補

STILT、BURROW、SKIPPER、PIN、MINELET、MIRROR、RELAY、RAMMER、FLOAT、MAW、MORTAR、ANCHOR、LEVIATHAN、COLOSSAL HOUND、BASTION、FOUNDRY、MERIDIAN。ボスFALSE GODとARCHIVE。全設計を正本へ保存済み。

## 9. 残課題・制約

- 敵数維持のため、FOUNDRY ZEROの生成は既存waveの残りPRISM枠に限定。枠がないwaveでは生成しない。独立した無限増援は未実装。
- 精密な関節アニメーション・素材吸収粒子・大規模な変形演出は未制作。第一弾の五脚歩行、リング収縮、柔軟板の遊泳、炉の展開は軽量コード形状とシェーダー表現。
- 空洞を含む敵の被弾判定は従来の簡易半径のまま。空洞に弾が通り抜ける専用判定はない。
- CLUSTER候補は円の交点を1mm内側へ寄せて数値境界を安定化。極端な境界配置はこの許容差を持つ。
- AI・移動・弾道変更による実効難易度は変わり得る。人間のプレイ評価、Android実機、インターネット4人協力、長時間性能、全4人自然攻略は未確認。
- 全体整形に既存4件の警告。公開・push・merge・本番反映は未実施。
