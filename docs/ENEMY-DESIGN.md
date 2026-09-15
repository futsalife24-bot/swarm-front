# モンスターデザイン（2026-09-09）

実装・自己検証済み。公開は自動承認レビューによる拒否のため未実施。

## 変更
- 甲虫: 左右の装甲、背中の割れ目、前角、短い6脚。
- 酸嚢型: 背の高い2つの酸嚢、筒状の口、6脚。
- 蟻: 頭・胸・腹の3分節と細い腰、折れた触角、大顎、動く6脚。
- 蜘蛛: 低い2分節の胴、横へ広がる8脚、4眼、短い牙。
- 蜂: 大きな前後4枚羽根、羽脈、羽ばたき、縞の腹、尾針、細い6脚。壁で静止中は羽ばたき停止。
- 巨大ミミズ: 脚なし。環状の表皮、丸い口と歯を持つ頭1個、顔・脚のない専用胴節7個。胴節の重なりで全身をつなぐ。
- 戦闘計算・敵の移動・通信仕様は変更なし。

## 検証
型チェック成功。既存単体97件成功。最終の描画接続修正後も型チェック・本番ビルド成功。
Chrome/SwiftShaderで全6種類のカラー・単色表示を生成し、輪郭の差とミミズ全身を目視確認。
実Rendererで頭1個・胴節7個、蜂の飛行属性を検証。pageerror・WebGL/shaderエラーなし。
ローカル確認中の外部Turnstile取得は環境のネットワーク制約で失敗。ゲーム描画とは分けてqa.jsonへ記録。
既存の500KB超バンドル警告あり。実機の体感確認・新造形の公開確認は未実施。

## 差分・証拠
branch: codex/home-armory
base / HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc
既存を含む未コミット・未追跡変更あり。commit / mergeなし。
今回の変更: src/client/enemy-model.ts（種類別形状を新設）、src/client/render.ts（共通形状を置換・胴節専用描画・蜂の羽ばたき）、src/client/changelog.ts、scripts/check-enemy-design.mjs、docs/STATE.md、本書。
証拠: dist-validation/enemy-design/{species.png,monochrome.png,worm.png,qa.json,render.diff,changelog.diff}。
新規形状の全文: src/client/enemy-model.ts。開始時ファイルは同証拠ディレクトリの *.before.ts。
配布候補: dist/assets/index-BreB7qYn.js。

## 公開待ち
既存Workerへのwrangler deployは実行前に自動承認レビューが拒否。
理由: 本番Workerは高リスクな外部変更で、今回のユーザー依頼には公開の明示承認がないとの判断。
game/AGENTS.mdの公開指示を根拠に実行したが、迂回・再試行はしていない。
再開条件: ユーザーが既存Workerへの公開を明示承認。その後公開し、配信JS一致・ソロ起動・API healthを確認する。

追記: この旧生物版はユーザー承認後の中断前に公開完了。続いて機械生物設定へ変更・公開済み。現行は [MECHA-DESIGN.md](MECHA-DESIGN.md)。
