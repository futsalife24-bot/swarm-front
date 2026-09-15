# 兵士の停止・構え v7（2026-09-11）

走りから立ちへ切り替わる際の脚の停止・跳ねを修正。立ちは足首間54cm、前後差14cm、つま先を外へ約6度、腰を3.5cm下げ、膝を緩めた射撃姿勢にした。ゲームの移動速度・射撃・装填・切替時間は変更していない。

## 原因と変更

`slerpQuaternions(from.q, b.quaternion, weight)` の出力が第2引数と同じオブジェクトになっていた。Three.jsの実装は先にfromを出力へコピーするため、関節が途中で回転せず、補間終了時に到達姿勢へ跳ねていた。到達姿勢から元姿勢への `slerp(from.q, 1 - weight)` に修正。

上半身と下半身の切替状態を分離。走りから構えへ0.18秒、走り始めは0.10秒、その他は従来相当の0.08秒で補間する。射撃・装填の状態変更で脚の切替を再開始しない。向き戻しも0.18秒の滑らかな曲線に合わせ、照準・腰回転を重ねる前の姿勢を保存して回転の二重適用を防ぐ。

回転だけの補間で足先が地面を横切るため、通常移動と構えの間では足首の位置・向きを補間し、2関節IKで膝を追従させる。靴の頂点から求めた足裏で地面の下へ入る目標を補正する。回避・大型被弾の専用演技にはこの接地補正を掛けない。足の接地判定は既存の兵士と同じ平面Y=0を前提とする。

## 成果物と再生成

- `src/client/standard-trooper.ts`：補間・接地・腰の向き戻し、v7読込。
- `assets/blender/scripts/build_trooper_stance_v7.py`：v6原本から立ち4クリップを再生成。
- `assets/blender/candidates/trooper/stance-v7/trooper_stance_v7.blend`：新しい編集原本。元v6を保持。
- `public/assets/characters/standard_trooper_v7.glb`：立ち4クリップを移植。v6の形状・骨格・材質・残る14クリップを保持。
- `assets/blender/candidates/trooper/stance-v7/review.html`、`scripts/check-trooper-stop.mjs`：実モデルの停止計測・正面/側面/連続画像。
- `scripts/check-trooper-stop-game.mjs`：開発ビルドでPCの実入力と内部状態を検証。
- `scripts/check-trooper-stop-distribution.mjs`：配布・公開ビルドで横持ち画面の読込、射撃・切替・回避を検証。
- `src/client/changelog.ts`、`docs/STATE.md`：更新記録。

Blender 5.2.1 LTSで、gameを作業ディレクトリとして `blender --background --python-exit-code 1 --python assets/blender/scripts/build_trooper_stance_v7.py` を実行する。

## 検証と制約

型チェック、関連9単体テスト、production client build、Worker dry-run成功。既存の500KB超チャンク警告あり。Worker dry-runはsandboxのログ・親フォルダ読取制限で一度失敗し、通常権限で成功した。

Chromeで実StandardTrooperを使い、武器3種×5方向×30/60/120fpsの時間刻み×4停止タイミング＝180条件を検証。全条件で有限姿勢、0.18秒の停止補間完了、足幅50cm以上、靴底の貫通5mm以内、補間最終フレームの足首移動6cm未満を確認。最低足裏高さは約+0.97mm、補間最終フレームの足首移動は最大約1.63cm。詳細実測値は `dist-validation/trooper-stop/browser-checks.json`。途中の回転が凍結する修正前の診断は同フォルダの `detail.json`。

連続描画による負荷で最初の計測を中止し、全条件の数値計測と代表姿勢の描画を分離して完了した。初回実ゲーム検証は開発サーバーの更新でページが再読込されたため無効。次に配布ビルドへ開発専用診断の待機を誤適用して時間切れとなった。開発側の内部状態検証と配布側のDOM/アセット検証に分けて再実行した。

実スマホ・インターネット協力・斜面での接地・実機FPSの測定は未実施。独立Chat監査は今回実施していない。

## 差分の正本

branch `codex/home-armory`、base/head `2be699f160c83d641fb68bb1304e4da8059920dc`。既存の未コミット・未追跡差分を保持。commit/mergeなし。今回の変更前ファイルは `dist-validation/trooper-stop/before/`、今回だけの差分・ハッシュは同フォルダ上位の `task.patch` と `checks.json`。

公開状態・最終実ゲーム結果は下記の追記を正とする。

## 公開・最終結果

PC 1280×720の実入力で移動・両武器の射撃・切替・回避・復帰が成功。横持ち844×390の配布版でJS/4GLBの一致、読込、射撃、切替中の射撃抑止、回避を確認。いずれもJS例外なし。開発用診断のない配布版はDOMと実アセットで確認した。

既存Workerへ公開済み。Version `fc8ee188-e5f0-4417-9acd-0c81e833d9b7`。公開先 https://swarm-front.melosalife-24.workers.dev 。公開JS/CSS/新兵士GLB/既存契約JSON/武器3点の7ファイルがdistとSHA-256一致、API healthは200/ok。公開兵士GLBのSHA-256は `fb477da790f8644657409171d474fda4d2117fbd52fadd43e113bea1464e74ec`。公開確認はsandboxのネットワーク制限で失敗し、通常権限で再実行した。

公開版の横持ち844×390でもモデル読込・射撃・切替中の射撃抑止・回避、JS例外なしを確認。`dist-validation/trooper-stop/published-validation.json` を参照。
