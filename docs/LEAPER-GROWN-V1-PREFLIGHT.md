# PR91 LEAPER成長殻モデル：限定監査・停止記録

2026-09-26。Claude Codeによる実装とは別の通常Chatで実施した限定検査。**要修正 / BLOCKED。リリース監査合格ではない。**

## 対象

- PR: https://github.com/futsalife24-bot/swarm-front/pull/91
- branch: `claude/hound-leaper-redesign`
- 検査対象実装HEAD: `a60d82fc3948e5f916fbee9ef55d9278f8cff335`
- 比較base / merge-base: `97926835baefe1fa8fa41df079360114a3e4061d`
- 取得時点ではPRはopen・未merge。baseに対し3コミット先行、遅れ0、変更29ファイル。
- 本記録の追加は文書のみ。ゲーム実装・素材の修正、main反映、公開は行っていない。

## 手順と実行環境

`AGENTS.md`、`docs/WORKFLOW.md`、`docs/skills/swarm-front-audit-release/SKILL.md`、STATE先頭、造形正本第1・2節を確認した。

GitHub接続で対象SHAのソース・差分・検証記録を取得した。ユーザーPCの `game/` と `swarm-front-review` はこの環境にマウントされておらず、操作していない。ローカルのclean状態・未コミット変更のハッシュ保存は確認していない。

指定のCodexアプリ内ブラウザ `iab` 操作ツール、ユーザーPCのBlender実行経路、認証済みCloudflare公開接続が本Chatにはない。接続機能の検索でもCloudflare連携は見つからず、別ブラウザ・別公開先へ切り替えていない。隔離コンテナからのGit取得はDNS解決に失敗した。

したがって、指定の「iabから新規通常ChatへZIP添付」の経路は未実施。本Chatの限定検査を、その経路の完了や実物監査合格として扱わない。監査Chat URLも取得していない。停止理由は継続承認の不足ではなく、実行経路と最終証拠の不足である。

## 必須指摘

確認できた範囲では **P0: 0 / P1: 0 / P2: 1**。未検証領域の無欠陥を保証する件数ではない。

### F1 / P2：最終採用モデルに対応した動作検証証拠が揃っていない

箇所：

- `assets/blender/candidates/hound/grown-v1/evidence/loader-checks.txt` 第4行
- `assets/blender/candidates/hound/grown-v1/leaper/validation.json`
- `assets/blender/candidates/hound/grown-v1/build_candidate.py` の検証・出力部
- `assets/blender/candidates/hound/grown-v1/DESIGN.md` の初期候補の説明・検証欄

再現・根拠：対象SHAの `loader-checks.txt` を読むと、LEAPER候補の検証は `Idle / Locomotion / Lunge` の3クリップだけで、`Leap` がない。一方、最新 `validation.json` は4クリップ、3,802,608 bytes、SHA-256 `d59f79201f8b02a489084b5a96845276458e32c85868c832c90653961083fa59` を記録している。このSHA-256は実装側の記録であり、本監査がGLB実バイトから再計算した値ではない。

生成器末尾は4クリップ・mesh数・骨数等をassertするが、`rest_min_z_blender` は静止頂点の最下点である。`reimport: PASS` も再読込後のarmature数と静止頂点の有限性の検査であり、最終4クリップの全動作・スキニング後接地・遷移を検査した証拠ではない。PR本文の「全クリップ25時点」の主張を、この保存ログだけでは最終v3へ対応付けられない。

また、既存 `tests/structure-motion.test.ts` は今回追加した `leap` 入力や `Leap` 遷移を行使しない。既存のmotion系12件成功だけでは新分岐の回帰検査にならない。

これは「Leapが壊れていることを再現した」という指摘ではない。最終モデルの動作確認を再現・追跡できる証拠が足りないという指摘である。

最小対応：最終public GLB・候補GLB・Blender原本・生成器を完全SHA/サイズ/SHA-256付きで対応付け、最終GLBに対して4クリップ、骨名、bind、有限値、意図した接地、Idle/予備動作/Leap/着地後の遷移を検査し、実行スクリプトと結果を保存する。実ローダーはIdle/Lungeを手続き生成で置換するため、GLB単体と実Rendererの両方を確認する。旧ログは旧候補の記録と明記し、現行の説明・検証と分離する。実ゲーム表示の比較画像・短い動作動画を監査ZIPに含め、同じ監査Chatで再監査する。

## 独立に確認できたこと

