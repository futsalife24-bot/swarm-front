# HARROWとステージ25拡張

2026-09-22 ユーザー依頼: HARROWを通常ST20・ST25・分岐15-Aのボスに採用し、通常ステージを25まで拡張。ステージ全体のバランスも調整する。

## 開始点と保護

- base: `402dcec`（origin/main）、branch: `codex/harrow-stages-25`。
- 開始前からある `.gitignore`・`AGENTS.md`・`package.json`・未追跡`CLAUDE.md`の別作業を保護。
- 最新の統合対象はHARROW v6。実行時GLB・Blender原本・再生成資料の採用SHAを確定し、後段に素材検証を記録した。
- v5の噛みつき・威嚇をそのまま使う初期案は採用仕様ではない。単体制作の監査合格をゲーム統合の監査合格として扱わない。

## 最新の受入条件と実装

- 初登場は空中。RAYの実飛行域4.5〜11.5mの上限を使い、基準高度は `RAY_MAX_FLIGHT_HEIGHT × 3 = 34.5m`。定義上のcruise値6.5mではなく実上限を基準にする。地上と空中を交替し、離陸直後は2秒の空中猶予を設ける。
- ミサイルは左右の翼から各5発、計10発を上向きに発射する。2秒前から赤い着弾マーカーを表示し、発射後はその固定地点へ向かう。マーカーはプレイヤーを追って移動しない。上昇から下降までの飛行は3秒、壁・屋根と爆風遮蔽を判定する。
- 発射前に発射元が死亡・落下した場合は未発射弾を取消す。発射済み弾は戦闘継続中なら残り、戦闘終了時に消える。v6のThreat 2.00秒で赤い弾頭10個の先端を実測し、`harrowMissileOrigins` を戦闘とレポートで共用する。
- 近接・真下の相手には着地し、翼を接地して横方向へ1回転する。1回の回転で同じ相手へ繰り返しダメージを入れない。実縮尺0.65で低い翼先の水平半径が8.654237mだったため、回転の判定・赤予兆を共通の `HARROW.spinRadius = 8.7m` に合わせた（暫定6mから修正）。
- 空中の遠距離攻撃機会では30%で滑空からダイブへ移る。移動先を確定して予測可能にし、着地へつなぐ。
- 空中で最大HPの12%に相当するダメージが蓄積すると `StaggerFall` で落下し、着地後に地上行動へ戻る。致死ダメージは通常の撃破となる。
- HARROWもHUDのボスHP表示・遭遇演出・ミニマップに含める。雑魚用のショットガン吹き飛ばし・撃破連鎖爆発から除外する。
- 実GLBと攻撃判定・予兆・向き・接地を整合させ、ソロと権威Worker通信で確認する。通常Chat独立監査、main反映、既存Worker公開・配信確認は主担当の後続工程。

## ステージと既存セーブの互換

`World.stage` と協力プレイの番号は通常ST番号。1人プレイの `solo.stage` とミッションキーには従来の保存IDを使い、`campaign.ts` で変換する。

| 作戦 | 保存ID | 解放 |
| --- | --- | --- |
| 通常ST1〜20 | 1〜20 | 従来どおり、前の通常ステージをクリア |
| 既存3-A | 21のまま | 従来のST3探索条件 |
| 通常ST21〜25 | 22〜26 | 前の通常ステージをクリア |
| 15-A | 27 | 通常ST15をクリア |

- 既存ID21を新ST21として再利用しない。既存の3-Aミッション・報酬・中断記録を変更せず読める。15-Aは通常ST16以降の解放を妨げない任意分岐。
- 15-A・ST20・ST25でHARROWが登場。15-Aは前衛18体＋HARROW1体、ST20は前衛・護衛48体＋HARROW1体、ST25は3波・雑魚91体＋HARROW1体。
- ステージ一覧、作戦詳細、ホームの名称、中断再開、報酬復旧、開発モードの全解放を新IDに対応。
- 日替わり防衛の保存stageは通常番号を保持する。出撃準備・保証武器・勝利ボーナスで保存IDへ変換し、新ST21が旧3-Aの低レア抽選になる不具合を防ぐ。
- 育成上限120、武器性能、従来のレア抽選上限は維持。通常ステージの勝利コインは既存の段階式を25まで延長し、ST25通常580・ハード870。15-A通常380・ハード570。

