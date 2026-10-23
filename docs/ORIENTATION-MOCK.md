# 縦横プレイの分離モック

2026-10-23。本人承認の「本編から分離し、スマホで手触りを確認する」仕様。ローカル実装・自己検証を完了。専用HTTPS配信は契約確認待ち。

- 基準: main `7cf9f0ebbefd2cdf361a90623efa10a6e26ab19a`。
- 専用branch: `codex/orientation-mock-20261023`。
- Android Chromeで全画面と実操作を確認する、専用HTTPSの試遊モック。
- 本番mainへの統合・本番Workerへの公開は対象外。
- GitHub: https://github.com/futsalife24-bot/swarm-front/tree/codex/orientation-mock-20261023
- 作業場所: `C:/Users/futsa/.codex/worktrees/orientation-mock/swarm-rebuild-p1a`。元worktreeの未コミット作業は保持。

## 試せる内容

画面一覧から40項目へ移動できる。タイトル、開始、名前入力、モード、作戦、装備と整理・詳細、基地、デッキ、兵士、装飾、武器庫、工房、ルーム、ロビー、チャット、招待、強化選択・一覧、ポーズ、退出、復帰、リザルト、週次、保存失敗・復旧・クラウド、図鑑、声、会敵映像、PV、チュートリアル、更新履歴、設定、配置編集、実射撃場・小規模戦・大型戦・密集戦。

- 移動・エイム・射撃・スコープ・装填・回避・ジャンプ・武器切替は既存Controls、ゲーム計算、Renderer、モデルを利用する。装備で選んだ武器を次の出撃へ渡す。
- 協力・招待・クラウド・報酬・復旧はデモ表示。密集戦の4人HP・XP・強化一覧も表示評価用で、オンライン通信や本編報酬の獲得はない。
- 設定は自動／縦固定／横固定。固定がブラウザで利用できなければ、現在の実画面に合わせて遊べるままOSの回転設定を案内する。全画面は本人のボタン操作から要求する。
- 縦は下部に移動・アクションを配置し、横は既存配置を基準にする。回転時は古いタッチ・capture・待機入力を解除し、視点・戦闘世界・進行・明示的なポーズを保持する。
- 横は縦画角65度、縦は短辺画角65度。スコープの倍率比を維持する。照準は実キャンバス中央に揃える。
- 縦横の配置・サイズ・濃さ・スコープ2を別保存。回転しても両方の編集中の内容を保持し、「この向きを保存」は現在側だけ保存する。重なり・安全領域外等の無効配置では保存／試し撃ちを無効にする。試し撃ち後は元の世界・位置・敵HP・弾数・時間へ戻す。
- 武器行は30px、ロック28px、共通見出し20pxを維持。狭幅は武器名・ロックを固定して能力列を横スクロールし、844px以上では不要な横スクロールを出さない。

## 分離の仕組み

入口は `orientation-mock.html`、実装は `src/client/orientation-mock/`、ビルドは `vite.orientation-mock.config.ts`。通常bootstrap・アプリ本体・analytics・cloud・app-installを依存グラフで拒否する。

保存キーは `swarm-front-orientation-mock-v1:` 内だけ。本編キーの読取・書込・削除・一括消去を行わない。SW・manifest・実API・WebSocket・外部接続を組み込まない。専用Workerは静的配信のみ、DO/KV/D1等のbindingなし。配信時は外部script/frame/workerを許さないCSPとnoindexを設定する。

素材は `scripts/orientation-mock-assets.json` の311ファイルを明示許可し、`public/.assetsignore` の未公開素材6件を拒否する。合計519,058,693 bytesは配布物全体であり、初回通信量ではない。既存モデル・音声・映像を含む。初回転送量と実機のロード時間は未計測。

本編共有部分の変更は任意引数だけの入力解除・viewport/FOV差し込みと、モック時だけのメニュー演出保存キー分離。通常アプリ側の既定動作を維持し、通常ビルドを確認した。本編への統合は別タスク。

## 再現手順

```powershell
npm ci
npm run typecheck
npm run test:orientation-mock
npm run build:orientation-mock
npm run test:orientation-mock:e2e
npm run preview:orientation-mock
```

検証はインストール済みChromeを使う。最後のコマンドで `http://127.0.0.1:5197/` を開く。`#battle-training`、`#battle-boss`、`#battle-dense`、`#layout` へ直接移動できる。ローカルURLはこのPC内の確認用で、スマホ配信URLではない。

