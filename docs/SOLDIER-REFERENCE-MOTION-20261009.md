# 参照画像から制作した兵士のモーション修正

## 状態

制作途中。ローカルのゲーム読み込みを新兵士へ変更し、実表示検証待ち。公開版は未変更。旧モーションはユーザー不承認であり、静止ポーズ検査の成功を動作の合格として扱わない。

作業ブランチ: `codex/soldier-motion-reference-20261009`。基準: `de67860cfae978f3ee0bbd6784fc33a38ce68686`。

制作場所: `C:/Users/futsa/Documents/Codex/2026-10-07/https-x-com-dstudio-ai-status/soldier-motion-20261009`。

Git作業場所: `C:/Users/futsa/Documents/Codex/2026-10-09/swarm-soldier-motion`。

## 今回の変更

- QuaterniusのCC0アニメーションを元に歩行・小走り・走行などを転送。接地高さ、周期の終端、A/Tポーズの差を補正。
- 銃構え・射撃・装填は既存ゲームのクリップを転用した候補。Adobe Mixamoの公開プレビューを見本として確認したが、そのデータは取得していない。
- 左右の小指の骨が前腕付近に残っていたことを検出。小指の骨と誤った頂点重みを修正し、掌の方向の計算も修正。
- 右手のグリップ、左手の支持位置と手の向きを調整。装填の開始・終了に支持手の補正を滑らかに加え、中間の手の移動を保持。
- 比較画面に動作選択・速度・時間・手元拡大を用意。単発動作は終了時に停止。
- 肩と胸の既存シアン塗装を4色へ切り替えるシェーダーを追加。シアン/オレンジ/パープル/ライム。Chrome接続は復旧し、肩の4色切替を実描画で確認。ゲーム内の識別性は未検証。

## 素材と再生成

素材は `assets/blender/source/swarm_soldier_20261009/`。ファイル対応とSHA-256は同フォルダーの `manifest.json`。

入力 `soldier-rig-input.blend` は兵士本人の頭・体・骨格だけを保持する。制作キットの隠し素体、サンプルメッシュ、不要なリグを含む元のローカル中間ファイルは配布しない。元キット正本は変更していない。

保存先の `soldier-motion-20261009/` で、Blenderのバックグラウンド実行により次を順番に実行する。

1. `retarget-ual.py`
2. `retarget-combat.py`
3. `polish-motion.py`
4. `check-motion.py` と `render-combat-check.py`
5. `export-game.py`、通常Pythonで `check-game-export.py`

ゲーム用GLBは32動作、必須57骨と左右の武器/背面接続点を持つ。`SoldierBasis`でゲームの前方へ合わせ、メッシュ名とHead骨名の衝突を解消。ローカルの `public/assets/characters/swarm-soldier.glb` は検査後の出力。ゲーム用の4人確認画面は `npm run dev -- --port 5196` から `/soldier-review.html` を開く。通常ゲームと同じStandardTrooperを使用するが、通信/実プレイ検証の代替ではない。

`inspect-export.py` は通常のPythonで実行する。`repair-hand-rig.py` は元のローカル中間データに対する修正記録で、通常の再生成は修正済み入力から開始する。

ローカルHTTPサーバーで素材フォルダーを配信し、`soldier-motion-20261009/review.html` を開く。プレビューの左側はQuaterniusまたは既存ゲーム、右側が修正候補。キットの従来の歩行プレビューには、この新クリップは自動反映されない。

Quaterniusのライセンスは同梱 `source/ual/Animation Library[Standard]/License.txt`、Three.jsは `vendor/THREE-LICENSE.txt`。元の参照URLと用途は `reference-plan.json`。

## 検証と残件

- `hand-rig-check.json`: 54骨、体27,661頂点、指の骨位置・影響頂点・重み総和・余分なオブジェクトの検査。
- `export-check.json`: GLBのアニメーション名、時刻単調性、有限数、回転四元数。
- `motion-check.json`: 足裏の座標と周期差、武器を基準にした手首の移動量。単発動作や装填中の意図的な手の移動はループ不良と混同しない。
- `walk-jog-sprint.mp4`: 前段の歩行系確認動画。以後の変更は手元が中心で、最終GLBと動画の同一ハッシュを主張しない。
- `grip-side-repaired.png`: 短い銃構え候補の側面。全動作の合格証拠ではない。

`game-contract-check.json`: 32動作、必須57骨、2メッシュ、骨がskin jointとして存在すること、主要動作の必要チャンネル、有限数/単調時刻を検査しerrorsは空。ゲーム用GLB SHA-256は `baac565a5fe849078887ebd5bbb42a1cec65804ad387f8fee3c5af68bcc801eb`。型チェック成功、関連単体テスト `tests/standard-trooper.test.ts` 4件成功。これらは視覚品質の証明ではない。既存のmotion-checkと動画は拡張前の候補を対象としており、32動作全体の検証済みとは扱わない。

残件は全動作の見た目確認、散弾銃/ロケットの装填調整、ゲーム内の4色識別性、武器接点・移動速度同期、実プレイ、ビルド、所定の独立監査と公開。走行の参照クリップは下半身だけを適用し、武器の構えを上書きしないよう修正した。ローカル確認サーバーは起動済みだが、この記録時点で4人画面はまだ実表示未確認。

ブラウザ操作の再初期化後に接続IDが変わり、一時的に比較画面へ接続できなくなった。新しい一覧で同じChromeとタブを特定して復旧し、ユーザー側の再接続操作は不要と案内した。モデルID・推論設定は未確認。