GitHubの完全差分一覧では、変更はclient 5ファイル、素材・生成器・文書等に限定され、`src/shared`・`server` の変更や既存ファイルの削除はない。VOLLEY用の採用GLBと旧LEAPER v2を変更・削除する差分もない。

`hound-motion.ts` はLEAPERのURLだけをv3へ変更し、LEAPERの必要クリップに `Leap` を追加している。`render.ts` の追加はspiderの正の `jump` から `min(1, jump / 0.9)` を渡す読取り処理。`structure-motion.ts` はspiderかつ `leap !== undefined` のときだけLeapを選択する。待機・予備動作の差分はLEAPER専用分岐を追加し、従来のhound分岐の処理本体を残している。

### ソース照合付きの隔離コントローラ検査

取得した `structure-motion.ts` の全内容をGit blob SHAで照合してからTypeScriptを変換し、コントローラだけを実行した。

- base blob: `8f5095fe865e2669d83bf1f3049707e1ba673581`
- head blob: `74d4e856af7fa28a486bb6d7cf134e124275e91d`
- Node.js `v22.16.0`、TypeScript `5.8.3`
- ant / spider / crawler / spitter / hornet / boss 各1,200フレーム、計7,200フレーム・41,751個体入力の合成列で、変更前後のsetPose引数と内部状態が一致。spiderの互換比較ではleapを未指定、他種では一部にleapを渡して無視されることも確認した。
- 追加6検査が成功：進行度101点で `time = leap * 0.9`、pause、着地後Idle/Locomotion、着地後wind-up、複数個体と除去、VOLLEYのleap無視と攻撃時刻。
- 入力をfreezeし、入力不変を確認した。

**限界：合成入力、ローカルのclamp相当処理、記録用setPoseを使った隔離検査である。Three.js描画・実GLB・実ゲームの跳躍・通信・Vitest・プロジェクト型チェック・buildの再実行ではない。HARROW/CALYXはこの実行検査の対象外。**

## 既知の制約の判断

- 協力参加者：今回の差分に通信変更はない。`leap` 未指定時のコントローラ互換性は上記で確認した。ただし実サーバーと2クライアントの通信・見た目は未検証。「参加者にも新Leapが表示される」とは記録しない。制約を解消するための無断の通信変更もしない。
- 胸の発光器官：生成器上の名称やコメントだけでは、目に見えるか・頭のない造形として読めるかを判定できない。最終実物の画像・動画を未取得のため保留。規約違反とも合格とも断定しない。
- スマホFPS・発熱：未測定。数値を推測して合格にしない。実Rendererの継続再生、遷移、群れ表示と実機性能は別々の確認項目とする。
- 共通素材：v2由来との記録は読んだが、9枚のPNGとv2の対応画像の実バイト比較は未実施。
- 再生成：生成器の読取り先・出力先・検証内容を静的に確認したが、Blender 5.2の再実行は未実施。

## 文書の整合修正が必要な点

`DESIGN.md` の「骨格・動き・材質はそのまま、形だけ」「src/ と server/ のコードは一切変更していない」「クリップ3種」、初期候補LEAPERの `c1931f86…40ac` は、最新状態の説明と混在している。初期候補の履歴として区別し、現行はclient変更あり・4クリップ・最新素材対応を記す。記録修正で検証実行済みに見せないこと。

## 再開条件と残作業

1. 元の `game/` を変更せず、`swarm-front-review` または許可された別worktreeで実Git・未コミット状態・本記録以後のSHAを確認する。
2. F1の最終証拠を生成し、v2テクスチャ9枚のバイト比較、再生成、型・関連テスト・client buildを実施する。既存失敗を比較する際は現在のbaseを記録し、旧 `7825437` の結果を現在mainの再検証と混同しない。
3. 規定のiab通常Chatへ対象SHA付きZIPを添付し、最終実物を含む監査と、必要修正後の同じChatでの再監査を完了する。本記録を監査合格の代わりにしない。
4. 最新mainとの差分、必要CI・保護、監査対象一致を確認後だけ通常mergeする。merge本文に具体的な日本語 `Player-Note` を保持する。
5. merge後mainからproduction build、既存 `wrangler.production.jsonc` のdry-run、既存Workerへの公開、Version・health・配信SHA・実ブラウザを確認する。
6. 公開後にSTATE先頭をmerge SHA・公開ソースSHA・Worker Version・配信確認で更新し記録をmainへ反映する。

本ChatではSTATEの既存本文を置換していない。停止記録は本書とPRコメントに保存し、再開するworktreeでSTATE先頭から本書を参照すること。新規サービス・課金・権限変更・削除・force-pushは行っていない。
