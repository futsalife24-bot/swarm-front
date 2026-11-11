# 融合成長での表示用等級のずれ（未修正）

融合成長の防衛戦について、新形式のSG-7とAR-9を各等級で装備した状態から、実際の候補 `blast-radius` を `chooseFrontUpgrade` で選択。SG-7の等級0〜4は選択後、表示用 `weaponTier` がそれぞれ1〜5となり、新形式を示す `format: 2` が失われた。最高等級で5を参照するが、武器GLBは0〜4まで。実画面や実通信で表示がどうなるかは未確認。

検証時は全選択に成功。SG-7のdamage・mag・reload・range・intervalは前後でほぼ一致し、最大差はreloadの浮動小数点差約2×10⁻¹⁶。この候補・装備の検証であり、全強化や全武器の戦闘値を保証しない。`src/shared/front-run.ts` の戦闘用投影は計算済み数値を旧形式で保持するため、単に `format: 2` を戻すと `stats` が新形式の計算へ切り替わり、戦闘値を変えるおそれがある。

修正候補は、戦闘用投影に元の表示用等級を0〜4で任意保持し、モデルの選択とネオン表示だけに使う方式。通信される武器情報への追加となるため、形式変更の承認、旧クライアント互換、保存・通信・等級全種・戦闘値を検証する必要がある。現時点では製品コードも通信形式も変更していない。この案以外の可能性を排除するものではない。

再現は作業worktreeのルートで `node -e "require('esbuild').buildSync({entryPoints:['scripts/weapon-front-tier-observe.ts'],bundle:true,platform:'node',format:'cjs',outfile:'dist-validation/front-tier-observe.cjs'});"` の後、`node dist-validation/front-tier-observe.cjs`。

## 表示等級を追加する隔離試作（未採用）

新形式Nと旧形式Rの正規装備は、同じ強化選択後に戦闘用投影が完全に同一になる例を確認。投影済み武器データだけでは元の表示等級0と1を区別できない。他の情報を使う方式はこの結果だけでは否定できない。

製品コードの仮変更をビルド時のメモリー上に限定し、投影に `appearanceTier` を付け、表示に利用する案を試した。SG-7新形式5等級と旧形式4等級、計9条件で選択前の表示等級を維持し、試作の戦闘用投影から追加項目を除いた内容と `stats` は現行版と一致。通常JSON・tuple v1/v2での符号化・復号と装備キャッシュ復元を関数単位で検証し、既存の復号・キャッシュコードでも追加項目を含む武器データが復元された。旧クライアントの実接続や見た目、実通信、スマホ、全強化・全武器は未確認。

ただし、試作の共通表示等級関数は未信頼入力の `appearanceTier` も優先し、新形式Nに値4を付けた入力を `validBattleWeapon` が受け入れる例を関数単位で確認した。通信による実攻撃は未検証。このため試作は不採用で、元装備からの算出と未信頼入力の除去・拒否などを含む設計が必要。[結果](front-tier-prototype-result.json)。

再現は作業worktreeのルートで `node scripts/weapon-fusion-tier-build.cjs` の後、`node scripts/weapon-fusion-tier-run.cjs`。前者は仮変更済みと現行の実行ファイルを `dist-validation/` に生成し、製品のソースは変更しない。

## 持ち込み値を拒否する第2隔離試作（未採用）

正規の元装備から表示等級を算出し投影に追加、共通の `weaponTier` は変えず描画側専用の関数を使用。出撃時の `validBattleWeapon` では同名項目を持つ入力を拒否した。新5等級・旧4等級の同じ強化選択で戦闘値は現行投影と一致し、表示等級・ネオン色・GLB読込URLも元等級に一致。GLBの読込はスタブで、実ファイル・実画面は未確認。通常JSON・tuple v1/v2の復号と装備キャッシュを関数単位で確認し、基点と同じ旧受信コードも追加項目を保持した。旧クライアントの表示が修正されることは意味せず、新旧混在の実通信は未確認。偽装した入力は検証関数と `createFrontRun` の直接入力で拒否したが、実ネットワークでは未確認。[結果](front-tier-safe-result.json)。

互換上の課題として、従来の保存検証を通る同名未知項目付き武器が、試作の出撃検証では拒否される。実際の保存データに存在するかは未調査であり、この試作を製品へ採用していない。全強化・他モード・実ゲーム・保存・スマホも未確認。通信する武器情報の追加と入力検証変更は承認対象として扱う。

再現は `node scripts/weapon-fusion-tier-build.cjs`、`node scripts/weapon-fusion-tier-safe-build.cjs`、`node scripts/weapon-fusion-tier-safe-run.cjs` の順。いずれも作業worktreeのルートで実行し、仮変更はビルド時のメモリー上だけに適用する。