## バランス調整の根拠

以下の前後値は `402dcec:src/shared/stages.ts` と今回の定義から集計した設定値。ボスの追加形成で生まれる敵は雑魚数に含まない。旧mainを同じbotで走らせた比較実測は行っていないため、設定削減をそのまま難易度・時間の改善率とはしない。

- ST1〜6は移動・射撃、新敵、最初のボスの導入を維持。波・出現数を変更せず、スターターでのクリア検証も維持した。
- ST7〜14は初登場順とボス構成を保ちながら、長い雑魚戦と遠距離護衛を軽減。合計雑魚数960→870。ST12は200→176、ST14は136→116。対象波の出現間隔も広げ、同時の射線負荷を抑える。
- ST15〜20は旧20面完結時の多重ボス・長期消耗戦を、新25面構成の中盤〜後半入口へ再配置。HARROW戦に既存の大群と多重ボスを重ねない。

| ST | 波数 前→後 | 雑魚数 前→後 | ボス総数 前→後 |
| --- | --- | --- | --- |
| 15 | 3→2 | 94→50 | 4→1 |
| 16 | 3→3 | 160→68 | 2→1 |
| 17 | 2→2 | 98→56 | 3→2 |
| 18 | 5→3 | 196→69 | 5→1 |
| 19 | 3→2 | 180→66 | 5→2 |
| 20 | 4→2 | 284→48 | 5→1（HARROW） |
| 21 新規 | 3 | 103 | 0 |
| 22 新規 | 2 | 60 | 2 |
| 23 新規 | 3 | 105 | 1 |
| 24 新規 | 3 | 89 | 2 |
| 25 新規 | 3 | 91 | 1（HARROW） |

HPと攻撃倍率は既存の `1 + (ST-1)×0.025` / `1 + (ST-1)×0.02` を維持し、ST25では1.60 / 1.48。協力側のドロップ率と品質係数はST20相当で上限を設け、25面への延長だけで既存抽選域を超えない。

実装途中の最初の25面検証ではST18だけ129.55秒・74撃破で死亡した。ここで第2波の遠距離14＋14→10＋10、第3波の護衛crawler14＋CALYX2→12＋1へ調整し、その後の25面通常ルール検証は全勝。これは旧mainとの比較ではなく、今回の途中設定に対する再調整の記録。

## 自己検証の証拠（2026-09-22、時刻JST）

- 18:27開始: 初期攻撃仕様で全27面×通常/ハード54戦＋進行・保存・中断を計74テスト合格。これは飛行・回転・ダイブ導入前の暫定結果。`dist-validation/harrow-campaign-solo-tests.log`。
- 18:31: 新IDの既存3-A保持・15-A解放/地形/中断・報酬復旧・ST21日替わり抽選の計6テスト合格。`dist-validation/harrow-campaign-save-final.log`。
- 18:40:36開始: 飛行・回転・10発ミサイル・ダイブ・蓄積落下を含む共有ロジックで54ソロ戦すべて勝利、143.27秒。この時点の高度は19.5m。`dist-validation/harrow-final-solo-sweep.log`。
- 18:40:55開始: 同共有ロジックで通常ルールの25面すべて勝利。スターター6面・全波構成・地形等を含む35テスト合格、92.81秒。`dist-validation/harrow-final-coop-sweep.log`。この検証はローカル共有ロジックの合法装備botであり、実通信多人数プレイではない。
- 18:48:31開始: 最新の空中2秒猶予・近接時の離陸も含め、ミサイル左右5発/固定地点/予告/上向き軌道/遮蔽/発射元死亡/中断再開/通信JSON、地上空中交替、1回転1回被弾、1000回選択でダイブ割合24〜36%内、蓄積落下・実hurtEnemy経路・致死判定・開発全解放の計11テスト合格。`dist-validation/harrow-followup-missiles.log`。wire座標は既存仕様の0.01単位丸めを許容し、保存再開では元精度を維持する。
- TypeScript `tsconfig.json` 成功は18:39時点。後続変更を含むclient/worker双方の最終型検証は後段に記録。`dist-validation/harrow-followup-typecheck.log`。

