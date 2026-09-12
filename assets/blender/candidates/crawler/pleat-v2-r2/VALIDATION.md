# PLEAT v2 — 監査用検証記録

2026-09-10。v1のA01/A02を受けた修正版。外部監査・本人見た目承認は未取得。本採用なし。

## 変更範囲
被覆だけを修正。背の膨らみを低い傾斜へ、粒状の房を長い面へ、縁を垂れた束へ変更した。材料・seed・支持肢・リグ・3clip・攻撃器官と戦闘仕様は維持。v1と既存素材は別保存。簡易形状はv1の制作履歴を参照し、v2で別のblockout生成済みとは扱わない。

## 今回実行した検証
Blender 5.2.1 LTS / 9e2066aef7ef、Windows、Chrome / SwiftShader。READMEの再生成コマンド、check_candidate.mjs、check_contacts.mjs、record_candidate.mjs、record_gameplay.mjs、make_review_sheet.mjsをv2パスで実行した。各ログとJSONはvalidation/。

- GLB書出し・再import成功。3224tri / 4材質 / 20骨 / 3clip / 266252bytes。
- SHA-256: 4b67dbfde687f65b9852cba5e89b48dd589c26ca7755385236007d9814fb5818。
- GPUと標準Three.jsスキニング差5.12e-8m以下、有限座標・クリップ端連続性検査成功。
- 全動作の最大地面潜り5.14e-7m、直進接地足のフレーム間ずれ4.20e-7m以下（数値誤差）。最大高さ約1.3992m。
- 圧力器官は攻撃0.45秒でGLB [0,0.3,-1.25]、表示burst中心と整合。ダメージ扇形の原点とは別。
- 無変更の実Renderer/StructureMotionで候補GLBをテストブラウザだけに応答差替え。1/10/40体、候補4バッチ、World不変、実stepによるburstとHP減少、hurt/kill/cleanup/fallback成功。844x390、複数体844x480、四方向1200x800。
- 動作動画は各13.4秒/960x540/30fps、実戦闘処理の動画は8秒。書出しMP4を複数時刻で読み戻して再生・復号成功。実追跡最大7.7m/s、Idle/Locomotion/Lunge、World変更0、HP160→120。
- 元版で成功した関連10テストはv2で再実行していない。アニメーション・ゲームソースは変更しておらず、新しい形状の上記検証を実行した。
- 既存110ファイルの前後ハッシュ全一致。validation/preservation.jsonにはファイル一覧と両ハッシュを収録。

## 実物の確認と限界
v2の書出しGLBの斜め画像、および保存側面動画から抽出した6姿勢のmotion-sheet.pngを実際に開いた。低くなった背、垂れた縁、支持肢との空隙、非グロの素材を確認。美的合格は独立監査待ち。全編の連続目視とは区別し、動画の再生・復号は自動検査である。

review/v1-v2-side.png、v1-v2-oblique.png、v1-v2-game-size.pngは元版と同じカメラ・照明・縮尺・動作時刻の画像を並べたもの。個別にモデルを拡大縮小していない。audit-manifest.jsonがGLB・生成器・画像・動画をハッシュで紐付ける。

Locomotion単体は0.72m/0.8秒の制作周期。現行ゲームでは移動距離に同期する。実速度の証拠はpleat_gameplay.mp4であり単体動画とは分離。Lungeは0.45秒の溜めと衝撃、Idleは待機。被弾色と撃破粒子は現行Renderer側で、GLB内VFXや新クリップではない。

足検査は平面・直進の条件で、地形IKや急旋回時の世界固定を保証しない。スマートフォン実機のFPS・発熱・長時間性能は未確認。オフライン30fpsは実機FPSの測定ではない。

branch codex/home-armory、HEAD 2be699f160c83d641fb68bb1304e4da8059920dc。未コミット変更あり。今回の修正は候補v2と監査記録のみ。ゲーム本採用・公開・他種展開・commit/push/merge・課金なし。

## 監査証拠修正版 v2-r2
GLB・Blender原本はv2と同一。モデル再生成は行わず、v2のbuild.logと生成時JSONを来歴として保存した。T01: 動画の402フレームだけによる再利用を廃止し、常に現GLBを新規録画。T02: pressure_seam材質のkeel割当て42頂点を実測し、先端誤差5.98e-8m。形状のみXへ0.5m移す負例で誤差0.5mとなり検査が拒否することを確認。E02: audit-workspaceに実Renderer/戦闘コードの依存ソース、fixture、関連テスト、package/lock/configを収録。原本v1/v2と証拠修正版を混同しない。


監査用audit-workspaceをrootにした関連テスト2ファイル10件が全成功（snapshot-tests.log）。現在のゲームのインストール済み依存を使ったため、完全新規npm ciの検証ではない。v2-r2でbrowser/contact/video/gameplayを全再実行・全新規録画した。

