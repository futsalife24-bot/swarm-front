# タタラ・ローポリ試作01

2026-11-04。最初の1体を本人が外観判断するための素材と独立プレビュー。
まず [確認資料](review.html)、[元絵比較](review/comparison.png)、[8秒動画](review/tatara-motion.mp4) を開く。

## 担当範囲と判断

元repositoryとdist-hを編集せず、最新main取得時点 `24cbbae65568c9a034214a421e13627abfd886f9` から専用worktree・branchを作成した。
既存companion試作はヒサシ／ハコビの仮形状で、今回の5体の造形作業は見つからなかったため、本人推奨のタタラを選択した。
低い幅広胴体、大きな平掌、太い腕を維持しやすく、低密度の面と動きの基準試作になるため。

元絵は `output/buddy-five-20261030-v1/concepts/03-tatara.png` を実見。無変更コピーが [concept.png](concept.png)。共通設計と設計詳細も参照したが、旧能力・数値・由来は採用していない。
火炎／氷結／電撃等の属性割当は未定。ゲーム処理・カード・メニュー・保存・main・公開は無変更。残り4体は制作していない。

## 納品物

|対象|ファイル・値|
|---|---|
|編集可能な原本|[tatara.blend](tatara.blend)、164,564 bytes|
|ゲーム用素材|[tatara.glb](tatara.glb)、332,424 bytes|
|三角形／材質／骨|1,796／1／8（root含む）|
|形状|1 skinned mesh、1 primitive、不透明・頂点色|
|テクスチャ|0枚、サイズ該当なし。白線も同一材質の頂点色|
|寸法|幅1.350m、奥行1.154m、形状高0.650m。静止時の下端Z=0.015m、上端Z=0.665m|
|比較兵士|製品 `public/assets/characters/swarm-soldier.glb`、縮尺1、約1.67m|
|動作|Idle 約2.03秒、Follow 約1.10秒、Palm 約1.63秒|
|動画|[tatara-motion.mp4](review/tatara-motion.mp4)、8秒／30fps／960×640／H.264、378,933 bytes|
|比較・方向・大きさ|[comparison](review/comparison.png)、[directions](review/directions.png)、[scale](review/scale.png)、[game-sizes](review/game-sizes.png)|
|再生成・確認|build.py、roundtrip.py、server.mjs、preview.js、index.html、check.mjs、video.mjs、sheets.py|

小穴、ひび、繊維状の関節、内部構造、細かな岩の積層を省略。岩殻と腹の色面、眉のような板、三本の指＋親指へ整理した。元絵より大きな面・明るめの表示で、写実的な岩肌は再現していない。肩の白い二本線を維持。背面の印は岩に隠れやすく、遠景の味方識別は輪郭が主になる。

## 検証済み

- Blender 5.2.1 LTSで生成・保存。GLBをThree.js 0.185.1／Chrome 156.0.8078.80へ別途読み込み、正面・側面・背面・斜めと3動作を画像確認。
- 保存blendを開き、GLBを再インポートして形状境界を照合。差0m、1,796三角形・1材質・8骨・頂点色・不透明・テクスチャ0・3クリップ保持。各動作の変形頂点の最大変位：待機0.016m、歩行0.066m、掌0.283m。詳細 [roundtrip.json](review/roundtrip.json)。
- 横画面844×390／640×360、devicePixelRatio=1。通常距離のGLB描画を確認。画角65度、yaw/pitch=0、遮蔽物なしを `src/shared/aim.ts`・`src/shared/game.ts:aimCamera` に準じて再現。カメラ座標(-0.187,2.853,4.955)、注視(-0.95,1.5,-30)。バディは兵士の前方1.2m、4体は1.6m×1.5m間隔の比較配置。実製品のRenderer・追従機構・ゲームUIの試験ではない。
- 四方向と動画の代表フレームを目視。低い輪郭と掌は読み取れる。通常距離の白線は小さく、白線だけで味方を識別できるとの合格判定はしない。4体は兵士と一部重なり、将来の追従位置・遮蔽調整が必要。
- ローカル専用プレビューの最終実行はページ例外・コンソールエラー0。640×360で動作／視点／体数の選択、停止・再開、横はみ出しなしを確認。動画は240フレーム・8秒をffprobeで照合し、資料ページで1秒以上の実再生・エラーなしを確認。詳細 [ui-validation.json](review/ui-validation.json)。JS構文とGit差分の空白検査成功。

## 負荷比較の条件と結果

