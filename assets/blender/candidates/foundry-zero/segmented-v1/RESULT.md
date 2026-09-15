# segmented-v1 制作結果

FOUNDRY ZEROの編集可能なBlenderモデル・8ユニットrigid GLB・4秒の屈曲確認クリップを制作し、2026-09-12のユーザーによる統合初版と公開の承認に基づいて仕上げた。生成元は `build_candidate.py`、構造契約は `structure-contract.json`。本担当はモデルと新規 `public/assets/enemies/foundry_zero_segmented_v1.glb` の配置を担当し、実歩行・戦闘AI・公開作業は別の統合担当が扱う。

## 最終アセット

- `foundry_zero_segmented_v1.blend`：各節・接続部・脚・レーザーアームが編集可能。
- `foundry_zero_segmented_v1.glb`：頭1＋胴7、34脚、7接続部、165物理mesh、8個の照準光学部。36,628tri / 5素材 / 約1.58MB。static、skinなし。
- 最終static GLBとpublicコピーのSHA-256・完全一致記録は `production-copy.json`。初期候補の旧SHAは `6dc8f5940f7de2e4c7f1808caef2c40735fc1dea649e477ef61c2e9ec3dd209a`。
- `foundry_zero_articulation_preview.glb`：独立構造確認用 `ArticulationPreview` 4秒。gameplay速度・攻撃時刻を表さない。
- `index.html`：GLTFLoaderの独立構造ビューアー。代表静止画は `review/oblique.png`、`review/front.png`、`review/side.png`、`review/head.png`。統合初版の表示へ更新済み。
- `review/articulation.mp4`：960×540、30fps、6秒、180フレーム（4秒周期を1.5回）。保存したMP4を読み戻して5時点で再生・デコード済み。

## 確認したこと

|検証|結果|証拠|
|---|---|---|
|Blender生成とfresh GLB再import|三角形数・bounds一致、非有限座標0、退化面0、正の変換、8独立root、地面下端0m|`blender-validation.json`、`reimport-validation.json`|
|標準GLTFLoader再読込|8root名・共通親、34脚、connector pivot、static側0skin/0clip|`browser-validation.json`|
|AnimationMixer、4秒を60Hzで検査|最大足先差0.442mm、上脚関節差0.119mm、下脚関節差0.442mm、地面潜り0、非有限座標0、clip長4秒|`browser-validation.json`|
|各unitのレーザー開口|8砲口の親pivot/原点・照準回転時の原点固定・開口前方の非遮蔽を検査|`browser-validation.json`|
|静止画の目視|最終oblique・front・sideを実表示。機械型の長胴多脚、頭部の発光アーム、独立した節接続を確認|`review/`|
|動画の読戻し|0.1/1/2/3.9/5.5秒で再生・シーク、異なるフレームのデコードを確認。1秒/3.9秒の復号画像を実表示して姿勢差を確認|`video-validation.json`、`review/video-1.png`、`review/video-3.9.png`|

## 修正履歴と残課題

足先0.3449mの差は候補UIが非表示animated rootを中立へ戻したためで、AnimationMixer管理対象への直接書込を除いて修正。4.0333秒は開始フレーム1のオフセットだったため、0〜120フレームへ変更して4秒に修正。これらの成功検査を、無関係なCSS変更後に重複実行していない。

最初のMediaRecorder試行は110-byteの無フレームWebMとなり、保存後デコードが失敗した。完成物から除去し、既存PLEATで使うWebCodecs＋MP4 muxへ切り替えた。`record_candidate.mjs` は成功した `record_webcodecs.mjs` を起動する。

初回監査の直立脚・胴下空間・素材の簡素さに対し、膝を低く後方へ折り、足先を外へ広げ、低い腹部外装を追加した。黒い機械部、金属殻と縁の質感を分け、発光の白飛びを抑えた。HEAD中央・各BODY背面器官の光学部は砲口pivotで回転できる。最終近接画像で検出した背面housingと開口面の重なりも、housingの奥行きを短くして修正した。AAAという自己採点で完成品質を保証しない。

仕上げで3,112tri（9.3%）増加した理由は低い腹部外装と各胴の可動レーザー光学部。素材5個は維持。元GLBの414材質primitiveを別担当が編集構造を維持した5材質バッチへ変換する。親側 `integration-preview/` の検証を別の証拠とする。スマートフォン実機のFPS・熱・負荷は未測定。

採用された地上4.2m/s、分離後6.3m/s、各生存unitレーザーに向け、脚restと砲口座標をshared/render担当へ共有した。最新の生成・分離・抽選仕様は正本とshared実装を参照し、モデル文書で古い未確定状態を上書きしない。ゲームAIや実歩行コードは本担当の編集範囲外。

開始branchは `codex/home-armory`、HEAD `4186f25f7c9695f95ea897ad182db5f85fac3091`。開始時点の既存差分は `start-state.json` に保持。本モデル制作での変更範囲は候補フォルダと新規public GLBのみ。
