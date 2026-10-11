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

既存ログイン済みChromeを使用。Smart Mesh P2.0、四角形、25000指定、4候補ずつ、非公開設定。生成面数は指定値と厳密一致しない。頭100＋体100＝200クレジット消費、画面残高3100→2900。追加購入・契約変更なし。全8候補がアセット一覧に存在。候補採用、色付け、セグメンテーション、リグは未実施。

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
頭4b05c79eは画面29501面/26484頂点。体d62f7831は26990面/24915頂点。体040554d6は29247面/26111頂点。頭正面および体2候補の正面、040554d6の回転表示で翼・尾の立体を確認。全候補の実FBX/裏面/細い前肢/接地/モーション品質は未確認。

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
