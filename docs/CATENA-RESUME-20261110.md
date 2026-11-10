# CATENA Ω 移植・再検証（2026-11-10）

## 状態と採用範囲

- 専用worktree：`C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-resume-catena-20261110`、branch `codex/resume-catena-20261110`、基準 `origin/main` = `3f2c429c442c44d54bf4a8132cc791f30534ae9d`。
- 旧候補は `C:/Users/futsa/Documents/Codex/2026-10-21/task-2/swarm-front` のHEAD `4e2b632e2373cb10319dda12f095a32ec2eb1a45`、初回実装 `5599da75fc3643ed0bfc8a75c1a88ccdcbe725f6`、P1接地修正 `4689fd06087d023ba37edfc50c1772e04b9b6160`。旧worktreeは読み取りのみ。
- 本人の今回の明示採用：胴7→14節、総HPを維持して各胴HPを半分、最大8砲口、16秒間隔のΩジャンプ、着地基本威力10、重複命中なし。武器・報酬・増援上限・ボット・ステージ制限はこのbranchで変更しない。
- **2026-10-21の独立監査P1は現候補の別担当読み取りで照合済み。関連テストの時間切れが残るため採用HOLDを維持。** main反映と公開は未実施。
- 実装固定SHA `7fef736bc3885fbc3a44878a2c76b86a9b7eba88` は既存GitHubの[Draft PR298](https://github.com/futsalife24-bot/swarm-front/pull/298)へ親がpush済み。main反映・Worker公開は未実施、採用HOLD継続。

## 移植差分

旧候補の本体・試験を現mainへ必要箇所だけ適用した。現mainの`game.ts`や描画器には後続変更があるため、衝突した3ファイルは文脈を照合して手動で移植した。`node_modules`は既存依存へのjunctionで、新規インストールなし。既存GLB `public/assets/enemies/foundry_zero_mechanical_legs_v2.glb`は変更なし（SHA256 `cefb976551d55167ba6b2ecf7ec9c7144105d890a85cb1c5335e24db90c275ab`）。

1. **CATENA本体**：`src/shared/worm.ts`、`src/shared/catena-omega.ts`、`src/shared/foundry-spawning.ts`、`src/shared/game.ts`。14胴・部位HP配分、8砲口、Ωの地上/飛行/着地・単回判定、部位破壊中断を権威側で扱う。
2. **描画**：`src/client/foundry-worm.ts`、`foundry-worm-gait.ts`、`catena-omega-warning.ts`、`render.ts`。既存GLBユニットを14胴へ複製し、Ω中の位置・予告15円を表示する。
3. **旧監査P1への接地整合**：`src/shared/surface-ray.ts`、`terrain.ts`、`enemy-motion.ts`。旧候補 `4689fd0` の洞窟地表/支持面修正を移植。現mainでのみ旧保存PLEATが攻撃移動中に再度斜面から0.027m離れることを確認したため、`pleat-strike.ts`で洞窟床上の攻撃移動時だけ身体/アンカーYを地表へ追従させた。HP・攻撃威力・経路判定は変更しない。
4. **現main固有の配信互換**：現mainの`state-wire.ts`は描画敵フィールドを明示列挙し、旧候補時点と違ってΩを送らなかった。`state-wire.ts`にΩを追加し、`state-tuples.ts`/`state-delta.ts`、両クライアント・Workerにtuple v2交渉を追加した。v1の許可キー/ビットマスクは厳密なので、v1へ任意フィールドを追加すると旧clientが復元を拒否する。旧v1接続はΩがない状態で同じv1 tupleを維持し、Ω中だけ既存object-state経路へ戻す。新v2はΩを含めtuple化し、v2 clientは旧serverのv1も復元する。状態上限・オミッション・チャンク閾値を変更していない。旧v1のΩ中は転送量増加と見た目の旧client非対応を監査焦点とする。

## 今回の実測

| 確認                                | 結果                                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                 | client/Workerとも成功（配信互換差分を含む）                                                                                                                                                           |
| 関連9ファイル166件                  | 初回165成功/1失敗。旧保存PLEAT攻撃中の床差0.027mを補正後、当該・PLEAT計25件成功。最終再走は159成功/7件が既定30秒timeout（後述）。166件合格とは扱わない                                                |
| 正式ST10 seed814                    | `tests/stages.test.ts -t 'stage 10 completes'` 成功。旧候補の175.85秒と現mainの勝利時刻を同一と断定しない                                                                                             |
| 状態wire/tuple/delta                | 47件成功。旧v1・新v2・不正Ω座標拒否・大密集容量を含む                                                                                                                                                 |
| 最大密集の旧v1対v2                  | 96敵/PLEAT48/4人/160オーブ/400弾。両版の実packet bytesは等しく、装備cacheなし65,463、あり65,503。いずれも65,536以下、敵省略なし                                                                       |
| 実Worker 2接続                      | 旧object-state双方で36同時刻一致、着地HPは命中側992/安全側1000                                                                                                                                        |
| 実Worker旧v1+新v2（ゲート追加前）   | Ω中は旧object/新`tuples-v2`、終了後は旧`tuples-v1`/新`tuples-v2`。同一ID再接続、Ω中のWorker snapshot保持、着地HP[992,1000]成功。このraw通信結果は旧ブラウザ描画の互換性を示さない                     |
| 実Worker互換ゲート（追加後）        | 14節stateを旧socketへ送る前に更新notice/close、旧再接続でも同じ。新clientの同一ID再接続、旧v1で対応可能なBASTION戦闘、WORMを含むstageの旧client参加時開始拒否を確認                                   |
| 実GLB/本番Renderer                  | Ω飛行中のmesh.count=15、着地後0、節の座標誤差3.6e-15以下。洞窟旧保存PLEATのアンカーは約0.000006→1.63864、床約1.63771、GLB/地形読込と描画エラーなし。Chrome SwiftShader・PCであり実Android/iOSではない |
| client build / Worker dry-run build | `npm run build`成功、`npm run server:build`成功（実デプロイなし）                                                                                                                                     |
| 対象36ファイルのPrettier check      | 成功                                                                                                                                                                                                  |

初回関連1失敗は現mainのPLEAT攻撃移動との組合せで生じた新しい回帰で、旧候補の「166成功」を今回の結果へ代用していない。補正後の全166件再走は通常sandboxで親の全体suiteと重なり612.99秒、CATENA自然巡回1件・既存foundry運動6件がすべて既定30秒timeoutとなった。assertion不一致は出ていないが合格ではなく、親の全体検査が終わってから同じ閾値で正式昇格の単独再検証が必要。全体`npm test`は本branchでは未実行。別worktreeで同じmain基準の開始ゲート実測は1694件中24失敗/1670成功であり、本件の全体合格を意味しない。スナップショットは更新していない。

初回の本番Renderer検査画像は着地後の近接視点で、飛行中の全景を判定できなかった。追加の`production-flight-warning-960x540.png`を実見し、固定検証カメラでは14胴のアーチと赤い15予告円が同時に視認できた。数値の描画検査も再度通過（`render-check-flight.json`）。実プレイの追従カメラやAndroid/iOS画面での視認性は未確認。旧候補の動画は現main描画の証拠へ代用しない。

**旧ブラウザの14節描画クラッシュ対策：** 旧ブラウザの`FoundryWormView.update`は胴節が7以外だと例外を投げる。親の承認を受け、Workerの既存notice/close経路で旧clientを更新へ誘導するゲートを追加した。CATENAを含む稼働Roomへ旧clientが入る時はwelcome/state前に通知して切断する。開始前にはWORMを含むstageに旧clientがいれば出撃を止め、WORM不在Roomおよび対応可能なfront-v1/BASTION戦闘は通す。稼働中にも14節stateの配信前に旧socketを通知・切断し、新clientは続行する。tokenを消す処理や7節への投影はない。実Worker raw通信のゲート証拠は`network-gate-final.log`。旧Network画面fixtureは基点`3f2c429`の`network.ts`本体と現候補の相対importを使う限定確認であり、旧製品全体の描画互換合格を示さない。main未反映、公開なしを維持する。

旧NetworkのChrome表示fixtureは、基点`3f2c429`の`network.ts`を一時抽出し、現候補の相対importと有効な2武器を与えて実Workerへ接続した。画面は「画面を再読み込みして復帰してください」を表示し、旧Networkが受けた14節stateは0、token保持true、pageerror 0（`legacy-browser.json`と`legacy-update-notice.png`）。旧製品`main.ts`は`onStatus`を画面に反映する経路を静的照合したが、fixtureは旧製品全体の実行ではない。初回はVite HTML読込timeout、次の2回はfixture側で武器2本が未設定のためWorkerが「武器定義が不正です」を返した。実製品と同じ有効武器入力に直して合格した。製品側のコードや権限設定はこの修正で変えていない。

`game-step-equivalence`の22条件は未更新。CATENAに直接関係するのはWORM波のseed104と、`menagerie()`がWORMを直接配置するseed108/109/110。洞窟seed107もPLEAT支持面の影響候補。PR297の武器変更に帰属する6条件の期待差と、基点から存在する前線4条件の日付依存差を混ぜず、PR297後の同一seed/入力を対照にCATENA側の初回差異tickとfieldを特定する。意図差が確認された名前付き条件だけ期待値を変更し、一括スナップショット更新はしない。

## 過去監査と再レビュー入口

- 旧独立監査は別のCodex委任タスクが `3934c65` を監査し、**P1-01：14節化がST10 seed814を600秒時間切れへ回帰**と認定した。原文写しは [`evidence/catena-resume-20261110/old-independent-audit.md`](evidence/catena-resume-20261110/old-independent-audit.md)。監査冒頭は「通常Chatの監査経路完了ではない」と明記。既存記録にChat URLはない。
- 旧P1修正の設計/因果対照は旧worktree `docs/CATENA-OMEGA-P1-FIX-20261021.md`、ST10旧診断は同 `docs/CATENA-ST10-FOLLOWUP-20261021.md`。旧P1修正は14節を維持してseed814を175.85秒で勝利、815/816も勝利した。当時の再独立レビューは未了だったため、今回の固定SHAで別担当がP1経路と新しい`pleat-strike.ts`/wire/schema拡張を読み取り照合した。815/816の現候補での実再走は未実施。
- 旧監査の原ZIPは `C:/Users/futsa/Documents/Codex/2026-10-21/task-2/catena-omega-audit-3934c65.zip`（SHA256 `b8f245aa3ecf1e808a15d4510a9bb5a291e065b143b0cd0e7fdfa2b58c39f8f5`）。P1修正後の配布ZIPは同 `catena-omega-audit-20261021.zip`（SHA256 `9d0d7886b699c7cf291b47952554f9a6c9ad5367f83b0122108c1d19fdfd31cc`）、照合票は同 `catena-omega-delivery.json`。ZIP・動画はローカル保護対象でGit管理へ複製しない。
- 別担当レビューの焦点：ST10 seed814と815/816・14節対7節の因果、洞窟支持面/斜面/旧保存PLEAT、Ω重複命中と中断、総HP/砲口/16秒/威力10、実GLB予告、旧v1/新v2混在・再接続・保存復元、旧v1のΩ中object-state容量と65,536上限/チャンク、**旧ブラウザの7節固定描画への更新ゲートと旧socketへ14節stateを送らない順序**、実端末での見え方と負荷。現mainの別変更や武器/報酬をCATENA差分に混ぜない。

- 別担当Codexの固定SHA `7fef736` 読み取りでは旧P1-01のseed814経路と旧client更新ゲートを照合し、新たな確認済みP1コード欠陥なし。関連166件の7 timeoutが残るため採用HOLDは継続。親の統合branch `50b303e`との`git merge-tree`で確認した競合は`server/testing.ts`のfixture正規表現1行で、`front-support-result`と`catena-omega`を両方残す。これをmain反映の承認や全体合格とは扱わない。

## 再現と資料セット

本worktreeの`docs/evidence/catena-resume-20261110/`に今回のログ、初期ファイルSHA、旧監査原文の写し、実描画のPNG/JSONと実WorkerのJSONを保持。生の`.log`は同場所に残し、Gitには原文を`validation-logs-initial.zip`へ束ねて保存した。画像の生成元はGit除外の`dist-validation/catena-omega/`。レビューへ渡す最小資料は、(a) この文書と旧監査原文、(b) このbranchのCATENA/接地/配信差分と専用テスト、(c) 上記既存GLB、(d) ST10・関連・wire・buildログ、(e) 実描画PNG/JSONと実Worker JSON。過去ZIPを要求された場合だけ上記ローカル場所とhashで照合する。外部監査への送信、push/merge/公開は親担当。

追加スクリプト・検証コードの合計は300行を超える。理由は実Workerの新旧通信と更新ゲート、実GLB描画、洞窟旧保存、旧Network画面をそれぞれ独立して再現し、過去のraw通信結果と修正後の期待を区別するため。製品側の変更は既存のゲーム/描画/配信経路に限定した。旧ゲート前の混在raw通信結果は証跡として残し、ゲート後に失敗する旧検証スクリプトは残していない。

実環境はWindows/PowerShell。ローカルWorkerの検証鍵は`scripts/setup-local.mjs`がこのworktreeのGit除外`.dev.vars`へ生成し、値は出力していない。実行は`wrangler.test.jsonc`のローカルWorker `127.0.0.1:8797`とVite `127.0.0.1:5197`、旧Network画面fixtureの`127.0.0.1:5186`のみ。実Android/iOS・人間操作・インターネット遅延・長時間性能は未確認。

### 後続証拠

旧Network表示と飛行全景の後続ログは `validation-logs-followup.zip` に保存する。追加PNG/JSONは同じ証拠directoryに置く。ローカル検証サーバーは終了した。

追加後の`npm run typecheck`は成功。`npm run format:check`は基点から未変更の14ファイルの警告で不合格となった。CATENAで変更したソース・検証スクリプトと本詳細文書だけのPrettier checkは成功。14件の既存整形をこのbranchで書き換えず、ログに対象を残す。親の統合branchでも高CPU下で物理/描画/協力性能の時間切れが出たため、同条件での166件再走は行わず、負荷改善と親の限定再検査後に待機する。