18:40時点の54戦集計: 通常27戦の最大189.90秒・最低残HP160・最大同時敵24、ハード27戦の最大192.15秒・最低残HP119.212・最大同時敵29。合法装備の進行別botを使い、戦闘中のHP・敵・タイマー改変はしない。救急箱使用は既存の通常入力相当の条件で実行する。

| HARROW作戦 | 通常 時間/残HP | ハード 時間/残HP | 救急箱 |
| --- | --- | --- | --- |
| 15-A | 51.25秒 / 192 | 56.20秒 / 192 | 両方未使用 |
| ST20 | 73.45秒 / 224 | 86.50秒 / 211.304 | 両方未使用 |
| ST25 | 135.05秒 / 224 | 142.45秒 / 224 | 両方未使用 |

詳細54件は `dist-validation/harrow-54-sweep-pre-height.json` に保護。自動照準を改造せず、既存botの射撃入力で空中HARROWを撃破できた。人の体感難易度・実スマホ操作・多人数長時間戦・最終v6モデルと当たり判定の一致を保証する結果ではない。

### 実上限高度34.5mへの修正後

19:00:45開始、空中2秒猶予・近接時の離陸・RAY実上限の3倍34.5mを含む最新版で、HARROWの3作戦×通常/ハード6戦を差分検証し全勝（17.83秒）。`dist-validation/harrow-height34-solo-sweep.log`、詳細6件は `dist-validation/playtest-v1/clear-sweep.json`。非HARROWステージは変更がないため再走しない。

| 作戦 | 通常時間 19.5m時→34.5m時 | ハード時間 19.5m時→34.5m時 | 修正後の残HP 通常/ハード |
| --- | --- | --- | --- |
| 15-A | 51.25→52.55秒 | 56.20→59.80秒 | 192 / 192 |
| ST20 | 73.45→73.95秒 | 86.50→91.50秒 | 224 / 211.304 |
| ST25 | 135.05→138.00秒 | 142.45→146.55秒 | 224 / 224 |

6戦とも救急箱未使用で、残HPは修正前と同じ。高度修正に加えて空中猶予の変更も含む比較であり、高度だけの効果を切り分けたものではない。

19:02:16開始の通常ルールST20/ST25も2戦とも勝利（18.21秒、`dist-validation/harrow-height34-coop-sweep.log`）。19:02:55開始の受入11テストも高度34.5mへ更新した期待値で全合格（12.38秒、`dist-validation/harrow-height34-unit.log`）。この時点では未実施だった最終モデル・実通信の検証は後段に記録。人の操作による評価は未実施。

### v6最終素材・実描画

- 実行時: `public/assets/enemies/harrow_motion_v6.glb`。SHA256 `0f640a7552d08f410c44a57733a1b0be87ce937995e32f05f18e519429100985`、8,053,036 bytes。原本 `assets/blender/candidates/harrow/v6/harrow.glb` と同一。原本 `harrow.blend` はSHA256 `e6d544cbd7f15a431f2003d18791b79bde8609a8fa0e9bf20bbb513d8690cafd`。
- 186 skinned primitives・39骨・11クリップ。Idle、Locomotion、Attack（旧素材として保持）、Threat、Spin、Takeoff、Flight、Glide、Dive、StaggerFall、Land。採用近接攻撃はSpinであり旧Attackの噛みつきではない。
- 実GLBの骨行列60Hz・頂点10Hzで有限値と地面より下への侵入が数値誤差1e-6m以内であることを確認。閉ループの端点一致、非ループ動作の終端保持も確認。実production loaderは材質ごとに20メッシュへまとめ、152,428三角形を維持。Three.js標準skinとpaletteの位置差は11クリップ×5フレームで最大 `5.79613831229261e-7m`。生成と破棄も検証した。
- 同一最終GLBから再読込して `dist-validation/harrow/v6/final-spin.png`、`final-flight.png`、`final-dive.png`、`final-fall.png` の4画像を保存・目視。画像とGLBの対応SHAは `final-render.json`、原本一式は `source-manifest.json`。旧一括再検証はメモリー不足で中断しており、合格とは扱わない。最終4画像はCPU 2スレッドの別処理で補完した。
- 主担当が検証専用の実Rendererブラウザ画面で、空中姿勢、接地Spin、赤い10マーカー、上向き発射、Glide→Dive、StaggerFall→Landを確認。遅延スナップショット・一時停止ステップでも攻撃開始からの経過時間でブレンドを完了する修正を含む。プレイヤーを実操作した確認、実スマホ、長時間の多人数操作は未検証。

