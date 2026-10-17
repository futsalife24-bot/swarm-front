# BASTION（仮称）ローカル候補 — 別セッションによる独立レビュー

2026-10-17。**このレビューは、実装担当とは別の Claude Code セッション（AI）が行ったコードレビューです。人間の第三者監査でも、AGENTS.md / `docs/skills/swarm-front-audit-release/SKILL.md` にある通常Chatでの独立監査でもありません。** 実装担当の会話・判断には触れず、リポジトリ上のコード・文書・証拠ファイルと、自分で実行した検証だけを根拠にしています。

## 判定

**条件付き合格（P0・P1なし／P2が1件）**。戦闘ルール・同期・予告と実弾の一致は、コードと実行の両方で仕様どおりと確認した。P2の1件（GLBの常時読込）は、自然出現へ登録しないまま main へ入れる場合に直すべき項目。ローカル候補のまま本人の判断を待つ現状なら、作業を止める理由にはならない。見た目と数値の承認は本人の判断事項なので、このレビューの対象外。

## 対象

| 項目 | 値 |
|---|---|
| worktree | `C:/Users/futsa/Documents/Codex/2026-10-16/swarm-bastion` |
| branch | `codex/bastion-hardening-20261016`（レビュー時の HEAD `806d0032e6f74e6798e70841a0382392fe4eafe1`） |
| base | `da41b38774b22a8aac4ce7ec8d2bcd18de6fb008` |
| 実装 commit | `4a75d3a0dc175e8aa687dd7477b204c76916e00b`（差分 `git diff da41b38 4a75d3a`、74ファイル） |
| 記録 commit | `806d003`（STATE・監査資料。コードの変更なし） |

表記: **［確認］**＝実行またはコードの読取りで確かめたこと。**［推測］**＝コードから推した影響で、実際には再現していないこと。

---

## 必須指摘

### P0 / P1

なし。

### P2-1 GLB（約1.55MB）を出現の有無に関係なく全クライアントが読み込む

- 箇所: `src/client/render.ts:272`（`readonly bastion = new BastionView();`）、`src/client/bastion-view.ts:138-165`（コンストラクタで `GLTFLoader().loadAsync` を即時開始）
- 再現条件: Renderer を作る通常の起動（ソロ・協力・前線作戦のどれでも）。
- 期待: BASTION は自然出現・前線作戦・FOUNDRY ZERO の生成リストに入っていない（`docs/BASTION.md` の「出現」）。現時点の本番では出ない敵の素材は、ダウンロードしない。
- 実際［確認：コード］: `Renderer` のフィールド初期化で `BastionView` が作られ、その場で `assets/enemies/bastion_v1.glb`（1,554,584 bytes）の取得が始まる。今の main に入れると、出現しない敵のために全プレイヤーが約1.55MBを毎回（キャッシュ切れのたびに）取得する。スマホ回線と、Free 枠を前提にした配信（`docs/FREE-TIER.md`）の両方に不要な負荷になる。既存の構造体GLB（`STRUCTURE_ASSETS`）も先読みだが、そちらは実際に出現する敵。
- 修正案: 最初に `kind === "bastion"` の敵を受け取った時点で読み込みを始める（読込前・失敗時の簡易形状と危険帯の表示は今の作りのまま使える）。または自然出現へ登録する時まで main へ入れない。

---

## 任意指摘（P3）

