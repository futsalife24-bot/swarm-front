# HARROW制作状況

2026-10-12。ゴール設定済み。全8候補FBX取得・Blender読込検証済み。置換・監査・公開は未完了。

## 保存済み

- 本人元画像: `references/user-design.jpg`。頭/体4方向ずつのRGBA PNG: `images/`。全8枚1254×1254。実プロンプト: `images-config.json`。image_gen内蔵経路を使用。
- 頭側面の初稿は斜めが強く、1回修正。胴体正面は端の余白を修正。胴体側面は斜めと翼の短縮に残差があり、厳密な整合済み正投影とは扱わない。3D候補の構造検証が必要。
- Charakuru 1.0.2正本: `C:/Users/futsa/Documents/Codex/2026-10-07/https-x-com-dstudio-ai-status/tools/charakuru-1.0.2/charakuru-1.0.2-2026-10-07T16-58-19-992Z/projects/d8761f86-439a-406e-b0dc-d3d08c1b6703/project.charakit`。
- プロジェクト名 `Swarm Front HARROW 20261011`。images依頼 `c7c6391b-8b53-40a2-9740-47800f35ed84` をbegin、saved:true確認後、update-imagesで8枚/実プロンプト登録、complete済み。revision 5、SHA256 `a01b40c3e3e633d6ac39c7ff405a38ea40f8dded1fe7aebb55d009ce7b43ec0c`。
- アプリ `http://127.0.0.1:8767/`。Start-Charakuru.ps1で起動。既存兵士の保存データは更新していない。
- 現行ゲームとの実装契約は `INTEGRATION-CONTRACT.md`。公開v10 GLBとゲームコードは未変更。

## Tripo候補

既存ログイン済みChromeを使用。Smart Mesh P2.0、四角形、25000指定、4候補ずつ、非公開設定。生成面数は指定値と厳密一致しない。頭100＋体100＝200クレジット消費、画面残高3100→2900。追加購入・契約変更なし。全8候補がアセット一覧に存在。以下は候補生成時点の記録。現在は下記の採用・分割工程へ進んでいる。

| 部位 | Tripo ID |
|---|---|
| 頭 | `27256128-cec0-4f90-abe5-678a69261eac` |
| 頭 | `4b05c79e-d7bf-4e23-b247-e0c18a18b846` |
| 頭 | `faa0e7ab-6df1-4d55-a1a4-c19fd2b58372` |
| 頭 | `809ac48d-3e21-4c7a-8645-f7d9a82e97ab` |
| 体 | `040554d6-0376-4970-b56a-55441df6a567` |
| 体 | `d62f7831-6934-4040-bb19-6f613e52e261` |
| 体 | `6195770f-7fac-4e1f-8d2e-9bb1414a30a7` |
| 体 | `6708256b-38d1-4e6f-8dee-973c5e8be1fa` |

各URLは `https://studio.tripo3d.ai/ja/workspace/generate/<ID>`。
頭4b05c79eは画面29501面/26484頂点。体d62f7831は26990面/24915頂点。体040554d6は29247面/26111頂点。頭正面および体2候補の正面、040554d6の回転表示で翼・尾の立体を確認。後続の実FBX・三方向比較はreview/REVIEW.md参照。接地・モーション品質は未確認。

## 保存確認の解消（2026-10-12）

本人の再指示を受け通常のTripoエクスポートを実施。downloadイベントは45秒でタイムアウトしたが、保存された.tmpを調べるとFBX Binary 7400だった。Blender 5.2.1 LTSで全8件を正常インポートし、各1mesh・正の頂点/面数を確認してからmodels/head・models/bodyへコピー保存。拡張子のみを根拠に前回停止した判断は早すぎた。Chrome内部画面や認証情報へアクセスせず、セキュリティ設定変更・警告回避なし。追加クレジット消費0。

`download-manifest.json`に8件のID・相対パス・サイズ・SHA256、各inspection.jsonに読込結果を保存。頭4b05c79eは26484頂点/29501面で表示と一致。胴040554d6は26110頂点/29247面（UI頂点数26111との差1は未解明、面数一致）。形式と読込検査は造形品質の採用判定ではない。Blender拡張キャッシュへの書込拒否は出たがFBX importと検査JSON出力は成功。保存障害は解消、本人の手動保存は不要。旧goalステータスblockedは未再開。以降はCharakuru候補登録・実物比較から。
## 前回の保存確認待ち（解消済みの経緯）

頭4b05c79eをFBX/Blender設定、ファイル名 `harrow-head-4b05c79e` で1回エクスポート。downloadイベントは20秒でタイムアウト。Downloadsには同時刻の `69c92b71-f0c0-4fd0-a8a6-d68506ebbbfc.tmp` (1,186,384 bytes) が残り、正式FBXは未確認。未完の一時ファイルをFBXへ改名して完成扱いにはしていない。

Chrome内部ダウンロードページの確認はブラウザURLポリシーにより拒否（http/https以外不可）。別操作経路による内部画面への迂回なし。Tripoのエクスポート拒否自体は未確認で、OS保存ダイアログの可能性がある。本人へ「保存ダイアログがあれば通常Downloadsへharrow-head-4b05c79e.fbxを保存、なければその旨」を質問済み。

再開: 正式FBXの保存完了/入力状況を確認し、同じ候補から取得を継続。生成をやり直さない。4候補ずつを取得・実物比較し、Charakuruへ候補登録→採用→材質/専用リグ/12モーション→発射/接地検査→ゲーム組込み→独立Chat監査→main/既存Worker公開。

## 作業場所と設定

