# PLEAT・LEAPER精細化／レポート動作再生

2026-09-12。添付指定のPLEATとLEAPERをBlenderでリデザイン。LEAPERだけを独立モデル化し、VOLLEYは旧モデルを保持。全6種とFOUNDRY ZERO連結炉に「移動を見る」「攻撃を見る」「停止」を追加した。

PLEATは乾いた殻・筋・胸の襞・支持肢の環を精細化。LEAPERは大型リングを細い発光背骨に置換し、広い分割肩装甲、関節・五脚の爪・腹下のパルス器官を追加。表面の色・粗さ・法線をGLBへ埋込み。旧アセットは上書きしていない。

レポートは読み込み中の再生ボタンを無効化し、失敗を表示。再選択・形態変更で再生をリセットし、閉じるとフレーム更新と所有リソースを解放。LEAPERは移動時だけ跳躍全体へ視点を合わせる。攻撃は繰り返し表示し、停止で初期姿勢へ戻る。

- Blender 5.2.1 LTS保存・GLB再import成功。両モデル4 mesh / 20骨、既存3クリップを維持。
- GLBの全クリップを30Hzで頂点検査。有限座標、床下最大約0.000001m、ループ末端差0.000001m未満。
- 1/10/40体の現行GPU描画成功。モデル4 draw callsを維持。旧／新モーション80,366数値の差0。
- 型チェック・関連37単体テスト成功（34件と新規3件を分割実行）。client / Pages build・本番Worker dry-run成功。
- PC 1280×800・横画面915×412、全7表示＝14条件で移動／攻撃／停止・描画変化／停止中の同一画像・一覧／形態切替・閉じる処理成功、JS例外0。
- 配布版操作と公開状態は下記の追記欄を正とする。

制作ファイル・比較プレビュー: [設計と再生成](../assets/blender/candidates/reference-redesign-v1/DESIGN.md)、[PLEAT blend](../assets/blender/candidates/reference-redesign-v1/pleat/pleat_motion_v5.blend)、[LEAPER blend](../assets/blender/candidates/reference-redesign-v1/leaper/leaper_motion_v1.blend)。検証: `dist-validation/enemy-redesign/` の `preservation.json`・`ui-checks.json` と比較PNG、モデル別 `validation.json`。

変更: `hound-motion.ts`（バージョン／LEAPER読込み）、`structure-motion.ts`（LEAPER専用割当と距離同期）、`enemy-viewer.ts` / 新規 `enemy-report-motion.ts`（隔離再生）、`bestiary.ts` / CSS（操作・状態表示）、2つのGLB、テスト・検証スクリプト・制作記録。branch `codex/home-armory` / base・head `4186f25f7c9695f95ea897ad182db5f85fac3091`、今回未コミット。開始時の既存差分あり、今回差分は開始時コピーとの比較で保存。

初回検証で旧テストの「HOUND系は同じモデル」前提を修正。レポート検証スクリプトの選択子重複も修正して再実行。Worker dry-runはsandbox内のログ／親ディレクトリアクセス制限で失敗し、許可された実行で成功。実スマホ性能・長時間混戦は未検証。独立したChat監査／ユーザーの造形評価を得たとは扱わない。

## 配布・公開

配布版PC／タッチ2条件の全7表示・再生操作・出撃／撤退、JS/CSS/新旧3GLBのSHA-256一致、例外0を確認。撤退確認の初回2実行は検証側の画面名／遷移先の誤りで失敗し、既存の出撃準備画面への復帰を確認する形へ修正して成功。

既存Workerへ公開済み。Version `52b47ba0-3e5a-4692-8099-ee9282408475`、https://swarm-front.melosalife-24.workers.dev 。変更された配信ファイルはindex・JS・CSS・PLEAT v5・LEAPER v1の5個。公開版でもPC／タッチ両条件の全7表示・再生・出撃／撤退、JS/CSS/新旧3GLBのSHA-256一致、例外0、health 200 / ok:trueを確認。証拠は `dist-validation/enemy-redesign/published-checks.json` と公開PNG。公開確認のsandbox内初回はネットワーク制限で失敗し、許可された外部アクセスで成功。

## 2026-09-12 表示領域の拡大

ユーザー指定で視点リセットと左右回転ボタンを削除。bestiary.tsのボタン行・クリック登録とbestiary.cssの専用スタイルを撤去。移動／攻撃／停止・ドラッグ回転・ピンチ／ホイール操作は維持。1280×800と915×412でcanvas高さがそれぞれ228.859→264.859px、197→233pxへ36px増加。型・client build、ローカル両サイズの削除確認・再生切替・実ドラッグによる描画変化・close、JS例外0を確認。

既存WorkerへVersion `d0c86e17-61ac-4b4b-b94c-96990918fb99`で公開。公開版の両サイズでも36px拡大・3ボタン撤去・再生／ドラッグ・close・JS例外0、JS/CSSハッシュ一致を確認済み。今回の開始時コピー・検証画像/JSONは `dist-validation/report-space/`、検証器は `scripts/check-report-space.mjs`。branch `codex/home-armory` / base・HEAD `4186f25f7c9695f95ea897ad182db5f85fac3091`、既存差分を保持・今回未コミット。変更本体はbestiary.ts/CSSの2ファイルのみ。
