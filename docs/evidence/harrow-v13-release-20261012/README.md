# HARROW v13 低姿勢化・公開記録

2026-10-12。対象PR: https://github.com/futsalife24-bot/swarm-front/pull/171

- base: `cbda0481234fe494dd4d1ab023869e9812ea978d`
- 監査対象実装: `d8ecc2e8a6b7f154169ac8b5374d133135250dae`
- merge時HEAD: `04a8a593bbecc2513fe7cf3da943f0700ab43da1`。監査対象との差は進行記録2文書のみと実Gitで確認。
- mainへの通常merge: `39d56bc2ae5cc6cd88ac91f22b12190f37ef3d76`
- GLB SHA256: `c5a8e2e241cc441473519ed7f12e24e7b508c916d00cf7270427cc4a0a7ef0ba`

## 変更と検証

旧低姿勢回転の胴・翼角から脚を伸ばした地上姿勢、翼を寝かせた飛行、山なりミサイル時の翼の横展開を反映。形状/UV/ウェイト/材質、39骨・18動作、7攻撃の威力/時間/発数/AIを保持。40発射元を実GLBへ同期。

初回監査のP2（Idle↔Locomotionの約0.32256mの骨位置差）は、歩行軌道の一定オフセットで修正。境界差は0.000005692m/0.000005683m。全39骨の行列検査を含む122テスト、型、素材/姿勢/発射元、修正commitからのbuild/production dry-runが合格。実Worker2接続22項目は発射元変更後に合格、P2修正は戦闘/通信コードを変更していない。他17動作は実トラック比較で一致。

## 独立再監査

[通常Chat](https://chatgpt.com/c/6acc6d2a-fae8-83ee-9950-2f70807c9693)の完了回答を確認。対象d8ecc2e、P0/P1/P2各0、技術的merge・既存Worker公開可。監査ZIPは142ファイル/90,940,188bytes、SHA256 `57d58ab0b5f51fb8e46160cf575d27c6c052ca5948fa0a01b3914c3d47df0f32`。

監査側はZIP/manifest/GLB構造とコード・計測結果・ログの対応を確認。Blender再生成、テスト/通信/描画の独立再実行はしていない。他17動作の一致は比較記録とスクリプトの照合であり、旧GLBとの独立バイナリ比較ではない。足滑り最大0.108329m、実スマホ/長時間GPU、本人の美術的採用は未確認事項として維持。

## 実画面

旧タブの再読込はタイムアウトしたが、同じiabの新規検証タブで修正版GLBを読み込めた。歩行サイクル8.43秒を録画し、歩行/終了付近の代表姿勢を目視確認。全動画フレームの精査ではない。`local-walk.png` / `local-walk.json` は修正版の実ゲーム描画。監査ZIP内の旧動画を新しい証拠として扱っていない。

監査送信時のUnknown errorは同じChatを新しいタブで開き直すことで解消。初回送信時に復元した別件下書きはGit/監査添付に含めていない。

## 公開

main `39d56bc2ae5cc6cd88ac91f22b12190f37ef3d76` からbuild/production dry-run成功。既存Worker Version `4903e901-f5ea-4933-ab81-da40ba8658c0` へ公開。配信25/25 SHA一致、health 200/ok、iabの公開エネミーレポートでHARROWモデルと移動再生を目視確認。公開URL: https://swarm-front.melosalife-24.workers.dev/front 。公開時の既存進行データでCALYXも一覧に表示。Chrome接続はDebugger unattachedだったため、公開UIはiabで確認。

主担当モデル/推論設定は未確認。制作補助は `gpt-6-sol` / `medium`、再開・監査・公開は主担当単独。