数値と画像の詳細は [v6素材検証](../assets/blender/candidates/harrow/v6/VALIDATION.md)、`dist-validation/harrow/asset.json`、`v6-asset.json`、`launchers.json`、`v6/spin-radius.json` を参照。

### 最終の型・関連テスト・ビルド・実通信

- client/worker両TypeScript成功。HARROW、エフェクト、レポート、structure、render、サイズ、音声、遭遇カメラ、state-wire等の12ファイル計152件は、成功済みの影響外ケースを保持し、修正対象だけ再検証して全合格。集計は `dist-validation/harrow/final-validation.json`、個別ログは `final-typecheck-*.log`、`final-related-tests*.log`、`final-changelog-test.log`。
- 修正したテストの根拠: HARROW追加で `Object.keys(ENEMIES)` の順序が変わり、可変サイズの最大枠を固定サイズ個体が占めていたため、可変6種を明示して従来の最大2を維持。HARROW専用action/worldTime入力でSpin・StaggerFall・停止・遅延ブレンドを確認。既存Vitestで欠けていたchangelog注入はbuildと同じ実Git生成値を使用し、この履歴生成テストだけ上限90秒とした。
- client build成功（141 modules）。500KB超chunkの警告は残るがビルドは成功。production設定Workerのdry-runも成功（226.14KiB、gzip 61.60KiB、assets219）。`final-client-build.log`、`final-worker-dry-run.log`。公開はしていない。公開用更新履歴を確定するため、実装commit後にbuildを再生成する。
- ローカル権威Workerを専用8798で起動し、モックなしのWebSocket 2接続で11チェック成功。初登場高度34.5、ミサイル10個の予告・発射・着弾、Spin予兆とダメージ、Glide→Dive→Land、実hurtEnemyからのStaggerFall→Landを確認。同一run・同一tickで敵配列・ミサイル配列・両プレイヤーHPが一致。固定高HP・位置のfixtureを用いた遷移検証であり、通しプレイの難易度評価ではない。終了後、検証用Workerを停止した。
- 通信の両HPは、ミサイル着弾9956/9956、Spin9966/9966、Dive着地9956/9956。結果 `dist-validation/harrow/network.json`、`network-command.log`、`worker-network.log`、`network-commands.txt`。

### 回転半径8.7m反映後の差分検証

19:46:34開始のHARROW 3作戦×通常/ハードは6戦全勝（11.12秒、`dist-validation/harrow/final-radius-solo.log`）。15-Aは52.55/59.80秒・残HP192/192、ST20は73.95/91.50秒・224/211.304、ST25は138.00/146.55秒・224/224。6戦とも救急箱未使用。数値は `dist-validation/playtest-v1/clear-sweep.json`。

19:46:46開始の受入11テストも全合格（2.12秒、`final-radius-unit.log`）。実Worker 2接続11チェックも最新半径で再度成功（`final-radius-network.log`、更新済み`network.json`）。19:42:33の回転単独1テスト成功は `final-radius-tests.log` に保存。古い半径・高度での全ステージ記録は上記の時点証拠として残し、最新版の差分検証と混同しない。

