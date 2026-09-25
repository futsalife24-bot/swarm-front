# HARROW v10 検証

2026-09-25。単体候補。ゲーム差し替え・公開・ユーザーの造形承認は未実施。

- 最終GLB SHA256: `d8bc54ef568b5e8995ca3d5ac01ed3273c19ca07babc14294d7df367d9a8ff75`。
- 184 Blenderメッシュ / 186 GLBプリミティブ、39骨、12動作、84,508頂点、153,856三角形。
- `verify_render.py`: 別Blenderプロセスで保存原本とGLBを再読込。全動作・全40Hzフレームで有限行列、ウェイト、Root固定、脚関節の接続、ループ端点を確認。PASS。
- `verify_asset.mjs`: Three.js再読込で骨を60Hz、全変形頂点を10Hzで確認。全12動作PASS。Flightの最大ループ行列差 `1.90e-7`。空中クリップは原点の下へ翼が伸びるが、既存高度34.5mを加えた地表クリアランスは正。地上Spinの微小誤差は約 `-2.49e-6` authored m。
- `verify_change.mjs`: 胴体以外の183メッシュの全頂点属性・面インデックスはv9と完全一致。Flight/AirThreat以外の10動作は同じ時刻・トラック構成で値差 `1e-5` 未満。Flightの胴体は一定、左右の周期数7/5、周期長の変動を確認。PASS。
- 部分修正に伴う首接続の再サンプリングは連続胴体オブジェクト内に含まれる。頭・翼・脚・尾のメッシュは上記一致検証の対象。
- 実GLBの側面・斜め前からの胴体近景、飛行、背面を目視確認。新旧は同じカメラ・縮尺で比較。8枚は `dist-validation/harrow-v10/`、対象SHAは `renders.json`。
- オフラインHTMLは新旧GLBとThree.jsを埋込。HTTPで同一HTMLを表示し、WebGL実再生と動画保存を確認。ローカルfile://としての起動は未確認。サーバー版は `node assets/blender/candidates/harrow/v10/make_review.mjs --serve`、`http://127.0.0.1:5200/`。
- `flight.webm` をブラウザで読み戻し、再生・1920×945・約16.43秒の動画を確認。全フレームの衝突を動画目視だけで保証しない。
- プレビューTSは `tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck scripts/harrow-v10-preview.ts` 成功。
- プレビュー `56da5e1` ではSkinnedMeshの誤カリングと地上姿勢の近景カメラを修正。HTML再生成後、Flight→Idleの頭部・胴体表示とFlight全身表示を実ブラウザで確認。
- 独立監査F1/P2の版切替競合を、最新request IDだけがsceneを更新する仕組みで修正。`harrow-v10-load-gate.test.mjs` はv9→v10とv10→v9の両方向で逆順完了を強制し、最後の選択と再生時間が一致してPASS。再生成HTMLの実ブラウザでも両方向を確認し、v10は16.8秒、v9は4.2秒、console error/warnなし。モデル本体は不変。
- 試作段階のTakeoffに地面貫通を検出し、最終版では元のTakeoffを保持。試作時の鱗の突出を低くし、腹鱗の分割継ぎ目を解消。
- このworktreeに `.meloso-judge/run.cjs` は未導入。Judgeは未判定・通信なし。モデル候補のみのため無関係なゲーム全件テスト/ビルドは行っていない。

## 再生成

Blender 5.2.1 LTSで `build_harrow.py` → `verify_render.py` → `render_final.py`。Nodeで `verify_asset.mjs`、`verify_change.mjs`、`make_review.mjs`。必要入力は同じフォルダー内に保存。既存のv9とnode_modulesは比較・WebGLプレビュー生成に必要。

## 制約

ランダム周期は16.8秒の有限ループへ焼き込んだもの。再生のたびに新しい乱数を引くゲーム実装ではない。胴体コアは内部設定として扱い、新しい露出器官や弱点を追加していない。ゲームへ採用する場合は空中ミサイルの発射器位置と実弾の整合、実GPU経路、既存予算を別途検証する。実スマホ性能・戦闘採用は未確認。