PCのheadless Chrome。静的な製品兵士1体・床・グリッドを固定し、バディ0／1／4体だけ変更した。4体は「4人が各1体」の仮定で、製品の確定上限ではない。
アニメーション有効、各条件30フレームの準備後120サンプル。影なし／DirectionalLightの1024²シャドウマップ1枚ありを比較。透明モデルと属性エフェクトは0。

|バディ数|影なし描画回数|影あり描画回数|844×390・影ありCPU中央値／p95|640×360・影ありCPU中央値／p95|
|---|---:|---:|---:|---:|
|0|4|6|0.60／0.90ms|0.60／1.20ms|
|1|5|8|0.50／0.90ms|0.60／0.90ms|
|4|8|14|0.90／1.40ms|0.90／1.20ms|

追加は1体あたり影なし1回／1,796三角形、今回の影あり2回／3,592三角形（影パス含む）。1体8骨を各AnimationMixerで更新する。
計測値はアニメーション更新＋render送信のCPU時間で、GPU完了・画面提示・実フレーム時間ではない。小さな差は測定揺らぎを含むため、0体より1体が速いという結論を出さない。全結果は [validation.json](review/validation.json)。
実スマホ、発熱・長時間、実戦、敵密集、協力通信、4人の兵士を含む負荷、地形の影、属性の光や粒子は未確認。モデル単体の値を実戦性能保証に使わない。

## 統合時の注意

- GLBはY-up、前方+Z。製品の向きへ合わせる必要があれば親ノードをY軸180度回す。原本はBlender Z-up／前方-Y。
- ルート移動なし。Followはその場の歩行で、追従移動・速度同期・斜面IK・衝突判定を実装していない。掌は演技のみ。Palmを一回再生にする制御やIdleとのブレンドは統合担当の範囲。
- 足は剛体的な簡略関節。静止時約1.5cmの地面クリアランスあり。地形への足合わせ・歩行の接地滑りは製品統合時の課題。
- 発光・粒子をモデルへ焼き込んでいない。属性の決定は別途本人判断。必要なら別オブジェクトで重ねる。
- ローポリ採用が合わなければ、この試作を基に元絵の比率・岩肌の雰囲気を保つ整理へ変更する。採用前に他個体を量産しない。

## 再現手順（専用worktreeのルートから）

既存のBlender、Node、three／playwright、Python＋Pillow、ffmpegを利用する。依存の追加インストールは行っていない。

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python assets/buddy/tatara-lowpoly-v1/build.py
node assets/buddy/tatara-lowpoly-v1/server.mjs
# ブラウザーで http://127.0.0.1:4317 を開く。回転・拡縮、視点、動作、数を変更可能。
# 自動検証は別の専用サーバーを自身で起動・終了する。
node assets/buddy/tatara-lowpoly-v1/check.mjs
node assets/buddy/tatara-lowpoly-v1/check-ui.mjs
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python assets/buddy/tatara-lowpoly-v1/roundtrip.py
node assets/buddy/tatara-lowpoly-v1/video.mjs
ffmpeg -y -framerate 30 -i assets/buddy/tatara-lowpoly-v1/review/frames/%04d.png -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart assets/buddy/tatara-lowpoly-v1/review/tatara-motion.mp4
python assets/buddy/tatara-lowpoly-v1/sheets.py
```

ブラウザー検証はローカル通信の許可が必要。本環境ではsandbox内サーバーと外のChromeは接続できず、正式に昇格した同一実行環境で両者を起動して解決した。テスト用Chromiumは未導入のため既存Chromeを使用。初回のfavicon 404はdata URIへ修正。Blender再インポートの骨表示用Icosphereを誤集計した初回判定は、実モデルTatara_Surfaceの明示選択へ修正。BlenderのOSサムネイル書込に権限警告が出たが、blend本体は保存・再読込み成功。

## 引継ぎ・記録の追記案

- GitHub: https://github.com/futsalife24-bot/swarm-front
- ブランチ: `codex/buddy-tatara-lowpoly-20261104`。基点は上記24cbbae。最終commitはこのフォルダの履歴を参照。
- ローカル: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly`
- 変更は `assets/buddy/tatara-lowpoly-v1/` のみ。原本・GLB・再現コード・今回レビューに必要な小容量画像と動画をGit管理し、使い捨て連番・ログ・blendバックアップは除外。
- `docs/STATE.md`／MainVaultへは直接書かず、本節を追記案として主担当へ渡す。「タタラ1体のローポリ試作と独立レビュー資料を作成、外観採用待ち。3動作とGLB往復・2解像度・0/1/4体描画を自己確認。属性未割当、ゲーム統合・main反映・公開なし。実機性能未確認。」
- 主担当の実モデルID／推論設定は取得不可・未確認。サブエージェント不使用。独立監査は今回依頼されておらず未実施。