## 検証結果

- client/worker型検査、専用単体32件、モックビルド150 modules、通常productionビルド219 modulesを通過。
- Chromeの携帯表示によるE2E6件を通過。大型敵の初期位置・視点を最終調整後、影響する戦闘表示テストを再実行し通過。
- 36メニュー系画面を縦→横→320px縦で巡回。3点タッチの移動・視点・射撃と敵HP減少、90度／180度の入力解除、スコープ解除、ポーズ保持を確認。
- 320×568、390×844、640×280、844×390で操作領域44px以上・画面内・中央hit-test・HUD非重複を確認。武器一覧は320、390、640、844pxの通常／整理を確認。キーボード高さだけの変化と、合成safe areaも確認。
- 全6シナリオで禁止通信の**試行**ゼロ、WebSocket生成ゼロ、SW登録ゼロ、Cache Storageゼロ、本編Storageアクセスゼロ、sentinel保持、ページ例外／HTTP失敗ゼロを判定。拒否された通信をアプリが握り潰してもテストは失敗する。
- 配置編集で縦横のdraft保持・片側だけ保存・試し撃ち後の戦闘状態の完全復帰を確認。
- 専用Worker dry-run: 346配布ファイル、No bindings。公開処理は未実施。
- 既存aim/renderの関連試験は46通過・2失敗。失敗2件（aimのrocket距離1.25期待/1.875、renderの弾位置−7.5期待/−6）は基準SHAの独立抽出でも同じ。今回の回帰と混同せず、既存テストは変更していない。
- chunkサイズ警告が残る。publicDirを無効にしたためフォント／タイトル背景のビルド時解決警告が出るが、許可リスト経由の実HTTP取得を確認済み。

証拠は [検証記録](evidence/orientation-mock-20261023/README.md) を参照。Windows Chromeでの検証であり、Android実機・物理ジャイロ・実キーボード・native画面固定・連続プレイの速度や発熱を検証済みとは扱わない。

## 批判レビュー

本人依頼によりAstraの読み取り担当を利用。未公開素材の混入、試し撃ちによる元戦闘の消失、無効配置の黙示fallback、密集HUDと選択武器の不足、禁止API試行の検証漏れを修正。最後の通信指摘は再レビューで解消を確認し、証拠フォルダーの初回作成順も修正した。これはCodexサブエージェントのレビューで、通常Chatの独立監査ではない。

子の呼出し指定は `gpt-6-astra` / `xhigh`（メニュー実装・批判レビュー）。主担当の実モデル／推論設定は取得不可のため未確認。

## 専用HTTPS配信の残条件

配信先は承認済みの新規 `swarm-front-orientation-mock`。本番 `swarm-front` の現在のVersionは `57f36bd8-d3d9-4df9-9590-4b54fa593e96`（2026-10-23読取）。本番のmain反映・Worker更新は対象外。

今回CLIの保存済みOAuthは利用可能。一方、契約APIは403、接続できるDashboardはログアウト状態。`account-settings.standard` をFree契約の証明には使わない。[無料運用の条件](FREE-TIER.md) が求める現在の契約確認と、以前の新規ログイン禁止が残るため、専用配信を保留している。未公開なのでHTTPS URLは未発行。

静的Assetsのリクエスト・保管は公式上追加料金なしで、今回の設定に実行WorkerやDBはない。ただし既存契約確認を省略する根拠にはしない。[Cloudflare公式料金](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

再開は既存Cloudflareアカウントへのログイン許可とFree契約確認後。新規契約・有料化・権限追加は行わない。次を専用branchのcleanな実装から実施する。

```powershell
npm run build:orientation-mock
npx wrangler deploy --dry-run --config wrangler.orientation-mock.jsonc --outdir dist-mock-worker
npx wrangler deploy --config wrangler.orientation-mock.jsonc
node scripts/check-orientation-mock-delivery.mjs <デプロイ結果の専用HTTPS URL>
```

公開後にHTML/JS/CSS/主要素材のSHA、CSP/noindex、API/SW/manifestの404、POST非対応を照合し、公開版の縦横操作と本番Version不変を確認する。URLをAndroid Chromeで開き、全画面→射撃場→3点操作→端末回転→配置編集→大型／密集戦の順に本人の手触りを評価する。