| # | 箇所 | 内容 | 根拠 |
|---|---|---|---|
| P3-1 | `docs/BASTION.md:40`、`tests/bastion.test.ts:92` | 「0→75 に最短0.8秒」は実際と合わない。毎tick被弾させると、最初の被弾から 25:0.35秒、50:0.65秒、**75:0.95秒**、100:1.25秒（0.1秒に+8なので、75 に届くには10回の加算が要る）。テストは「0.8秒以上」しか見ないので通る。仕様の上限は守られているので、文書とテスト名の数値だけ直せばよい。 | ［確認：独自再現(a)］ |
| P3-2 | `docs/BASTION.md:55` | 「実Workerで2人射撃の 0→100 が1.3秒」とあるが、`network.json` の `armorSeries` では1.3秒時点は80（75以上）で、100 に達するのは1.7秒。`AUDIT-PACKAGE.md` の「1.3秒に75以上」が正しい。私の再実行では `hardenedAt` は1.4秒（送信の間隔による揺れ）。 | ［確認：network.json・再実行］ |
| P3-3 | `src/shared/bastion.ts:129-134` | 軽減率はtickの最初の被弾で固定されるので、同じtickの中で `stepBastion` が warn→open に移った後の被弾（`step()` の敵ループより後に処理されるロケット爆風・誘爆、`game.ts:2178`／`2221`）にも、開放前の60%軽減がかかる。直接呼び出しで再現: 1発目40、開放に移った後の2発目も40（開放中なら100のはず）。逆に open→guard の切替tickでは、軽減0がそのtickの残りに続く。影響は0.05秒の1tickだけで、硬化値の加算は現在の相（`canGain`）で正しく止まる。仕様の「同じtickは1回の被弾」と整合させるなら、文書に1行書くだけでもよい。 | ［確認：独自再現(b)］／実際の発射tickにロケットが重なる確率は［推測］で低い |
| P3-4 | `src/client/bastion-view.ts:52-53, 340-364`、`src/shared/game.ts:2234` | 地面の危険帯は「隊員がBASTIONと同じ高さの支持面に立つ」前提の幅1.73mで、弾の高さより下の支持面に沿って描く。実際の判定は `hypot(水平距離, 隊員y+1.2−弾y) < 1`。隊員が0.5m高い面にいると当たる幅は2.0mで、帯の外0.13mまで当たる。0.5m以上低い面では弾が頭上を通って当たらないのに、帯は赤く出る。今のフィクスチャと検証マップは平地なので、証拠には表れない。自然出現へ入れる前に、高さに応じた幅にする（当たらない区間は描かない）とよい。 | ［確認：数式とコード］／段差マップでの実害は［推測］ |
| P3-5 | 証拠 `game-states-844x390.jpg`、`game-states-1280x720.jpg` | 実ゲーム視点では、赤予告（地面の放射帯）と開放（装甲が開いてコアが光る）ははっきり読める。一方、通常／硬化（段階2）／予備動作の3つは、12mでも7mでも球が画面上で小さく（844×390で約30px）、トゲと琥珀色の差がほとんど見分けられない。本人の要件「硬化と回復を見た目で理解できる」は、着弾の火花とダメージ表示の減り方（24→19→14→10）でも補われている。それでも、本体だけで段階が読めるかは本人が実機で確かめる必要がある。強める案: 段階ごとの継ぎ目の明るさ差を広げる、段階が上がった瞬間に一度光る、トゲを長く・暗い色にして輪郭を変える。 | ［確認：画像の目視］。評価そのものは主観 |
| P3-6 | 証拠 `motion-death-sheet.jpg`、`bastion-view.ts:517-526` | 撃破と同時に GLB 表示を破棄するので、本体は次の描画で消える（0.50秒の枠にはあり、0.87秒の枠にはない）。既存の kill イベントの演出は出る。他の敵の撃破表現と見比べて足りないなら、装甲が外れて落ちる短い演出を検討。 | ［確認：画像］。他敵との比較は未実施 |
| P3-7 | `src/client/bastion-view.ts:528-530` | `clear()`（作戦切替）で個体の表示は破棄するが、火花・閃光（`sparkState`/`flashState`）は残り、最長約0.22秒は前の作戦の位置に描かれる。見た目だけの問題。 | ［確認：コード］ |
| P3-8 | `scripts/check-bastion-network.mjs:68-83` | 配信された赤予告（`volley`）から求めたレーンと、配信された実弾の位置・向きが一致するかは比べていない（弾数と2クライアント間の一致だけ）。下の独自検証で補ったところ一致したので、同じ照合をスクリプトへ足しておくと回帰に強い。 | ［確認：独自再現(net)］ |
| P3-9 | `src/shared/bastion.ts:268, 345`、`src/shared/game.ts:1323, 1878`、`src/shared/calyx.ts:274` | 斉射・照準弾は既存の弾数上限100を見ずに追加される（文書の既知事項）。弾の一覧は敵と隊員で共有しているので、合計が100以上の間は、他の敵の弾（game.ts:1878・calyx.ts:274）だけでなく、**隊員の弾道を持つ武器（`def.speed` のある武器、game.ts:1323）の弾も出ない**。上限による抑制は既存の仕様だが、BASTIONが複数いると12発ずつ上乗せされ、上限に届きやすくなる。自然出現の数を決めるときに確かめる。 | ［確認：コード］／実戦での発生頻度は［推測］ |

---

## 観点1〜8 の確認結果

