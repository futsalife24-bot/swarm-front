# 協力通信の可逆tuple化（2026-10-30）

対象: branch `codex/coop-comfort-20261030`、基点main `3e1dc640e15d747cc2a06ac72c59833db2072f74`、作業場所 `C:/Users/futsa/.codex/worktrees/coop-comfort-20261030/swarm-rebuild-p1a`。独立監査ではない。

## 変更と契約

担当は `src/shared/state-tuples.ts`、`src/shared/state-wire.ts`、`src/client/network.ts`、`src/client/front-network.ts`、`tests/state-tuples.test.ts`、本記録。WorkerとVitest設定の接続は主担当が担当した。

- 両クライアントがhelloで `stateTuples: 1` を通知。サーバーは対応する接続だけへ `stateEncoding: "tuples-v1"` と `stateOwners` を付ける。prepareState.packetの末尾第6引数がtupleSupportedで、既定false。旧画面には従来形式、新画面は旧サーバーの従来形式も受信できる。
- 既存encodeStateで丸め・微小正HP保護・武器の端数保護を完了したJSON値を、固定フィールド順と存在maskを持つ配列へ詰める。配列化対象はprojectiles、描画用敵共通項目、PLEATの身体・姿勢・全脚point/normal/planted、FOUNDRY節、pulseAim、orbs。pulseAim.yの省略も元どおり復元する。
- ownerとtargetIdは小さい共通文字列表の整数参照にする。文字列を切らず、復元後のowner/targetIdは元の値と一致する。BASTIONのturnBitsは整数のまま維持し、既存StateOmissionCacheが元の角度を復元する。
- 同じprepareState内で、projectilesの共通prefix、敵IDごとの符号列、オーブIDごとの符号列と全体をキャッシュする。旧/新・装備cache有無の共通文字列キャッシュを分ける。受信者別のfront情報を1度符号化し、容量探索のたびに全PLEATやfront/装備をJSON化し直さない。
- 受信側はJSON解析後、既存World検査・装備cache・省略cacheより先に復元する。不正版、マーカー欠落のtuple、maskと値数の不一致、不正型、owner表やインデックス破損、角度ビット破損等はfalseで拒否する。後方の値が壊れていた場合にもWorldの途中復元を残さず、例外を受信処理の外へ漏らさない。
- 既存64KiB受信上限を維持し、追加の復元上限は敵512、弾/オーブ各4096、脚16、節64、入れ子16、全走査50,000ノード、owner表64件。値や個体を上限内へ削る処理ではなく、不正・過大な形式を受理しないための上限である。
- 圧縮ファイル、バイナリ、追加依存、権威World、入力契約、実セーブの変更はない。固定スキーマを変える時は版を更新する。

## 固定条件のサイズ

既存denseWireFixture（seed4520、敵96体うちPLEAT48、4人、オーブ160、演出120、受信者1人）。値・敵数・弾数・オーブ数は変えず、従来の演出省略だけ必要に応じて適用。以下の全条件で敵96・オーブ160・全弾を復元し、敵/オーブの省略は0。

|弾数|装備未cache bytes|装備cache bytes|演出保持（未cache/cache）|
|---|---:|---:|---:|
|180|57,778|56,817|120/120|
|280|64,578|63,617|120/120|
|400|65,454|65,494|69/76|

従来形式は同じ400弾で敵を全省略しても75,005バイトとなる主担当計測があり、単にプレイヤー実体弾の共有100個上限を除くだけでは容量問題が残っていた。初回のtuple化も、弾ownerの32文字反復が残り、400弾で敵10〜13体を省略した。共有owner表の可逆参照を加えた後に上表を満たした。

## 実Workerの受信者別情報を含む余裕

実getFrontRunView、serverNow、expiresAt、ruleset/mode/clearedStageを含め、20文字の日本語名を4人に設定。通常より多めの合成31予告（10組×3＋ボス1）もfrontView経由で含めた。frontView単独は2,649バイト。この予告数は合成の余裕試験で、合法最大条件を証明する値ではない。

|400弾条件|bytes|64KiBまでの余裕|演出|
|---|---:|---:|---:|
|実情報＋合成予告、装備未cache|65,456|80|48|
|実情報＋合成予告、装備cache|65,480|56|55|
|上記で演出全除去、装備未cache|58,572|6,964|0|
|上記で演出全除去、装備cache|57,595|7,941|0|

