# LEAPER 残存支柱2本の除去

2026-09-12、ユーザーの「脚から腰に向けて黒い棒2本が貫通して飛び出す」修正依頼。既存LEAPERの不具合修正であり、新造形の提案ではない。

## 原因と修正

旧HOUNDの `ring_support_L/R` がLEAPERのリング除去時に残存。元の骨割当が末尾L/Rを前脚と判定したため、2本が `front_L_upper/front_R_upper` に追従し、深い屈伸で胴体を突き抜けて見えた。

残存部品は `HOUND_edge_metal` 内の各96頂点。glTF座標の中心は (-.215,1.265,.325) と (.475,1.22,.445)。元生成器の2本と一致する。初期の胴体への付け替え案も画像で確認したが、接続先のリングが既に存在せず支柱が突き出すため採用せず、最終版は2本の88三角形のみを除去する。

`repair.mjs` は元GLBのSHAを固定して読み、対象の材質・骨・座標・頂点数を照合して対象三角形だけをインデックスから外す。頂点・skin・材質・texture・animation・他primitiveはバイト同一。元GLBとBlenderファイルを上書きしない。旧Blender生成器から再生成する場合は、この後処理を再実行すること。元ファイル単体には修正は含まれない。

出力: `leaper_motion_v2.glb`。採用コピー: `public/assets/enemies/leaper_motion_v2.glb`。最終SHA-256: `f277b504b7244f144f5e31393c896e25f76cc5508a759bee432e886bd8323f01`。旧SHA: `3b0f46e012b0d1eebe3db54dc1e7fe85b0f90f901081d5dad8139c30cb0b57f0`。未参照となった頂点は安全な差分最小化のためバッファ内に残すが、描画には一切使わない。

HP・速度・高度・AI・判定・攻撃時刻/弾原点・通信・名称は維持。骨20、材質/mesh4、全クリップとレポート専用IKも維持。描画三角形は88減少し、draw call増加なし。ゲームとレポートで共通のLEAPERだけv2を読む。VOLLEY等は変更しない。

## 検証と証拠

- 開始branch `codex/home-armory`、base/head `4186f25f7c9695f95ea897ad182db5f85fac3091`、未コミット。開始前の変更を保持。
- 型チェック、関連7テスト、client build、loaderのdiffチェック成功。
- `binding-checks.json`: 88三角形だけを除去し、対象以外のバイナリを保持する自動検査。
- `scripts/check-leaper-supports.mjs`: GLB再読込と実GPUパレット経路で4方向×屈伸/空中の比較PNGを作成。左右/背面の画像を実際に開いて確認。
- 修正前の2本は胴体基準で移動時最大0.53548ずれる。最終GLBでは2本の全192頂点が描画インデックスから参照されていないことを確認。after-checksのworstは残した未参照頂点の参考値で、表示物の移動量ではない。
- 証拠 `dist-validation/leaper-rods/`。`loader.patch` は今回開始時との差分。付け替え案の証拠はbinding-only-*で区別。

実機スマホの性能測定と動画再生は未実施。静止画シーケンスでの動作確認。

配布版PC/横持ち（1280×800 / 915×412）の全7表示・移動/攻撃/停止・出撃/撤退、JS/CSS/GLB一致、例外0を確認。公開Version: 2480abe0-8260-4915-92be-3301c34f3e65。初回の公開は自動承認レビューが今回の承認不明として拒否したが、適用AGENTS第3行の継続公開承認を再読して提示し、再実行が許可され公開成功。
公開版もPC/横持ち両サイズの全7表示・再生切替・出撃/撤退成功、JS/CSS/GLB一致、例外0、health 200 / ok:true。証拠: dist-validation/leaper-rods/published-checks.json。