GitHub: https://github.com/futsalife24-bot/swarm-front 。ローカル: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。branch `codex/harrow-charakuru-20261011`、base `85ed091cb5642036790bf0aedc8fc369386d7430`。mainは別worktree使用中のため移動していない。
主担当の実モデルID/推論設定は未確認。契約調査補助のみ `gpt-6-sol` / `medium` 指定。今回ゲームコード変更なし、ゲームテスト/ビルド/監査/公開未実施。

## 再発防止と候補登録の再開（2026-10-12）

本人の厳格ルール化・goal再開指示で、使用中Charakuru Skillの停止判断を修正。docs/skills/HARROW-DOWNLOAD-RECOVERY.mdがGit保管版、HARROW-DOWNLOAD-RULE-CHANGE.jsonに変更前後SHA。実ファイル検査、対象照合、コピー前後ハッシュを必須化。全8件で保存元と制作先SHA一致を追加確認。Knowledge/mistakes.mdへ訂正内容を記録。Hook/セキュリティ条件の変更なし。

Charakuruを既存起動スクリプトで再起動し、candidates依頼28b66a2e-b266-4327-9f7b-c1cbdabc6072をbegin(saved:true)→既存8FBX登録→complete。正本SHA256 060c04d5088646474cd23294f7b9557341530e5da3bb82de6ed6e231ac20e4a9。アプリの頭/体各4候補と未決定表示、頭候補1の実表示を確認。追加生成・消費0。次は候補比較・採用から継続。

goalはget_goalでblockedのまま。利用可能な公開ツールにはactiveへの再開操作がなく、本人へ画面側の再開だけ依頼した。依頼全体を完了に偽装したり内部DBを変更せず、制作自体は上記の通り再開済み。主担当実モデル/推論設定未確認、今回子不使用。

## 採用と分割工程（2026-10-12 06:22 JST）

アプリとBlender三方向レンダーで8候補を比較し、頭4b05c79e・体040554d6を修整ベースに採用。本人の全工程自走依頼に基づく選定。review/REVIEW.mdに比較証拠。胴は余分なすね突起2成分、肩ミサイル6本×左右から5本×左右への修整、小腕指・羽板の明瞭化が必要。無修整完成扱いはしない。

materials依頼5a42f243-1852-474b-97de-b751d145d395をbegin(saved:true)。export-segmentation.pyで頭・体GLBを書き出し、Tripo再アップロード時にY=90°を実プレビューで確認。頭asset bf09da05-03ee-429d-9387-6c8439b4bf93の粗分割が完了。104mesh/51637面のFBXを取得、Blender終了0・面数一致・コピー前後SHA一致。models/segmented/head-provenance.jsonへ記録。頂点数UI27806/Blender26747の差は追加調査中。

胴asset759def0a-e412-472f-8137-cec6c5304e6dの粗分割を実行中。頭40＋体40クレジットを消費し残高2820（候補生成から累計280）。購入・契約変更なし。正本materialsセッションは継続中、complete未実行。ゲームモデル・ゲームコード・公開版は未変更。

06:32追記: 胴分割FBX214mesh/49073面取得成功。頭・胴ともアップロードGLBに対する最近傍頂点対応で全三角形一致、追加/欠落0（review/segmentation-*-report.md）。UI頂点集計差の原因は未確定。segmented→analyze→classify→prepare→references成功。頭104成分/胴214成分を2枚の4K用グループに分類。非人型機械のためCharakuruの髪/衣装向けspringGroupsは空、翼・尾は専用骨格で動かす。新規塗り参照4枚のPNG実アルファ・実プロンプトを保存。頭材質用アセットb1580706-d62c-4705-adce-7430f9ca8b94、UI Y90補正を確認しSmart UV20クレジット実行中（残2800、累計300）。

06:37追記: 頭Smart UV占有率73.9%、胴71.2%で保存完了。胴材質用asset7c6297cd-2e6e-4878-a186-871be640ae85。頭は正面/背面参照・4K・Remove Lighting OFFで20クレジット生成開始。UV頭胴40、頭材質20が追加、累計340クレジット（他タブ残高には遅延あり）。候補や分割の再生成はしていない。

## 材質取得と組み立て完了（2026-10-12）

頭b1580706・胴7c6297cdのSmart UVと4K材質生成完了。累計360クレジット、残2740。材質付き書出し.tmpはZIPで、CRC・安全な相対パス・FBX Binary・4096×4096 JPEGを検査しmodels/texturedへ展開。元tmp保持、全エントリSHA一致。unpack_texture_download.pyが再現検査器。頭ZIPを最初にFBXとして読みInvalid headerとなったが、magicを調べZIPと判別して正常取得。ダウンロード失敗や本人作業待ちにはしていない。

returns登録後、assembleの厳密座標許容値で頭1.67744e-5>1.61556e-5が検出された。検査コード・閾値は変更せず、共有基準GLBを使い全面/全コーナーの一意対応をassertした座標復元派生FBXをmodels/normalized-returnsへ保存。最大補正量頭1.6652e-5・胴2.5443e-5。書出し後のUV差0、元4K画像SHA維持。未変更production.restore_uvの最大誤差頭6.144e-8・胴8.429e-8で合格。review/normalization-report.md参照。

normalized-returns→assemble成功、materials依頼5a42f243-1852-474b-97de-b751d145d395 complete成功。Charakuru正本SHA256 cb8db831467760def42c999138c1afff87964125b0befd4f28870816ff9b6065。外部正本と元生成物を保持。ゲーム用build_candidate.pyは別候補Blendで形状修整・39骨を作成し、animation_contract.pyは専用12動作を生成する。現時点では候補レンダー中、動作実検証・ゲーム置換・監査・公開未完。