いずれも敵96・PLEAT48・オーブ160・弾400の全数を維持。上限近くまで演出を戻す既存探索のため通常送信の余白は小さいが、演出を全除去した時点で約6.9〜7.9KBの余裕がある。無制限の将来条件を保証するものではなく、実Workerでの400弾・装備初回・新旧混在・復帰・実描画は主担当の統合検証へ引き継ぐ。

## 単体・型検証

`node node_modules/vitest/vitest.mjs run tests/state-tuples.test.ts tests/state-wire.test.ts tests/front-wire-pressure.test.ts tests/front-network-input.test.ts tests/pleat-locomotion.test.ts tests/bastion.test.ts tests/harrow-effects.test.ts tests/front-feedback.test.ts --maxWorkers=1`

8ファイル108件成功（13.28秒）。担当24件には、丸め済み従来wire値との全体一致、敵ID/位置/HP、武器power/rollsの端数、PLEAT、FOUNDRYの微小部位HP、pulseAim.y省略、BASTIONの角度と予告レーン、新旧受信、装備cache切替、省略cache保持、共有符号列再利用、破損入力を含む。BASTIONの正式countフィールドを使うfixtureへ整えた後、担当24件を再実行し成功した。

client/worker両tsconfigの型確認、担当コード5ファイルのPrettier確認、git diff --checkも成功。インストール、他プロセスの停止、commit/pushは行っていない。主担当の実通信計測・描画ベースライン計測中は製品編集や重い単体を待ち、終了通知後に実行した。

サイズ記録は `dist-validation/coop-comfort-20261030/wire-tuple-sizes.json` に生成したローカル補助証拠。再現する固定条件と結果の正本は本記録と担当テスト。生成bundleは配布物ではない。

主担当による差分レビュー、実Workerの新旧混在・400弾通信、実ブラウザ、実機、build/公開は本分担の成功として扱わない。実モデルID・推論設定の実値は未確認。呼出指定はgpt-6.1-sol/high。

## 残存容量への対処：版交渉付きsnapshot分割

400弾の固定fixtureは容量保証の証明ではない。現行コードの読取では、通常の手動実体弾は4種類とも1発1弾、NewWeapon最大倍率は1.15^4×1.2、最短発射間隔はgrenadeの約0.286秒、最大寿命は同約10.58秒。通常敵弾の共有100個とBASTION最大3体の予告斉射12＋照準弾1を別に数えると、4人の弾数上界は約295という保守的候補になる。ただしtick境界・装備切替を含む厳密な上界の証明試験は行っておらず、400超を合法経路で再現したとは扱わない。

敵数だけでも、48PLEATは合法上限ではなく、生存で射撃型を優先撃破すればcrawlerが96体まで残り得る。壁面では身体・脚接地点・法線の多くが非ゼロ小数となり、同数の床面fixtureより長くなる。命中statuses、地雷、長い数値、進撃のHARROW別ミサイル配列（最大40）・CALYX雲（最大16）も400弾fixtureの単一サイズでは保証できない。通常進撃のFOUNDRYは同じ敵ID内の最大7節を分離制御し、新しい敵IDへ分裂するわけではない（worm.tsとgame.ts）。Foundry増援は通常上限内で出現し、BASTIONを増援種に含めない（foundry-spawning.ts、stages.ts）。

主担当から追加実装指示を受け、`src/shared/state-chunks.ts` と `tests/state-chunks.test.ts` を追加し、既存担当のwire/両networkを接続した。

- helloの `stateChunks: 1` を明示交渉。packet第7引数chunksSupportedは既定false。対応する接続では、演出削減後も64KiBを超える場合、敵・オーブを省略する前の完全snapshotを返す。
- `encodeStateChunks(payload, snapshot)` は64KiB以下を元の1messageのまま返す。64〜256KiBは `type: "stateChunk", version: 1, snapshot, index, total, bytes, checksum, data` へ分割する。各messageは実UTF8で64KiB以下、全体256KiB以下、最大16片。256KiB超はundefinedを返し、Workerの既存4009拒否へ戻す。敵や弾を減らして収めない。
- snapshotは接続内で単調増加する安全整数。Worker側は主担当がhello/attachment保存、broadcast番号、全片の順送と全片成功後の装備cache更新を接続した。
- 受信は接続ごとのStateChunkAssembler。全片と全体byte/checksumが一致し、復元JSONがstateである場合だけ、既存tuple/World/装備cache/省略cacheへ渡す。順序逆転・重複・古い番号・版違い・片数/byte/内容破損・不正Unicodeを拒否し、2秒を超えた組立は受理しない。再接続は新しい組立器を作る。新しいsnapshotや通常stateは未完の古いsnapshotを置き換える。
- checksumはUTF8の32bit FNV-1aで、誤り検出の整合チェックである。認証や暗号学的な改ざん防止とは扱わない。
- 分割するのは完成JSON文字列で、値と構造をそのまま結合するため、tupleの武器精度・BASTION角度・省略cache・入力契約・権威Worldは変わらない。旧画面の従来経路、新画面が旧サーバーを読む経路も維持する。新しい保証の対象は分割対応画面の最大256KiBで、旧画面や超過時まで保証しない。