1. **`bastionDamage`**［確認］: 同じtickは `tickAt === w.time` で1回とみなし、軽減率と連続判定はtickの最初の被弾で固定される。加算は `gainAt` で0.1秒に1回まで（4人×小銃＋爆風を同じtickに当てても+8が1回、次のtickは加算なし。実装側テストと独自再現で確認）。最初の被弾は `hitAt` の記録だけ。0以下のダメージは入口で返し、`hitAt` も更新しない。開放中・赤予告中は加算しない。
2. **反撃の時刻・予告と実弾の一致**［確認］: 予備動作0.8秒→赤予告0.8秒→発射→開放2.2秒（実Worker: brace 0.1 / warn 0.9 / open 1.7）。弾数・向き（`turn`）・原点は warn に入る時に確定し、`bastionLanes` を描画と発射で共有している。独自再現では、Nodeの実 `step()` で12発すべての垂直方向のずれ 5.6e-17m、向きのずれ 2.4e-16rad。実Workerの配信から復元したレーンでも、丸め（0.01）の範囲内（2.1mm、5.4e-4rad）。予兆中は移動しない（`steer` に入る前に return する）。撃破後は `w.enemies` から除かれ step が呼ばれないので、発射しない（実装側テストと motion-death の画像）。再生成は `createBastion` で硬化0。ポーズ中は `step()` が呼ばれず、`w.time` 基準なので持ち越しもない。再反撃は `readyAt = 発射+6秒` で制限され、開放が終わると `hitAt`/`gainAt` が消えるので、改めて75まで硬化させる必要がある。
3. **`hurtEnemy` への接続**［確認］: `src/shared` の敵ダメージは、すべて `hurtEnemy` を通る（直撃 `game.ts:1425`、爆風 `2178`、誘爆 `2221`、前線 `front-combat.ts:291/435`、`front-legacy-combat.ts`、`rebuild-combat.ts`）。`e.hp -=` を直接書いているのは `hurtEnemy` の中だけ。接続は `if (e.bastion)` の1か所で、`hp<=0` の早期 return の後にある。他の敵種は `e.bastion` を持たないので影響しない。`guard` は軽減がある時だけ付く。当たり判定の拡張も `e.bastion` がある時だけ。
4. **協力同期**［確認］: `Enemy.bastion` は `prepareState`/`encodeState` でそのまま送られる。丸めは `state-wire.ts` のキー名集合（x/y/z/time/tx… を0.01）だけで、`turn`・`armor`・`phaseAt` は丸めない。ずれは描画に使う時刻差の0.01秒以下で、判定はサーバー側だけで行う。フィクスチャ `bastion`/`bastion-fire` は通常の `step`・入力・配信を使い、`bastion-fire` は実際の射撃入力だけで硬化させている。実装側スクリプトを再実行して合格（P3-8 の補強あり）。
5. **描画**［確認：コード］: `BastionView` は `e.bastion` を読むだけで書き込まない。発光材質3つ（`BASTION_seam`/`port`/`core`）と光球の材質を個体ごとに複製し、`end()` で dispose する。形状・焼き込みテクスチャは共有で、破棄しない（正しい）。危険帯768・芯線96・火花128・閃光48の上限があり、弾の描画枠は160で、超えた分は描かない。作戦切替（`w.run` の変化）と `w` なしの時に `clear()` を呼ぶ。読込前・失敗時は簡易形状を描き、赤い危険帯は GLB の有無と関係なく `begin()` で描く。既存の汎用赤リング（`attackWind=0`）は BASTION には出ない。
6. **`REPORTLESS_ENEMIES`**［確認］: `enemyReportId` が `undefined` を返し、ソロの遭遇（`playtest-app.ts:651`）、協力の遭遇（`progression-coop.ts:13`）、開発者モードの全遭遇付与（`developer-mode.ts:40`）、声（`anomaly-voice.ts:63,143`）から外れる。`ReportEnemyKind` 型で、図鑑・会敵動画・レポート動作は型の段階で BASTION を受け取れない。関連テスト（anomaly-voice / front-developer-mode / front-enemy-report-order / enemy-size）は合格。
7. **造形**［確認：画像］: コンセプト（v1 の上下4枚＋コア、v4 のトゲ展開）に対し、実モデルは真球＋赤道帯＋8枚装甲＋10本のトゲ。v4 の角張った塊状への変形と、細かな多角形の分割は採らず、トゲと継ぎ目で表している（`review.html` の差分表のとおりで、表の内容は正確）。master の5状態は形として描き分けられている。開放は輪郭が大きく変わるので最も読みやすい。実ゲーム視点の段階差は P3-5。三角形17,636・約30描画呼び出しの実機負荷は未測定（実装側の申告どおり）。
8. **仮値と試作案の判断**［確認：独自シミュレーション］: 実 `step()`・ソロ・12m・HP340 で、AR 3.0秒（反撃1回・最大硬化100）、SMG 2.95秒（同）、SR 2.1秒（硬化0）。文書の表と一致する。散弾は初期装備の個体で2.4秒・硬化0（文書の SG-4 3.2秒／SG-7 2.55秒とは武器の個体が違う可能性があり、照合していない）。「連射は必ず反撃を1回受ける／単発は硬化させずに倒せる／断続射撃は遅いが安全」という性格づけは、仕様の意図（撃たれ続けるほど硬化）と一致する。軽減上限60%・予告1.6秒・12発でも10mでレーン間に約3.2mの隙間があり、禁止事項（即時反射・完全無敵・回避不能な弾幕）には当たらない。代案A〜Cの整理も妥当。反撃後の6秒の待ちの間に再び100（60%軽減）まで硬化させると、開放の後もしばらく硬いままになる。これを意図した遊び方とするかは、本人の数値判断で確かめたい（不具合ではない）。

