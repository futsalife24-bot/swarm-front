# 機械生物デザイン（2026-09-09）

全6種を従来の種別シルエットに基づく機械生物へ変更。ユーザーの「公開までしちゃっていい」の明示承認に基づき公開済み。

- 巨大ミミズ: 脚なし、環状装甲・重なる装甲板・発光帯・掘削口。頭1個と顔のない胴節7個。
- 蜂: 大きな4枚の金属羽根、駆動ヒンジ、発光ライン、尾針。羽ばたきと壁での停止を維持。
- 蟻: 3分節と細い腰、触角・大顎、ピストンと軸受を持つ6脚、背面の排熱部。
- 蜘蛛: 低い胴と8脚、機械関節・接地パッド、背面の発光コアと光学センサー。
- 甲虫: 左右の厚い装甲、排熱スリット、前角、6脚。
- 噴射型: 従来の酸嚢を2本の薬液タンクへ置換。固定リング、液量表示、配管、噴射口。
- 全種: 金属材質・角張った外殻・発光部。タイトルの説明と更新履歴に機械生物設定を反映。

戦闘・移動・通信の仕様変更なし。

## 検証
- 型チェック成功、単体97件成功、本番ビルド成功。既存の500KB超バンドル警告あり。
- Chrome/SwiftShaderで全6種のカラー・単色画像とミミズ全身を目視確認。
- 実Rendererで頭1個・胴節7個、蜂の飛行属性を確認。pageerror・WebGL/shaderエラーなし。
- ローカル環境のTurnstile取得はネットワーク制約で失敗。描画エラーと分けてqa.jsonへ記録。
- 実機による体感評価は未実施。

## 公開
最初の生物デザイン版は中断前に公開されていたことを配信JSで確認。今回、機械生物版へ更新。
URL: https://swarm-front.melosalife-24.workers.dev
Version: 448fc4b2-2502-432d-b014-f70a3d596ff4
公開JS: /assets/index-8UZYoUWc.js
公開確認の結果: dist-validation/mecha-design/live/result.json。

## 差分・証拠
branch: codex/home-armory
base / HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc
既存を含む未コミット・未追跡変更あり。commit / mergeなし。
今回の主変更: src/client/enemy-model.ts、src/client/render.ts、src/client/changelog.ts、src/main.ts、scripts/check-mecha-design.mjs、scripts/check-mecha-live.mjs、docs/STATE.md、本書。
開始時ファイル・差分: dist-validation/mecha-design/*.before.ts と *.diff。
造形の全文: src/client/enemy-model.ts。
画像: dist-validation/mecha-design/{species.png,monochrome.png,worm.png}。
描画検証結果: dist-validation/mecha-design/qa.json。

公開後確認成功: Chrome 1280×720 / 844×390で配信JSとローカル成果物のSHA256一致、ソロ出撃、ライフル・ロケット射撃、API health HTTP200 / ok:true、pageerrorなし。SHA256: 2286e33f9229b474ed6891c2713b92a1c11831fd402f28989099b4acf04b5e5e。