### 分割コストの見直し

初回は最大片長を二分探索し、1片に十数回のJSON.stringify/TextEncoderを使っていた。主担当の自己レビューを受け、16,384 UTF-16単位の固定slice（surrogate境界補正）へ変更。通常のJSONは片が概ね49KiB以下となる。実際のframe長を検査し、例外的なエスケープ膨張時だけ半分へ縮める。通常の64KiB以下送信では追加のUnicode/checksum全走査を行わない。線形量の処理を優先し、最少片数を最適化しない。

### 分割の検証

新規25件成功。64KiBと256KiBの境界、日本語/絵文字/引用符/逆斜線、全片まで非公開、2秒期限、版/連番/順序/重複/旧snapshot、前半・後半の破損、同長の内容破損、再接続、旧サーバー、通常messageの実UTF8上限、state以外の組立拒否を確認した。

合成した96PLEAT・295弾・160オーブでは、身体と全脚点を同じ壁面基底へ回転して数値を整合させた。敵・弾・オーブを省略せず、各片64KiB以下の往復と両Network経路で全片後だけ受信することが成功した。これらは合法な個体数・姿勢形式の合成試験であり、その全体配置を実戦の生成経路で同時に再現したとは扱わない。初回の合成は脚点だけ水平のままで64,261バイトと分割不要だったため、期待値を緩めず、身体と脚点の基底を揃えて分割条件を作り直した。

最終実行:

`node node_modules/vitest/vitest.mjs run tests/state-chunks.test.ts tests/state-tuples.test.ts tests/state-wire.test.ts tests/front-wire-pressure.test.ts tests/front-network-input.test.ts --maxWorkers=1`

5ファイル66件成功（4.72秒）。client/worker両tsconfig、担当コード5ファイルのPrettier、git diff --checkも成功。実4ブラウザ・1000弾分割・500ms停止からの復帰・分割状態からの再接続・全描画数は主担当が別途統合検証しており、本担当の成功へ混ぜない。製品ソースは主担当の統合検証開始時に固定した。ローカル局所コスト計測は統合ブラウザ試験を汚さないよう保留中で、線形化だけで本番の速度改善を断定しない。

### 局所コストの追加計測（統合ブラウザ検査終了後）

主担当の終了通知を受けて1回だけ実施。WindowsのNode v24、ASCIIのJSON文字列、暖機2回＋各10標本。対象はtransport単独で、World検査・tuple復元・描画・実Workerは含まない。数値は中央値、少数標本のため本番性能の保証や改善率には使わない。

|元JSON bytes|片数|最大片bytes|sender ms|receiver ms|JSON.parse単体 ms|
|---|---:|---:|---:|---:|---:|
|4,096|1|4,096|0.011|0.032|0.006|
|64,000|1|64,000|0.124|0.447|0.113|
|180,000|11|16,506|1.727|2.155|0.104|
|262,144|16|16,507|2.297|2.705|0.130|

最大標本は、64,000Bの受信0.818ms、180,000Bの送信2.686ms/受信4.589ms、262,144Bの送信2.707ms/受信3.071ms。通常送信に追加のUnicode/checksum全走査はないが、実UTF8上限検査のTextEncoderは必要である。受信はUnicode・byte上限検査が加わるため、JSON.parse単体より増える。線形化後も負荷0とはせず、主担当の1人/4人実通信の時計・入力・描画の統合検証で判断する。

ローカル補助証拠: `dist-validation/coop-comfort-20261030/state-chunks-cost.json`。計測後は製品変更とテストCPU使用を止め、主担当の30秒×1人/4人時計計測へ引き渡した。

主担当の同一製品コードによる再検証では、400弾/1000弾の全描画・GLエラー0・500ms停止復帰・分割再接続が成功したとの通知を受領した。一方、その前のheavy400待機タイムアウト1回の原因は未確定。読み取りではNodeも同じAssembler→restoreStateTuplesを利用しており、ブラウザ固有の新しい拒否条件は発見できなかった。成功した再試行を原因特定や初回成功の代わりにしない。主担当の統合証拠を参照する。
