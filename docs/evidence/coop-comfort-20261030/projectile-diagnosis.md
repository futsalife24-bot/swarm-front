# 実体弾の密集時欠落・直撃抜けの診断（2026-10-30）

対象は専用worktree `C:/Users/futsa/.codex/worktrees/coop-comfort-20261030/swarm-rebuild-p1a`、branch `codex/coop-comfort-20261030`、基点main `3e1dc640e15d747cc2a06ac72c59833db2072f74`。担当範囲はsrc/shared/game.ts、tests/player-projectile-pressure.test.ts、本診断文の3ファイル。修正前の再現後、主担当の指示で実体弾の修正まで実施した。独立監査ではない。

## 追加した回帰テスト

`tests/player-projectile-pressure.test.ts` は通常のSTARTERSロケットを装備し、`step(world, inputs, 0.05)` の手動射撃経路を使う。通信や製品関数のモックは使わない。敵は通常のantで、既存テスト同様にwindを長く保ち、移動・追加射撃の影響を切り離した。

1. 敵弾0個: 弾薬を1消費し、shotイベントとプレイヤー弾が各1個生成され、その後のstepで敵HPが減る対照条件。
2. 敵弾100個: 敵弾は射線外・地上20mに置き、試験中にプレイヤーへ当たらず消滅しない。上記と同じ手動発射が成立することを要求。
3. 球の通過: 通常ロケットが1tickで1.4m進む区間の中央へ敵球の端を置く。球と線分の交差、始点と終点が両方球外であることを先に検査し、そのtick内でのダメージ・弾消滅・爆発を要求。

## 修正前の結果

実行: `node node_modules/vitest/vitest.mjs run tests/player-projectile-pressure.test.ts --maxWorkers=1`

- 3件中1件成功、2件失敗。通常時の対照条件は成功。
- 敵弾100個では弾薬消費とshotイベントの検査は成功したが、プレイヤー弾は期待1個に対して実際0個で失敗。
- 球の通過条件では幾何の前提検査は成功したが、敵HPが発射前後とも80.75のままで失敗。
- 失敗を回避する期待値変更や、製品の弾数・速度・半径変更はしていない。型検証・全体テスト・実ブラウザ・本番戦闘はこの分担では未実施。

## 基点の製品コード上の根拠と限界

- `src/shared/game.ts:1262` は先に弾薬を減らす。`:1324` は敵味方共通のprojectilesが100個未満の時だけプレイヤー実体弾を追加する。一方で`:1348`付近のshotイベントは上限到達時にも生成する。
- `src/shared/bastion.ts:349` と`:426`付近は予告した敵弾を上限で切らず追加する。したがって敵弾100個への到達経路は製品側にもある。ただしこの試験は個数を直接用意しており、BASTIONの弾幕生成そのものの再現試験ではない。
- `src/shared/game.ts:2109–2138` は実体弾の移動後の端点だけで敵への直撃を調べる。BASTIONの対プレイヤー弾は`:2255`以降で通過区間を調べており、判定方式が異なる。
- 弾数上限の問題はrocket/heavy/grenade/sticky等の実体弾に該当する。rifle等の即着弾武器の不発、通信遅延、描画負荷、敵省略の説明をこの2件だけで済ませない。球の通過は高負荷を必要としない既存不具合である。

## 実行環境の補足

通常sandboxでは専用worktreeのGit状態・junction先の参照に制限があり、正規のrequire_escalatedで実行した。最初のnode_modules参照先dist-hにはVitestがなく、主担当がjunctionをrootの既存依存へ修正し、新規テストを既存Vitest設定に登録した後に上記を実行。インストール・他プロセスの停止は行っていない。

途中のprogrammatic runner初回はWindows絶対パスのESM import形式で失敗した。file URLに直した呼出はRUN表示だけで結果を取得できず、検証成功とは扱わない。修正前の再現結果の判定根拠は、通常CLIで取得した上記3件である。

担当の呼出指定はgpt-6.1-sol/high、実行モデルID・推論設定の実値は未確認。

## 修正内容

- 手動実体弾の生成から、敵と共有するprojectiles.length < 100の分岐を除いた。fireの既存受理条件（装填中・射撃間隔・切替中・残弾）は維持。新たな上限、敵弾の削除、ダメージ・発射間隔・弾薬・弾速・寿命の数値変更はしていない。
- プレイヤー実体弾の移動線分と全敵の生存部位球との入射点を調べ、一番早い交点へ弾を移して既存の爆風・部位ダメージ・chain処理へ渡す。中心の距離や敵配列順で直撃元を選ばない。同距離では障害物を優先し、敵同士の同距離はIDで安定させる。
- 壁・既存の地形射線で移動可能区間を切り、床へ入る場合だけ20回の二分探索で床交差まで縮める。床より後にある球を直撃元にしない。爆風自体による周辺ダメージは従来どおり起こり得る。
- プレイヤー実体弾の零移動は距離で割らず、座標を保持する。球内なら接触、球外なら寿命まで静止し、期限で爆発する。敵弾の移動・対プレイヤー命中分岐は既存の計算を維持した。

## 修正後の検証

担当テストは13件成功。修正前の3件に、敵配列の順序2条件とchainの直撃元、壁が先にある場合、床の後で球と交差する場合、球内外の静止弾2条件、既存の4種類の発射拒否条件を追加した。床試験では爆風と直撃を区別するため、床面爆発が1回だけで、床の先の敵からchainが起きないことも確認する。

追加ケースの初回は13件中11件成功、最初の個体2件が失敗した。fixtureの後方敵が大きい個体倍率を持ち、その球面が前方敵の球面より手前に張り出していたため、製品は実際の先頭球へ正しく着弾していた。2体の倍率を同じ通常値へ揃えて入射順を固定し、敵配列の両順序で検証した。期待する最初の交点・chain元の基準は緩和していない。

関連単体の実行:

`node node_modules/vitest/vitest.mjs run tests/player-projectile-pressure.test.ts tests/weapon-families.test.ts tests/game.test.ts tests/front-fusion.test.ts tests/front-survival.test.ts tests/bastion.test.ts tests/terrain.test.ts tests/harrow-weapons.test.ts tests/enemies.test.ts tests/rebuild-combat.test.ts --maxWorkers=1`

10ファイル299件が成功、実行時間18.24秒。従来の武器挙動・frontの弾情報・BASTION・地形・HARROW爆風・部位とchainを含む。

`node node_modules/typescript/bin/tsc -p tsconfig.json`、`node node_modules/typescript/bin/tsc -p tsconfig.worker.json`、担当コード2ファイルのPrettier確認、git diff --checkも成功。全体テスト・build・実ブラウザ・実インターネット・実スマホはこの分担では未実施で、主担当の統合検証と区別する。commit/pushは主担当が行うため未実施。

## 統合時に必須の残確認

共有上限を除くと、従来は消えていた合法なプレイヤー弾が実際に存在する。人数、合法な最大連射、長い寿命、BASTIONの敵弾を重ねた計算時間・状態サイズの確認が必要。既存受理条件により生成は有限だが、64KiBへ収まる保証とは別である。

主担当から共有された別計測（scripts/measure-coop-wire.mjs、denseWireFixture）では、180弾時に敵96体中32体省略、280弾時に63体省略、400弾では敵全省略後も75,005バイトとなる。これは本担当が新たに実行した試験ではない。合法な最大負荷での通信容量の同時改善は統合側の必須課題として引き継ぐ。弾や敵を黙って削る処置・上限の付け替えはこの分担で追加していない。