### Judgeの状態

最新Judgeは `latest.json: invalid_input`、`latest-live.json: not_run / batch_claim_failed`、API呼出し0。判定未取得であり、合格や独立Chat監査の代替として扱わない。

## 残作業と状態

v6素材・採用SHA・4画像・実loader数値検証、検証専用Rendererでの実ブラウザ確認、権威Worker 2接続、型・関連152件・build・production dry-run、および回転半径8.7m反映後のソロ6戦・受入11件・実通信11チェックまで自己検証済み。Judgeは未判定。

残る工程は、対象差分と証拠の保存・commit、通常Chat独立監査と必要修正、main反映、commit後の公開用build、既存Worker公開・配信確認。人操作・実スマホ・長時間の多人数操作を検証済みとはしない。現在地の正本は `docs/STATE.md` と主担当の作業記録を参照する。

## 2026-09-24 最新mainとの統合と互換性修正

- base `21468bba58c9bc5f222f481ef0ce8b859f1a160d`、実装 `5190ddfd8e24d06e8ef07968bc0837b729f6fb1c`。別worktree `../harrow-integration` で武器12丁を統合し、元の未保存作業は保護。STATEは最新mainの全文を維持。
- 空中近接時の2秒猶予中はSpin選択へ進ませず、接地後に回転する。登場・離陸・遠距離攻撃を回帰確認。
- checkpoint v2は保存時のStagePlanを固定。v1は旧20面の編成を復元し、旧ST18の第4波・ST20の第3波以降と目標時間、旧3-A、難易度補正を維持。実時間で生存敵がいる状態から次波へ進むテストを含む。敵を消して残波を確認する別ケースは合成進行試験であり実戦勝利ではない。
- client/worker型成功、関連12ファイル157件成功。追加37件は12武器の地上/低空への実射撃、最大高度への遠距離5武器、レーザー蓄積落下、回復/repel/chain除外。grenade/stickyは既存弾道上の到達高度を超えるため低空で検証。
- 最新統合コードで27作戦×2難易度54戦全勝＋checkpoint14件（合計68件）、通常25面全勝を含むstages35件成功。botと合法装備による結果で、体感難易度を保証しない。
- 実ローカルWorker＋WebSocket2接続11項目成功。client本番build成功（chunk警告あり）、production Worker dry-run成功235.73KiB/gzip64.39KiB、公開なし。最初のdry-runはclient build終了前でdistなしだったため、完了後に再実行して成功。
- 証拠: `dist-validation/harrow/integrated-{types,related,campaign,stages,network,build,dry-run}.log`、`network.json`、`dist-validation/playtest-v1/clear-sweep.json`。
- 独立監査はiab未接続で継続不可。初回の最終判定・修正版判定は未取得。再監査資料を保存し、接続復旧後に同じChatへ送信する。main反映・公開は未完了。
## 2026-09-24 初回監査結果取得・必須3件修正

iabは対象タスクへのnavigateで復旧。初回0120db6の独立判定は要修正（F1/P1旧中断進行不能、F2/P2空中Spin、F3/P2岩着地後の追跡で地面へ沈む）。F1/F2は40c2443までに修正済み。F3は `efcaef1` で地上追跡のmove支持高さを保持し、飛行時だけ高度補正へ変更。

F1の監査再現値ST7 wave1 spawned23、ST20 wave4 spawned108を実read/hurtEnemy/step経路で回帰に追加しcheckpoint16件成功。F3は実ST20岩4m・倉庫屋上6mのLand→追跡→停止→Spin完了と縁の降下を追加しHARROW17件成功、client/worker型成功。実ブラウザの岩上表示は未確認。素材は変更なし。任意O1は現状の被弾中心球（原点上2.73m・半径2.21m）が全身形状追従ではないと記録。任意O2の実スマホ負荷は未測定。

修正版は同じ監査Chatへ送信する。以前のiab未接続という停止理由は解消。合格判定・main反映・公開はまだ未完了。
