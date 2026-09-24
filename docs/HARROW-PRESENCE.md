# HARROW v7: 体格・動作・会敵の修正

2026-09-24の追加依頼: 会敵ムービーが出ない。高度と移動速度は維持し、体格を3倍、脚・羽ばたき・他の動作も大きくゆっくりにする。

開始base `413c9ea7b2a879f4797dcf71bbfd8d965e3fd35a`、branch `codex/harrow-presence-motion`、作業場所 `../harrow-integration`。正本 https://github.com/futsalife24-bot/swarm-front 。元のgameにあるClaude/設定/敗北導線の未コミット作業は保護し、この変更に含めていない。

## 変更

- 表示・身体判定の縮尺を0.65→1.95に統一。HP・攻撃力、巡航0.64m/s、地形基準の飛行高度34.5mは維持。
- 編集可能なv7原本とGLBを追加。旧v6は保存。全11クリップの時間を1.75倍、歩行/Flightは4.2秒周期。Flight翼振幅は0.07→0.24rad。歩行は移動距離÷0.64で再生し、世界の移動速度と足の接地を揃える。
- Threatは3.5秒の予告後に左右5発ずつ発射。Spinは1.4秒予備→3.5秒で一回転→1.4秒復帰。GLB内に重複した回転はない。Takeoff3.5/Glide2.1/Dive1.4/Fall2.625/Land1.75秒に権威側も一致。
- ミサイル発射点は新版のThreat3.5秒の赤い弾頭先端から実測。爆風の威力・範囲2.5mは維持。Spin範囲21.2mは拡大した地上2m以下の翼の実測21.192798mに対応。Dive範囲は4→12m。
- 大きな身体の表面に爆発弾が直撃しても無傷になる不整合を修正。HARROWの爆風だけ体表までの距離で範囲・減衰を計算し、壁遮蔽と他種の計算は維持。
- 初会敵はHARROW限定で水平120m以内かつ遮蔽なしなら画面上方に外れていても開始。既存種の画面内判定は維持。空中では会敵中もFlightを再生し、ゲーム状態は停止する。
- 巨体のFlight全周期が入る会敵カメラとHARROW専用の上黒帯見出し。レポートへHARROW会敵映像も登録し、新GLBを実Rendererで収録した動画を追加。

## 実物と検証

原本・再生成手順: [v7 DESIGN](../assets/blender/candidates/harrow/v7/DESIGN.md)、[v7 VALIDATION](../assets/blender/candidates/harrow/v7/VALIDATION.md)。

- GLB `af5152de9e7be4ad4e4265d22a2fbe541e510eccc8f32fa274c406a016a75243`、8,574,688 bytes、39骨/186 primitives/152,428 triangles。体格変更でメッシュ数は増やしていない。
- 原本の別プロセス再読込とGLB再import、全11動作の40Hz骨/接合/ループ検証。Three.jsの60Hz骨・10Hz全変形頂点、世界接地480標本が成功。足の世界ずれ最大0.0000018m、床潜りは0.0000015m未満の丸め誤差。
- Flight全周期の翼幅45.927m。Spin、Flight上下、歩行、Dive、Fallの6画像をレンダーして確認。静止画を実機動画検証の代用にはしていない。
- 関連9ファイル182件＋実GLB/権威時間・10発射点一致の2件成功。ST20/ST25/15-A×通常/中級の6戦成功。client/Worker両型成功。
- 実ローカルWorker2接続でミサイル予告/発射/着弾、Spin、Glide→Dive→Land、ダメージ怯み落下等11項目成功。通信はmockではない。
- レポート動画: 実Renderer、新GLBとハッシュ一致、世界状態不変・JS error0。1280×720/30fps、13.95秒、全フレームdecode/羽ばたきフレーム変化成功。MP4 SHA256 `118790bc5fc819551ab626145543ef4cd6dca26950a654d2f8dd0f2e3eb8b0fa`。タイトル/字幕/全翼の収まりを目視確認。
- ローカル専用fixtureから製品のencounter/commit/dialogを実行。地面向きでHARROWの画面投影Y=5.438（画面外）でも開始し、空中の全翼と上黒帯見出しを目視。スキップ後、worldFrozen/normalSaveUnchanged/testSaveRestored/encounterRecordedすべてtrue。844×390でも見出しは上39px帯内に収まり、レポート→HARROW→会敵ムービーの実導線で再生（readyState4、時間進行、errorなし）を確認。通常保存・開発者認証は変更していない。

主証拠は `dist-validation/harrow-v7/` と `dist-validation/harrow/film-v7/`。独立監査時は対象SHAと共に必要な実物/証拠をZIP添付する。

## 残る確認・境界

build/dry-run、通常Chat独立監査、main反映、既存Worker公開は作業中。実スマホの性能、長時間多人数、全地形での全翼接地は未検証。身体被弾は従来の中心球を3倍した判定で、尾・翼の全メッシュ追従判定ではない。部位破壊等は追加していない。

## 監査依頼

対象4da040dのproduction build/Worker dry-run成功。PR81へpushし、通常Chat https://chatgpt.com/c/6ab4e649-ee10-83e8-80db-d78515281bd3 に25,626,983 bytesの資料を添付・送信済み。独立判定待ちで未公開。対象以降は記録のみ。
