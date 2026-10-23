# 縦横プレイの分離モック

2026-10-23。本人承認の「本編から分離し、スマホで手触りを確認する」仕様。実装・自己検証・専用HTTPS配信と照合を完了。2026-10-24にClaude Codeの独立監査と修正（[下記](#claude-code独立監査と修正2026-10-24)）。修正版は未公開で、本人の実スマホでの手触り確認待ち。

試遊URL: https://swarm-front-orientation-mock.melosalife-24.workers.dev/

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
- 専用Worker dry-run: 346配布ファイル、No bindings。実装commitから再ビルドし、専用Workerへ公開済み。
- 既存aim/renderの関連試験は46通過・2失敗。失敗2件（aimのrocket距離1.25期待/1.875、renderの弾位置−7.5期待/−6）は基準SHAの独立抽出でも同じ。今回の回帰と混同せず、既存テストは変更していない。
- chunkサイズ警告が残る。publicDirを無効にしたためフォント／タイトル背景のビルド時解決警告が出るが、許可リスト経由の実HTTP取得を確認済み。

証拠は [検証記録](evidence/orientation-mock-20261023/README.md) を参照。Windows Chromeでの検証であり、Android実機・物理ジャイロ・実キーボード・native画面固定・連続プレイの速度や発熱を検証済みとは扱わない。

## 批判レビュー

本人依頼によりAstraの読み取り担当を利用。未公開素材の混入、試し撃ちによる元戦闘の消失、無効配置の黙示fallback、密集HUDと選択武器の不足、禁止API試行の検証漏れを修正。最後の通信指摘は再レビューで解消を確認し、証拠フォルダーの初回作成順も修正した。これはCodexサブエージェントのレビューで、通常Chatの独立監査ではない。

子の呼出し指定は `gpt-6-astra` / `xhigh`（メニュー実装・批判レビュー）。主担当の実モデル／推論設定は取得不可のため未確認。

## 専用HTTPS配信の結果

配信先は承認済みの新規 `swarm-front-orientation-mock`。公開ソース `0a1437f0e31593e4c7276ee614162b9f73a484ff`、専用Worker Version `32ec0642-3411-417b-a02d-cf539e0861c2`。本番 `swarm-front` のVersionは公開前後とも `57f36bd8-d3d9-4df9-9590-4b54fa593e96` のまま100%。本番main反映・Worker更新は行っていない。

本人の「許可する」で既存Cloudflareへのログイン承認を受領。端末へのメール／ログイン方法保存をオフにして既存Googleアカウントからログインし、Workers plansの **Free・$0・Current plan** を画面で確認。当日アカウント使用量180/100,000 requests。契約API403や `account-settings.standard` をFreeの根拠には使っていない。CLI OAuthは途中で期限切れになったが、通常のWranglerによる既存認証の更新で復旧した。新規契約・有料化・権限追加はなし。

静的Assetsのリクエスト・保管は公式上追加料金なしで、今回の設定に実行WorkerやDBはない。ただし既存契約確認を省略する根拠にはしない。[Cloudflare公式料金](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

公開時のコマンドは以下。今後の再配信では、対象実装と既存契約条件を確認して専用設定だけを使う。

```powershell
npm run build:orientation-mock
npx wrangler deploy --dry-run --config wrangler.orientation-mock.jsonc --outdir dist-mock-worker
npx wrangler deploy --config wrangler.orientation-mock.jsonc
node scripts/check-orientation-mock-delivery.mjs <デプロイ結果の専用HTTPS URL>
node scripts/check-orientation-mock-live.mjs <デプロイ結果の専用HTTPS URL>
```

公開後の配信検査12項目が成功。HTML/JS/CSS/アイコン/背景/フォントの6ファイルSHA一致、CSP/noindex、API2経路・SW・manifest・本編入口の404、POST405を確認。新しいChrome環境で公開版のメニュー→実射撃による敵HP減少→横回転による入力解除とrun保持→縦配置保存→HARROWモデル表示が成功し、ページ例外・HTTP失敗・禁止通信・WebSocket各0、SW/Cache各0、保存キーはモック専用のみ。

証拠: `delivery-live.json`、`live.json`、`release.json`、`account-confirmed.json` と公開版画像を [検証記録](evidence/orientation-mock-20261023/README.md) に保存。今回の配信後追加コードは公開照合スクリプトだけで、配信物のゲーム実装は上記SHAのまま。

次はURLをAndroid Chromeで開き、全画面→射撃場→3点操作→端末回転→配置編集→大型／密集戦の順に本人の手触りを評価する。Android実機の合格をこの公開検証から推測しない。

## Claude Code独立監査と修正（2026-10-24）

本人指定のClaude Codeによる監査。対象 `e9a8ac4a6ae719652b46b91fba9182ca75f4b8b2`（公開中のゲーム実装 `0a1437f`）。修正branch `claude/orientation-mock-audit-20261024`、作業場所 `C:/Users/futsa/.codex/worktrees/orientation-mock-audit/swarm-rebuild-p1a`。先行の説明・テスト成功は結論に使わず、実コードとWindows Chrome（携帯表示・タッチ）で再現した。証拠は [監査証拠](evidence/orientation-mock-audit-20261024/README.md)。

### 初回監査で再現した問題と修正（重要度順）

1. 横915×412などのスマホ横画面で、配置編集パネルが「スコープ」「切替」を完全に覆い、位置をドラッグできない。縮小パネルが高さ400px以下だけだった。→ 高さ500px以下の横は縮小パネル、配置ボタン層をパネルより前面に。縦の一時停止ボタンが上部バーに一部隠れる件は、編集中だけ上部バーを隠し「全画面」を編集ツールバーへ移した。
2. 射撃場から試し撃ち、または射撃場の再出撃で、新しい世界の最初の射撃・命中が描画と効果音を通らず破棄される。訓練世界のrunが常に `training` で、描画・音声の処理済み番号が引き継がれていた。実測は元の射撃場70件後の試し撃ちで発生22件・処理済み70件。→ 戦闘世界ごとに固有のrun。
3. 敗北しても結果画面が「作戦完了」、撃破128（固定のデモ値）。無操作では小規模・大型・密集戦とも約10秒（ゲーム内時間）で敗北し、この画面に着く。→ 実戦闘の終了時は勝敗・戦場・時間・撃破数を実値で表示し、功績・コイン・戦利品はデモと明記。
4. 自動の向き設定が、全画面時に `lock("any")` を要求していた。Android ChromeではOSの回転ロックを無視する全センサー固定にあたり、「端末の回転設定に従います」の案内と食い違うおそれ（コード上の不一致。Android実機では未確認）。→ 自動は `unlock()` だけ。古い横固定が後から成功した場合も再度解除する。
5. 配置編集で未編集のまま回転して戻ると「保存せず戻りますか」が出る。もう片方の標準配置を現在の画面寸法で計算し直して比べていた。→ draftを作った時点の保存値と比べる。
6. PVが画面一覧からしか開けない（本編は設定の「PVを見る」）。→ 設定に「PVを見る」を追加し、戻ると設定へ。
7. 一時停止・結果へ移るとき戦闘音声の停止をフレーム処理に任せており、非表示後も兵士・敵の声が残り得る。→ 非表示時に戦闘音声を止める。
8. 強化3択のデモ期限が一度切れると、以後は開くたびに0秒のまま。→ 期限切れ後に開いたら新しいデモ期限。

### 確認して問題がなかった点

- 3点タッチ中の90度／180度回転で、タッチ・射撃・待機入力は0になり、run・視点・スコープ解除・明示的なポーズを保持（既存E2Eの再実行）。
- 全9シナリオで本編保存・外部通信・WebSocket・SW・Cacheの試行0。依存グラフ内の既定 `localStorage` 引数は、モックが渡す専用保存経由でだけ呼ばれる。
- 横は縦画角65度、縦は短辺65度（390×844で縦画角108.1度）、スコープ倍率比を維持。
- 画面往復（図鑑20回、大型／密集戦8回）でヒープは増えず、WebGL canvasは2枚のまま。
- 共通変更（input／render／menu-effects）は引数省略時に従来の経路。通常productionビルド219 modulesが成功。通常bundleにはモック保存キーの文字列が残るが、実行時は本編キーを使う。
- ピンチ拡大と引っ張り更新は、既存CSS（`touch-action: pan-x pan-y`、`overscroll-behavior: none`）で抑止。

### ロード量（公開版 `0a1437f`、Windows Chrome・PC回線）

- タイトル: 68件・5.42MB（WAV 3.94MB、タイトルロゴ0.99MB、JS 0.45MB）。表示まで約2〜3秒。
- 射撃場の開始: 12件・41.4MB（兵士15.3MB、HARROW 14.2MBなど、射撃場で使わない敵を含む全敵モデル）。
- 大型戦: 4件・17.0MB（街区マップ14.6MBなど）。続く密集戦は追加取得なし。
- Android実機の回線速度・発熱・ロード時間は未計測。

### 本人の判断が必要な提案（未変更）

- 大型戦・密集戦は通常導線から入れず、画面一覧だけ。案: モード「生存」の出撃は密集戦、作戦選択でHARROWの作戦なら大型戦。
- 無操作約10秒で敗北する。手触り評価用に、モック限定の被ダメージ軽減または無敵切替を加えるか。
- 初回通信: 効果音・声の先読み（3.9MB）を最初の戦闘まで遅らせる、射撃場で使わない敵モデルを読まない。本編と同じ読込み方から外れるため要判断。
- Androidの戻る操作でモック自体を離れる（本編も履歴を使わない）。戻る操作を一時停止・前の画面にするか。
- 縦は短辺65度のため、画面の上下に空と地面が多く、自分の兵士が大きく映る。照準の高さや縦のカメラ位置の調整は仕様変更になる。

### 自己検証（修正後）

型検査、専用単体34件（追加2件）、モックbuild、E2E9件（追加3件: 配置編集の到達性と未保存判定、試し撃ちのイベント描画と復帰、敗北表示とPV導線）、通常production build、専用Worker dry-run（346ファイル・bindingなし）。aim／renderの既知2失敗（rocket距離1.25期待／1.875、弾位置−7.5期待／−6）は、基準 `7cf9f0e` の一時worktreeでも同値で再現し、今回の回帰ではない。既存テストは緩めていない。

### 公開

修正版は未公開。Wrangler CLIの認証が期限切れで、非対話では `wrangler login` できない。無料契約確認も前回と同じくDashboardへのログインに本人の許可が必要。公開URLは旧版 `0a1437f` / Version `32ec0642-3411-417b-a02d-cf539e0861c2` のまま。本番Workerには触れていない（今回はVersionを照会できていない）。

再開条件: 本人がCloudflareへのログイン（CLIの `wrangler login` とDashboardでのFree確認）を許可すること。手順は上記「専用HTTPS配信の結果」のコマンドを修正branchのHEADで実行し、配信SHA・公開画面・本番Version不変を照合する。