---

## 実際に実行した検証

| 検証 | 結果 |
|---|---|
| `npm run typecheck`（クライアント＋Worker） | 成功 |
| `npx vitest run tests/bastion.test.ts tests/enemy-size.test.ts tests/front-developer-mode.test.ts tests/front-enemy-report-order.test.ts tests/anomaly-voice.test.ts` | 5ファイル70件すべて合格 |
| `npx vitest run`（全体） | 1112/1118件合格、6件失敗＋読込で失敗する1ファイル（下記「全体テスト」） |
| 独自再現 `repro.ts`（スクラッチ。esbuild でバンドルし Node で実行。repo の `src/shared` を直接 import） | (a) 最短硬化時間 25/50/75/100 = 0.35/0.65/0.95/1.25秒。(b) 同じtickで開放へ移った後の被弾も60%軽減のまま（P3-3）。(c) 実 `step()` の12発と `bastionLanes` の一致（垂直方向のずれ 5.6e-17m）。(d) 撃破時間 AR3.0/SMG2.95/SR2.1/散弾2.4秒。(e) ソロで全員ダウンにすると作戦は defeat になり、凍結中の発射なし |
| 独自の協力検証 `net.ts`（スクラッチ。起動済みの実ローカルWorker 127.0.0.1:8797、フィクスチャ `bastion`、2クライアント） | 両クライアントで warn 0.9秒→発射1.7秒・12発。受信した `volley` から求めたレーンと受信した実弾の対応で、ずれは最大2.1mm／5.4e-4rad（配信の0.01丸めの範囲）。配信は約10.6Hz |
| `node scripts/check-bastion-network.mjs`（実装側スクリプトの再実行） | `pass: true`。preset brace0.1/warn0.9/open1.7・12発・2クライアントで同じtickが一致。fire は hardenedAt 1.4・volleyAt 3.0・12発、共有被弾イベント46件、段階別ダメージ 24/19/14/10 |
| 証拠の目視 | `review.html`、`concept-vs-master.jpg`、`game-states-1280x720.jpg`、`game-states-844x390.jpg`、`motion-smg-sheet.jpg`、`motion-death-sheet.jpg` |

この実装側スクリプトの再実行で、ローカルの `dist-validation/bastion/network.json`（git対象外の出力）は上書きされた。証拠フォルダの `network.json` には触れていない。独自スクリプトはこのセッションのスクラッチフォルダに置き、リポジトリには追加していない。

### 全体テスト

`npx vitest run`: **104ファイル中98ファイル合格、1118件中1112件合格・6件失敗**。失敗は aim（ロケット照準）、bgm-layout-return ×2、hornet「keeps existing enemies on the ground」、maps「晶脈の地底巣」、render「short moving bullet」で、実装側の申告と同じ。中身を見た2件（hornet は crawler の高さ -0.00116 と 0 の比較、weapon-stat-marks は下記）は、どちらも BASTION のコードを通らない。

加えて **`tests/weapon-stat-marks.test.ts` がファイルの読込段階で失敗する**（`ReferenceError: document is not defined`、`src/client/weapon-help.ts:123`。テスト0件なので件数には入らない）。実装側の申告（`AUDIT-PACKAGE.md`）には書かれていない。BASTION の差分は `weapon-help.ts`・`gear-weapon-list.ts` を変更していないので無関係と考えられるが、**base（da41b38）でも同じく失敗するかは、ブランチを切り替えられないため確認していない**。6件の失敗も、base で同じく失敗するかは実装側の申告だけが根拠で、自分では確かめていない。

## 実行できなかった検証・範囲外

- 動画（mp4）は再生していない。時刻別一覧は smg と death の2枚だけを見た（burst / dodge / hit / multi / pause / rifle / shotgun / sniper の一覧は見ていない）。`capture-log.json`（25,288行）は読んでいない。
- `master-*_sheet.jpg` の個別確認、Blender の `.blend`・生成器 `build_bastion.py`・GLB の中身（ノード名・extras・三角形数）の照合はしていない。
- 実機（Android/iPhone）、Safari/Firefox、GPUでの描画負荷・フレームレート、複数体を同時に出した時の負荷は未測定。
- ブラウザでの検証ページ（`scripts/bastion-preview.html`）の手動操作はしていない（指示により `capture-bastion.mjs`/`collect-bastion-evidence.mjs` も実行していない）。
- 段差のあるマップでの危険帯と判定のずれ（P3-4）は、数式とコードからの判断で、実マップでは再現していない。
- `npm run build`・`server:build`・`npm run test:e2e` は実行していない。
- 本人の見た目・数値の承認は、このレビューでは代わりにならない。
