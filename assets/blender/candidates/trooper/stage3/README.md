# 第3段階：連続動作（制作中）

第2段階の独立監査合格版 `../stage2/trooper_stage2_refined.blend` を保持。第3段階は `trooper_stage3_animated.blend`。初回中間監査はライフル→ランチャー／逆方向の切替だけ。

## 現行実装との照合

- `src/shared/defs.ts`：切替0.5秒、回避0.32秒、回避後の切替再開待ち0.08秒、強被弾1.2秒。
- `src/client/standard-trooper.ts`：元Actionの1秒を0.5秒へ再生。45%（元frame27、実時間0.225秒）で旧武器をそのスロットの背面ソケットへ。60%（frame36、0.300秒）で新武器を右手ソケットへ。イベント自体はゲームコードでの再接続であり、GLBの親子切替アニメーションではない。
- 今回の代表はslot0=rifle／slot1=rocket。背面ソケットは武器種ではなくスロット対応。逆順の武器ロードアウトやショットガンの切替は、この代表往復の合格だけでは保証しない。
- `src/shared/game.ts`：切替で装填を取り消す。回避中は切替進行を停止し、終了後0.08秒待って再開。通常の強被弾は切替進行を止めず、描画側は上半身切替＋下半身被弾を重ねる。死亡・実入力の整合は第4段階で確認する。
- 元15ActionにReloadはない。現行描画には装填用clip選択がないため、P3-02の装填動作を作る際は新規試作Actionと将来の接続要件を明記する。ゲーム本体の変更はまだ行わない。

## P3-01の作り方

`build_switch.py` は元15Actionを保持し、`Trial_Switch_1_to_2` / `Trial_Switch_2_to_1` を追加。合格した保持姿勢を端点とし、肩の外側→背中の後方→格納点を経由。手が届く範囲で運搬経路を置き、手首/肘を2骨IK計算し、指は合格した局所握りを使用。補助の制約・骨を保存せず最終ローカル変換を毎フレーム記録。

`render_switch.py` は保存blendを再読込し、Actionを初期化して時間を進め、現行イベント時刻に応じた武器ソケット行列で2丁を表示する。通常表示に身体/武器の消去はない。`--quick` は接触付近を含む14フレームの自己確認用。連続動画は元frame0〜60の偶数フレームに25/27/35/37を加えた35枚を、元フレーム間隔に沿って通常0.5秒と25%低速で再生する。通常動作は実時間60Hz、付け替え付近のみ120Hz相当の画像サンプル。

## 第3段階で見つかった問題と限定修正

- `mount-change-approval.md` の追加承認によりBackWeaponSocketだけ65mm後退・銃身軸180度反転。別名試作で小さな固定具の接続長も調整。他56骨のbind、原本15Action、手袋形状は不変。4×4行列は `approved-bind-change.json` に座標系を分けて記録。
- 第2段階の腰ウェイト処理の境界が上腕内側へかかり、背面到達で布が飛び出す原因になっていた。保存された腰修正前メッシュの表面から肩・脇のウェイトだけ復元し、局所の隣接頂点間で8回平滑化。身体の頂点座標・面構成は不変、z1.08m以下の腰と膝は変更なし。`restore_axilla_weights.py` / `axilla-weight-change.json`。
- 肩防具を覆う上腕の向きを保ち、前腕は前フレームから連続した回転を使用。肘の経路は武器からの距離と全フレーム間の連続性を合わせて選択。指の握りとソケットの同時刻接続は独立して保持する。
- ライフル左手の支持位置を20mm下げ、手首付近の接触を局所調整。影響確認としてライフル保持、背面到達、背負い武器ありの丸まりを再撮影。

`validate_switch.py` は第2段階と全57骨bind、全メッシュ座標/面/ウェイト、元15Action全カーブ/キーを比較。付け替えは同一時刻の右手/背面ソケット行列で測る。半フレーム刻みも含め有限座標、scale、手首追従を確認。数値検証と視覚監査を分離する。

## 提出と再現

P3-01初回提出は `submission1/` に保存。試作SHA256は `626A308CF61D940DB3B0E6885D14ABB9812BA5B5EF802918A6CC8DD7FF0E1771`。各資料のハッシュとサイズは同フォルダーのmanifest.json。監査結果は `audit-round1-contacts.md`。背面配置・静止握りは提示範囲で合格、C1〜C3の局所接触確認は保留。P3-02へは未進行。

現在のstage3直下のblendは修正中の作業候補で、submission1とは異なる。直下の既存MP4・全身連番は初回提出の画像であり、作業候補の最新状態を表さない。修正版動画は再レンダー・再検証後にsubmission2へ凍結する。

`C1_contact.jpg`〜`C3_contact.jpg` はsubmission1の保存モデルを用いた追加の通常/半透明確認。いずれも正常接触と断定できず、局所修正対象とした。`P3_extra_clearance_idea.jpg` は修正中モデルのF27を使った追加相談資料。右列はランチャーの表示位置のみX+150mmした配置図で、ソケットの変更・blend保存・固定具改修は行っていない。監査役へ4枚を送信し、BackWeaponSocket_2の横移動を限定試作してよいか相談中。

再現はstage3直下のスクリプトを使用する。submission1は提出時点の記録で、隣接stage2の補助スクリプトを同梱した独立パッケージではない。Blender 5.2.1 LTSで以下を順に実行する（`blender` はインストール済み実行ファイルへのパス）。

```powershell
blender -b --python build_switch.py
blender -b --python validate_switch.py
blender -b --python render_switch.py
blender -b --python render_mount_checks.py
python make_video_frames.py
python make_stage3_boards.py
blender -b --python encode_switch.py
```

画像構成にはPillowを使用する。再現時はstage1/2の保存版とstage2/render_poses.pyを維持する。BlenderはPython例外でも終了コード0になる場合があるため、各ログの完了表示と成果物を確認する。`review.html` をstage3フォルダーのローカルHTTPサーバー経由で開くと4動画を選択できる。testで始まる旧動画は出力経路の試験用で、提出版ではない。

P3-02/03の全動作、GLB、実ゲーム確認は未完了。元のモデルやゲーム本体への適用・commit・push・公開は行っていない。
