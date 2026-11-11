# 融合成長での表示用等級のずれ（未修正）

融合成長の防衛戦について、新形式のSG-7とAR-9を各等級で装備した状態から、実際の候補 `blast-radius` を `chooseFrontUpgrade` で選択。SG-7の等級0〜4は選択後、表示用 `weaponTier` がそれぞれ1〜5となり、新形式を示す `format: 2` が失われた。最高等級で5を参照するが、武器GLBは0〜4まで。実画面や実通信で表示がどうなるかは未確認。

検証時は全選択に成功。SG-7のdamage・mag・reload・range・intervalは前後でほぼ一致し、最大差はreloadの浮動小数点差約2×10⁻¹⁶。この候補・装備の検証であり、全強化や全武器の戦闘値を保証しない。`src/shared/front-run.ts` の戦闘用投影は計算済み数値を旧形式で保持するため、単に `format: 2` を戻すと `stats` が新形式の計算へ切り替わり、戦闘値を変えるおそれがある。

修正候補は、戦闘用投影に元の表示用等級を0〜4で任意保持し、モデルの選択とネオン表示だけに使う方式。通信される武器情報への追加となるため、形式変更の承認、旧クライアント互換、保存・通信・等級全種・戦闘値を検証する必要がある。現時点では製品コードも通信形式も変更していない。この案以外の可能性を排除するものではない。

再現は作業worktreeのルートで `node -e "require('esbuild').buildSync({entryPoints:['scripts/weapon-front-tier-observe.ts'],bundle:true,platform:'node',format:'cjs',outfile:'dist-validation/front-tier-observe.cjs'});"` の後、`node dist-validation/front-tier-observe.cjs`。
